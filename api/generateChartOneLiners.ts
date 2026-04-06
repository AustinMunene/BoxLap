/**
 * POST /api/generateChartOneLiners
 *
 * Receives the full RaceStats object (same shape as `/api/generateRaceStory`)
 * and returns exactly 5 AI-generated one-liners for the Breakdown charts:
 * `{ sectorHeatmap, tyreDegradation, speedTrap, qualiVsRace, consistency }`.
 *
 * Validation:
 * - Request body is validated with Zod before any model call.
 * - Model response is required to be valid JSON with exactly those keys.
 *
 * Rate limiting:
 * - Uses the shared in-memory limiter in `api/_rateLimit.ts`.
 * - Same policy as race story: 5 requests per IP per hour.
 *
 * Security:
 * - Gemini API key is read from `process.env.GEMINI_API_KEY` (never VITE_).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { checkRateLimit, getClientIp } from './_rateLimit.ts'
import { generateText, getGeminiHttpStatus, getGeminiRetryAfterSeconds } from './_gemini.ts'

/**
 * Zod schema for the RaceStats payload.
 *
 * Data source: Computed client-side from OpenF1 + Ergast data, then POSTed to this endpoint.
 *
 * Note: This schema intentionally matches the backend `generateRaceStory` contract
 * so the same RaceStats object can drive both story and one-liners.
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
  pacingRanking: z.array(z.object({ driver: z.string(), avgPace: z.number() })),
  pitRanking: z.array(z.object({ driver: z.string(), totalPitTime: z.number(), stops: z.number().int() })),
  biggestGainers: z.array(z.object({ driver: z.string(), delta: z.number().int() })),
  biggestLosers: z.array(z.object({ driver: z.string(), delta: z.number().int() })),
  safetyCarLaps: z.array(z.number().int()),
  topSpeed: z.object({ driver: z.string(), speed: z.number() }),
  strategies: z.array(z.object({ driver: z.string(), strategy: z.string() })),
  circuitName: z.string(),
  country: z.string(),
  location: z.string(),
  weatherSummary: z.string(),
  championshipStandingsSummary: z.string(),
})

type RaceStats = z.infer<typeof RaceStatsSchema>

/**
 * Server-side cache for successful one-liner JSON responses.
 * Key: `${season}_${round}`. Checked before rate limiting.
 */
const chartOneLinersResponseCache = new Map<string, string>()

/**
 * Zod schema for the Claude JSON response.
 *
 * Returns: An object with exactly five short insight strings.
 */
const OneLinersSchema = z.object({
  sectorHeatmap: z.string().min(1),
  tyreDegradation: z.string().min(1),
  speedTrap: z.string().min(1),
  qualiVsRace: z.string().min(1),
  consistency: z.string().min(1),
})

export type ChartOneLiners = z.infer<typeof OneLinersSchema>

/**
 * Builds a prompt that forces a strict JSON response with exactly five keys.
 *
 * Returns: Claude prompt string.
 */
function buildOneLinerPrompt(raceStats: RaceStats): string {
  // We keep the prompt grounded in the structured inputs we already computed.
  // This helps Gemini produce specific, non-generic one-liners without needing raw arrays.
  return `
You are an F1 analyst writing for everyday fans.

Generate exactly 5 one-sentence chart insights as JSON with these keys:
{ "sectorHeatmap": string, "tyreDegradation": string, "speedTrap": string, "qualiVsRace": string, "consistency": string }

Rules:
- Return ONLY valid JSON. No markdown, no backticks, no extra keys.
- Each value must be exactly ONE sentence, max 22 words.
- Must reference at least one driver code from the data below.
- Never start a sentence with "This chart shows".
- Sound like a knowledgeable friend, not a press release.
- Where it fits, nod to venue (${raceStats.circuitName}) or conditions (${raceStats.weatherSummary}) in at most one of the five lines - do not force it.

Race context:
- Venue: ${raceStats.location}${raceStats.country ? `, ${raceStats.country}` : ''} - ${raceStats.circuitName}
- Race: ${raceStats.raceName} ${raceStats.season}
- Winner: ${raceStats.winner} (${raceStats.winnerTeam})
- Fastest lap: ${raceStats.fastestLapDriver} - ${raceStats.fastestLapTime}
- Top speed: ${raceStats.topSpeed.driver} - ${raceStats.topSpeed.speed} km/h
- Safety car laps: ${raceStats.safetyCarLaps.length > 0 ? raceStats.safetyCarLaps.join(', ') : 'none'}
- Weather snapshot: ${raceStats.weatherSummary}
- Championship (top 10): ${raceStats.championshipStandingsSummary.split('\n').slice(0, 3).join(' | ')}

Pace ranking (avg clean lap seconds):
${raceStats.pacingRanking.map((d, i) => `${i + 1}. ${d.driver} ${d.avgPace}s`).join('\n')}

Pit ranking:
${raceStats.pitRanking.map(d => `${d.driver} ${d.totalPitTime}s (${d.stops} stops)`).join('\n')}

Movers:
Gainers: ${raceStats.biggestGainers.map(d => `${d.driver} +${d.delta}`).join(', ') || 'none'}
Losers: ${raceStats.biggestLosers.map(d => `${d.driver} -${d.delta}`).join(', ') || 'none'}

Strategies:
${raceStats.strategies.map(s => `${s.driver}: ${s.strategy}`).join('\n')}
  `.trim()
}

/**
 * Parses a best-effort Claude response into JSON and validates it with Zod.
 *
 * Why: Claude can sometimes include leading/trailing text; we aggressively
 * extract the first JSON object to keep the endpoint robust.
 *
 * Returns: `ChartOneLiners`.
 */
function parseClaudeJson(text: string): ChartOneLiners {
  const trimmed = text.trim()

  // Non-obvious transformation:
  // We locate the first '{' and last '}' and parse that substring as JSON.
  // This tolerates occasional preambles while still enforcing strict schema.
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Claude did not return JSON')
  }

  const jsonStr = trimmed.slice(start, end + 1)
  const parsed = JSON.parse(jsonStr) as unknown
  return OneLinersSchema.parse(parsed)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!process.env.GEMINI_API_KEY) {
    console.error('[generateChartOneLiners] GEMINI_API_KEY not set in environment')
    return res.status(500).json({
      error: 'Server misconfiguration',
      code: 'MISSING_GEMINI_KEY',
    })
  }

  const parsed = RaceStatsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error })
  }

  const cacheKey = `${parsed.data.season}_${parsed.data.round}`
  const cachedJson = chartOneLinersResponseCache.get(cacheKey)
  if (cachedJson) {
    return res.status(200).json(JSON.parse(cachedJson) as ChartOneLiners)
  }

  const ip = getClientIp(req)
  const rl = checkRateLimit({ key: `chart_oneliners:${ip}`, limit: 20, windowMs: 3600_000 })
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfterSeconds })
  }

  try {
    const prompt = buildOneLinerPrompt(parsed.data)

    /**
     * Calls Gemini 2.0 Flash via the shared client in _gemini.ts.
     * Prompt content is unchanged from the original Anthropic implementation -
     * only the client library differs. Response is plain text in both cases.
     */
    const text = await generateText(prompt)

    /**
     * Gemini may wrap JSON responses in markdown code fences.
     * We strip these before parsing to avoid JSON.parse failures.
     * This is a known quirk of instruction-following models returning
     * structured data - Claude had the same behaviour occasionally.
     */
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim()

    const oneLiners = parseClaudeJson(cleaned)
    chartOneLinersResponseCache.set(cacheKey, JSON.stringify(oneLiners))
    return res.status(200).json(oneLiners)
  } catch (e) {
    const geminiStatus = getGeminiHttpStatus(e)
    if (geminiStatus === 429) {
      return res.status(429).json({
        error:
          'Gemini API quota exceeded. Try again shortly or check your Google AI Studio quota and billing.',
        code: 'GEMINI_QUOTA',
        retryAfter: getGeminiRetryAfterSeconds(e),
      })
    }
    return res.status(500).json({ error: 'Failed to generate one-liners' })
  }
}

