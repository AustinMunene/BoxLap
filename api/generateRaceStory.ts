/**
 * Vercel serverless function: /api/generateRaceStory
 *
 * Proxies AI calls from the frontend, keeping the Gemini API key
 * secret and enforcing rate limits to prevent abuse. This function:
 * - Validates the incoming RaceStats payload against a Zod schema
 * - Enforces per-IP rate limiting (5 calls/hour) using in-memory Map
 * - Calls the Google Gemini API on the server (key never exposed to client)
 * - Returns the generated race narrative or an error response
 *
 * Environment variables required:
 * - GEMINI_API_KEY: Gemini API key (kept server-side only)
 *
 * Request format (POST):
 * {
 *   "raceName": "Monaco",
 *   "season": 2024,
 *   "winner": "Lewis Hamilton",
 *   ...
 * }
 *
 * Response: { "stories": [...], "cached": boolean } or { "error": "..." }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { generateText, getGeminiHttpStatus, getGeminiRetryAfterSeconds } from './_gemini.ts'
import { checkRateLimit, getClientIp } from './_rateLimit.ts'

/**
 * Zod schema for RaceStats validation.
 * Ensures the client sends valid data before we call Gemini.
 * All fields are required and properly typed.
 */
const RaceStatsSchema = z.object({
  raceName: z.string().min(1),
  season: z.number().int().positive(),
  round: z.number().int().min(1).max(30),
  winner: z.string().min(1),
  winnerTeam: z.string().min(1),
  totalLaps: z.number().int().positive(),
  fastestLapDriver: z.string().min(1),
  fastestLapTime: z.string().min(1),
  pacingRanking: z.array(
    z.object({
      driver: z.string(),
      avgPace: z.number(),
    })
  ),
  pitRanking: z.array(
    z.object({
      driver: z.string(),
      totalPitTime: z.number(),
      stops: z.number().int(),
    })
  ),
  biggestGainers: z.array(
    z.object({
      driver: z.string(),
      delta: z.number().int(),
    })
  ),
  biggestLosers: z.array(
    z.object({
      driver: z.string(),
      delta: z.number(),
    })
  ),
  safetyCarLaps: z.array(z.number().int()),
  topSpeed: z.object({
    driver: z.string(),
    speed: z.number(),
  }),
  strategies: z.array(
    z.object({
      driver: z.string(),
      strategy: z.string(),
    })
  ),
  circuitName: z.string(),
  country: z.string(),
  location: z.string(),
  weatherSummary: z.string(),
  championshipStandingsSummary: z.string(),
})

type RaceStats = z.infer<typeof RaceStatsSchema>

/**
 * Server-side JSON cache for successful Gemini race-story responses.
 * Key: `${season}_${round}`. Checked before rate limiting so repeat requests
 * do not consume quota.
 */
const raceStoryResponseCache = new Map<string, string>()

/**
 * Builds the race analysis prompt for Gemini.
 * Same prompt as the browser version, but now called server-side.
 */
function buildRacePrompt(raceStats: RaceStats): string {
  return `
You are a Formula 1 analyst writing for everyday fans who love the sport
but don't read telemetry data. Your tone is clear, enthusiastic, and direct.
Avoid jargon. Use concrete numbers. Tell the story of what actually happened.

When venue, weather, or championship context is provided, weave it naturally into at least two paragraphs
(e.g. how conditions may have shaped tyre life, overtaking, or pit timing; how the result moves the title fight).

VENUE & SESSION CONDITIONS
- Location: ${raceStats.location}${raceStats.country ? `, ${raceStats.country}` : ''}
- Circuit (short name): ${raceStats.circuitName}
- Weather snapshot: ${raceStats.weatherSummary}

CHAMPIONSHIP SNAPSHOT (season ${raceStats.season}, top 10 - cumulative points)
${raceStats.championshipStandingsSummary}

Here is the computed data from this race:

RACE: ${raceStats.raceName} ${raceStats.season}
WINNER: ${raceStats.winner} (${raceStats.winnerTeam})
LAPS: ${raceStats.totalLaps}
FASTEST LAP: ${raceStats.fastestLapDriver} - ${raceStats.fastestLapTime}

RACE PACE RANKING (avg clean lap time, seconds):
${raceStats.pacingRanking.map((d: { driver: string; avgPace: number }, i: number) => `${i + 1}. ${d.driver} - ${d.avgPace}s`).join('\n')}

PIT STOP PERFORMANCE (total time lost in pits):
${raceStats.pitRanking.map((d: { driver: string; totalPitTime: number; stops: number }) => `${d.driver}: ${d.totalPitTime}s across ${d.stops} stops`).join('\n')}

BIGGEST POSITION MOVERS:
Gainers: ${raceStats.biggestGainers.map((d: { driver: string; delta: number }) => `${d.driver} +${d.delta}`).join(', ')}
Losers: ${raceStats.biggestLosers.map((d: { driver: string; delta: number }) => `${d.driver} ${d.delta}`).join(', ')}

SAFETY CAR: ${raceStats.safetyCarLaps.length > 0 ? `Deployed laps ${raceStats.safetyCarLaps.join(', ')}` : 'No safety car'}

TOP SPEED: ${raceStats.topSpeed.driver} - ${raceStats.topSpeed.speed} km/h

TYRE STRATEGIES USED:
${raceStats.strategies.map((s: { driver: string; strategy: string }) => `${s.driver}: ${s.strategy}`).join('\n')}

Write exactly 5 insight paragraphs. Each paragraph should:
1. Have a bold one-line headline (e.g. **The Race Pace Story**)
2. Be 2–3 sentences max
3. Explain one specific story from the data above
4. Sound like a knowledgeable friend explaining it at a pub, not a press release

Output only the 5 paragraphs. No intro, no outro, no bullet points.
  `.trim()
}

/**
 * Main Vercel handler function.
 */
export default async (req: VercelRequest, res: VercelResponse) => {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('[generateRaceStory] GEMINI_API_KEY not set in environment')
    return res.status(500).json({
      error: 'Server misconfiguration',
      code: 'MISSING_GEMINI_KEY',
    })
  }

  try {
    const parsedBody = RaceStatsSchema.safeParse(req.body)
    if (!parsedBody.success) {
      return res.status(400).json({
        error: 'Invalid RaceStats payload',
        details: parsedBody.error.errors,
      })
    }
    const raceStats = parsedBody.data

    const cacheKey = `${raceStats.season}_${raceStats.round}`
    const cachedJson = raceStoryResponseCache.get(cacheKey)
    if (cachedJson) {
      const parsed = JSON.parse(cachedJson) as { stories: unknown[] }
      return res.status(200).json({ stories: parsed.stories, cached: true })
    }

    /**
     * Rate limiting only when we need a real Gemini call.
     */
    const ip = getClientIp(req)
    const rl = checkRateLimit({ key: `race_story:${ip}`, limit: 20, windowMs: 3600_000 })
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: rl.retryAfterSeconds,
      })
    }

    const prompt = buildRacePrompt(raceStats)
    /**
     * Calls Gemini 2.0 Flash via the shared client in _gemini.ts.
     * Prompt content is unchanged from the original Anthropic implementation -
     * only the client library differs. Response is plain text in both cases.
     */
    const text = await generateText(prompt)

    // Parse model response into structured paragraphs
    const paragraphs = text
      .split('\n\n')
      .filter(Boolean)
      .map((block: string) => {
        const lines = block.split('\n')
        const headlineMatch = lines[0].match(/\*\*(.+?)\*\*/)
        return {
          headline: headlineMatch ? headlineMatch[1] : 'Insight',
          body: lines.slice(1).join(' ').trim() || lines[0].replace(/\*\*/g, '').trim(),
        }
      })

    const payload = {
      stories: paragraphs,
      cached: false as const,
    }
    raceStoryResponseCache.set(cacheKey, JSON.stringify(payload))
    return res.status(200).json(payload)
  } catch (error) {
    const geminiStatus = getGeminiHttpStatus(error)
    if (geminiStatus === 429) {
      return res.status(429).json({
        error:
          'Gemini API quota exceeded (free tier or project limits). Wait a few minutes, reduce requests, or enable billing in Google AI Studio.',
        code: 'GEMINI_QUOTA',
        retryAfter: getGeminiRetryAfterSeconds(error),
      })
    }
    console.error('Unexpected error in generateRaceStory:', error)
    return res.status(500).json({
      error: 'Internal server error',
    })
  }
}
