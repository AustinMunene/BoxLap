/**
 * Shared formatting for Gemini prompts: weather samples and championship standings.
 *
 * Data sources: OpenF1 `WeatherData` from the race session; Ergast driver standings for the season.
 *
 * Why: `usePostRacePipeline` and `TelemetryView` both need the same human-readable summaries
 * without duplicating aggregation logic.
 */

import type { WeatherData } from '@/types/openf1'
import type { ErgastDriverStanding } from '@/api/ergast'

/**
 * Collapses many weather samples into one line suitable for an LLM prompt.
 *
 * Returns: A short English summary (temperatures + wet/dry). Never throws.
 */
export function summarizeWeather(samples: WeatherData[]): string {
  if (!samples.length) {
    return 'Weather samples not available for this session.'
  }
  const air = samples.map(s => s.air_temperature).filter((n): n is number => n != null && !Number.isNaN(n))
  const track = samples.map(s => s.track_temperature).filter((n): n is number => n != null && !Number.isNaN(n))
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
  const airAvg = avg(air)
  const trackAvg = avg(track)
  const rain = samples.some(s => s.rainfall === true)
  const wind = samples.map(s => s.wind_speed).filter((n): n is number => n != null && !Number.isNaN(n))
  const windAvg = avg(wind)

  const parts: string[] = []
  if (airAvg != null) parts.push(`air ~${airAvg.toFixed(1)}°C`)
  if (trackAvg != null) parts.push(`track ~${trackAvg.toFixed(1)}°C`)
  if (windAvg != null) parts.push(`wind ~${windAvg.toFixed(0)} km/h`)
  parts.push(rain ? 'rain recorded during the session' : 'dry conditions')
  return parts.join(', ')
}

/**
 * Formats the top 10 driver standings for prompt injection.
 *
 * Returns: Multi-line string "1. VER - 255 pts" etc., or a fallback message if empty.
 */
export function formatChampionshipSnapshot(rows: ErgastDriverStanding[]): string {
  if (!rows.length) {
    return 'Championship standings unavailable.'
  }
  return rows
    .slice(0, 10)
    .map(s => `${s.position}. ${s.Driver.code} - ${s.points} pts`)
    .join('\n')
}
