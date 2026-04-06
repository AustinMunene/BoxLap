/**
 * src/api/chartOneLiners.ts
 *
 * Frontend helper to fetch Claude mini one-liners for Breakdown charts.
 *
 * Pattern:
 * Frontend → POST /api/generateChartOneLiners → Vercel function → Claude
 *
 * Caching:
 * - Cached in sessionStorage keyed by season + round to avoid repeated model calls.
 */

import { z } from 'zod'
import type { RaceStats } from '@/api/claudeInsights'

/**
 * Zod schema for the one-liners response.
 *
 * Returns: exactly five strings.
 */
const OneLinersSchema = z.object({
  sectorHeatmap: z.string(),
  tyreDegradation: z.string(),
  speedTrap: z.string(),
  qualiVsRace: z.string(),
  consistency: z.string(),
})

export type ChartOneLiners = z.infer<typeof OneLinersSchema>

/**
 * Fetches one-liners from the backend and caches the result in sessionStorage.
 *
 * Data source: Backend `/api/generateChartOneLiners` endpoint.
 *
 * Returns: `ChartOneLiners`.
 */
export async function generateChartOneLiners(raceStats: RaceStats, season: number, round: number): Promise<ChartOneLiners> {
  const cacheKey = `pitwall_chart_oneliners_${season}_${round}`
  const cached = sessionStorage.getItem(cacheKey)
  if (cached) {
    const parsed = OneLinersSchema.safeParse(JSON.parse(cached))
    if (parsed.success) return parsed.data
  }

  const res = await fetch('/api/generateChartOneLiners', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(raceStats),
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string; retryAfter?: number }
    if (res.status === 429) {
      const msg =
        typeof body.error === 'string'
          ? body.error
          : 'Gemini quota exceeded. Chart insights will load after a short wait.'
      throw new Error(body.retryAfter != null ? `${msg} (~${body.retryAfter}s)` : msg)
    }
    throw new Error(typeof body.error === 'string' ? body.error : 'Failed to generate chart one-liners')
  }

  const json = await res.json()
  const parsed = OneLinersSchema.parse(json)
  sessionStorage.setItem(cacheKey, JSON.stringify(parsed))
  return parsed
}

