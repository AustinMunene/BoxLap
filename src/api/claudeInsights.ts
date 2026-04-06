/**
 * claudeInsights.ts
 *
 * Client-side orchestration for race story generation.
 * This module no longer calls Claude API directly (security risk).
 *
 * Instead, it proxies requests through a Vercel serverless function
 * at /api/generateRaceStory which:
 * - Validates the RaceStats payload (Zod)
 * - Enforces rate limiting via Upstash Redis (5 req/min per IP)
 * - Calls Claude on the backend (API key stays secret, never sent to client)
 * - Returns the narrative response
 *
 * The backend function handles all authentication, validation, and security.
 * This client module only prepares the RaceStats and sends it via fetch.
 */

import { z } from 'zod'

/**
 * Zod schema for RaceStats validation - ensures we send valid data to the API.
 * Matches the backend schema in /api/generateRaceStory.ts exactly.
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
  biggestLosers: z.array(z.object({ driver: z.string(), delta: z.number() })),
  safetyCarLaps: z.array(z.number().int()),
  topSpeed: z.object({ driver: z.string(), speed: z.number() }),
  strategies: z.array(z.object({ driver: z.string(), strategy: z.string() })),
  circuitName: z.string(),
  country: z.string(),
  location: z.string(),
  weatherSummary: z.string(),
  championshipStandingsSummary: z.string(),
})

/**
 * RaceStats type - the shape of data we pass to Claude via the Vercel endpoint.
 * We compute all of this from our existing store data before calling the API,
 * so the backend receives concise, clean, summarised numbers.
 */
export interface RaceStats {
  raceName: string
  season: number
  /** Championship round (1-based); used for stable sessionStorage cache keys. */
  round: number
  winner: string
  winnerTeam: string
  totalLaps: number
  fastestLapDriver: string
  fastestLapTime: string
  pacingRanking: { driver: string; avgPace: number }[]
  pitRanking: { driver: string; totalPitTime: number; stops: number }[]
  biggestGainers: { driver: string; delta: number }[]
  biggestLosers: { driver: string; delta: number }[]
  safetyCarLaps: number[]
  topSpeed: { driver: string; speed: number }
  strategies: { driver: string; strategy: string }[]
  circuitName: string
  country: string
  location: string
  weatherSummary: string
  championshipStandingsSummary: string
}

/**
 * Validates RaceStats before calling Gemini. Incomplete payloads fail the API
 * and surface as a generic "story unavailable" in the UI.
 */
export function isRaceStatsComplete(stats: RaceStats): boolean {
  if (!stats.raceName || !stats.winner) return false
  if (!stats.totalLaps || stats.totalLaps === 0) return false
  if (!stats.pacingRanking || stats.pacingRanking.length < 3) return false
  if (!stats.strategies || stats.strategies.length < 3) return false
  return true
}

/**
 * Main export - call this after race data is fully loaded.
 * Returns an array of { headline, body } objects ready to render.
 * Results are cached in sessionStorage so we don't re-call on navigation.
 *
 * This function:
 * 1. Validates the RaceStats payload (fail fast if invalid)
 * 2. Checks sessionStorage cache (return cached result if available)
 * 3. POSTs the validated payload to /api/generateRaceStory
 * 4. Handles rate limiting and API errors gracefully
 * 5. Caches the result for fast subsequent renders
 *
 * @param raceStats Pre-computed race statistics object
 * @returns Stories array, or `null` if stats are incomplete (caller should wait / retry)
 * @throws Error if validation fails, rate limit exceeded, or API error occurs
 */
export async function generateRaceStory(
  raceStats: RaceStats
): Promise<{ headline: string; body: string }[] | null> {
  if (!isRaceStatsComplete(raceStats)) {
    console.warn('[generateRaceStory] raceStats incomplete, skipping:', {
      raceName: raceStats.raceName,
      winner: raceStats.winner,
      paceEntries: raceStats.pacingRanking?.length,
      totalLaps: raceStats.totalLaps,
      strategyEntries: raceStats.strategies?.length,
    })
    return null
  }

  // Deterministic cache key: season + round only (not raceName — formatting varies by source).
  const cacheKey = `boxlap_story_${raceStats.season}_${raceStats.round}`
  const cachedStr = sessionStorage.getItem(cacheKey)
  if (cachedStr) {
    return JSON.parse(cachedStr)
  }

  // Validate the RaceStats object before sending to the API
  // This ensures we never send malformed data and catch errors early on the client
  try {
    RaceStatsSchema.parse(raceStats)
  } catch (e) {
    if (e instanceof z.ZodError) {
      const messages = (e as z.ZodError).errors.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`).join('; ')
      throw new Error(`Invalid RaceStats: ${messages}`)
    }
    throw e
  }

  // POST the validated RaceStats to the Vercel serverless function
  // The backend will handle Claude API calls securely (key never sent to client)
  const response = await fetch('/api/generateRaceStory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(raceStats),
  })

  // Handle HTTP errors from the serverless function
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 429) {
      throw new Error('Rate limited. Please wait a minute before trying again.')
    }
    if (response.status === 400) {
      throw new Error(`Invalid request: ${errorData.error || 'Unknown error'}`)
    }
    throw new Error(`API error: ${response.status} - ${errorData.error || 'Unknown error'}`)
  }

  // Parse the successful response
  const data = await response.json()
  const paragraphs = data.stories || []

  // Cache the result so re-renders or tab switches don't re-fetch
  sessionStorage.setItem(cacheKey, JSON.stringify(paragraphs))
  return paragraphs
}
