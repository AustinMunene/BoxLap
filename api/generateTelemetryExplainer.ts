/**
 * POST /api/generateTelemetryExplainer
 *
 * Receives a structured telemetry delta summary and returns a fan-friendly,
 * plain-English explanation of what the telemetry reveals.
 *
 * Validation (zod):
 * - driver codes are 3-letter strings
 * - lap is a positive int
 * - deltas are finite numbers
 *
 * Rate limiting:
 * - 10 calls per IP per hour (higher than race story because fans explore combos)
 *
 * Security:
 * - Gemini API key lives server-side only (`GEMINI_API_KEY`).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { checkRateLimit, getClientIp } from './_rateLimit.ts'
import { generateText, getGeminiHttpStatus, getGeminiRetryAfterSeconds } from './_gemini.ts'

const BodySchema = z.object({
  driverA: z.object({
    code: z.string().length(3),
    team: z.string().min(1),
  }),
  driverB: z.object({
    code: z.string().length(3),
    team: z.string().min(1),
  }),
  lap: z.number().int().positive(),
  season: z.number().int().min(2000).max(2100),
  round: z.number().int().min(1).max(30),
  raceName: z.string().min(1),
  circuitName: z.string(),
  country: z.string(),
  location: z.string(),
  weatherSummary: z.string(),
  championshipStandingsSummary: z.string(),
  topSpeedDelta: z.number().finite(),
  topSpeedAdvantage: z.string().length(3),
  brakePointDelta: z.number().finite(),
  earlierBraker: z.string().length(3),
  throttleApplicationDelta: z.number().finite(),
  earlierThrottler: z.string().length(3),
  gearChangesA: z.number().int().nonnegative(),
  gearChangesB: z.number().int().nonnegative(),
})

type Body = z.infer<typeof BodySchema>

/**
 * Builds a focused prompt that turns numeric deltas into a fan-friendly explanation.
 *
 * Includes venue, weather, and championship snapshot so answers feel grounded in the real event.
 * Fan questions are explicit so the model answers what viewers actually wonder about.
 */
function buildPrompt(b: Body): string {
  return `
You are an F1 analyst explaining telemetry to a fan who watches every race but has never seen telemetry charts.
Use plain English. Use the concrete numbers provided. Avoid jargon like "oversteer/understeer" unless you immediately explain it in one sentence.

Event context:
- Season ${b.season}, round ${b.round}: ${b.raceName}
- Venue: ${b.location}${b.country ? `, ${b.country}` : ''} - ${b.circuitName}
- Lap compared: ${b.lap}
- Weather during the session (approximate): ${b.weatherSummary}
- Championship picture (top 10, cumulative points - for narrative colour only):
${b.championshipStandingsSummary}

Drivers:
- Driver A: ${b.driverA.code} (${b.driverA.team})
- Driver B: ${b.driverB.code} (${b.driverB.team})

Computed deltas from this lap (A minus B unless otherwise stated):
- Top speed delta: ${b.topSpeedDelta.toFixed(1)} km/h (advantage: ${b.topSpeedAdvantage})
- Brake point delta: ${Math.abs(b.brakePointDelta).toFixed(0)} m along the lap (earlier braker: ${b.earlierBraker})
- Throttle application delta: ${Math.abs(b.throttleApplicationDelta).toFixed(0)} m (earlier on throttle: ${b.earlierThrottler})
- Gear changes this lap: ${b.driverA.code} ${b.gearChangesA} vs ${b.driverB.code} ${b.gearChangesB}

Answer these fan questions inside one flowing paragraph (no Q/A headings, no bullets):
1) Who had the edge in straight-line speed here, and could that be setup, slipstream, or track position?
2) Who initiated braking first - does that read as defensive, saving tyres, or a different line?
3) Who got to full throttle earlier - what might that say about traction or confidence?
4) Do the gear-change counts support or contradict the speed/brake/throttle story?

Write 4–6 sentences total. Do not output JSON. Output only the paragraph text.
  `.trim()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  /**
   * Explicit key guard per CURSOR.md Rule 4.
   * _gemini.ts also checks on first use, but we guard here too
   * so the 500 response includes a clear server misconfiguration code
   * rather than a generic Gemini error message.
   */
  if (!process.env.GEMINI_API_KEY) {
    console.error('[generateTelemetryExplainer] GEMINI_API_KEY not set in environment')
    return res.status(500).json({
      error: 'Server misconfiguration',
      code: 'MISSING_GEMINI_KEY',
    })
  }

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const body = req.body

    const result = BodySchema.safeParse(body)
    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    const ip = getClientIp(req)
    const rl = checkRateLimit({ key: `telemetry_explainer:${ip}`, limit: 10, windowMs: 3600_000 })
    if (!rl.allowed) {
      return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfterSeconds })
    }

    const prompt = buildPrompt(result.data)
    const text = await generateText(prompt)

    return res.status(200).json({ text })
  } catch (error) {
    const geminiStatus = getGeminiHttpStatus(error)
    if (geminiStatus === 429) {
      console.warn('[telemetry] Gemini quota exceeded', error)
      return res.status(429).json({
        error:
          'Gemini API quota exceeded. Please wait and try again, or check billing in Google AI Studio.',
        code: 'GEMINI_QUOTA',
        retryAfter: getGeminiRetryAfterSeconds(error),
      })
    }
    console.error('[telemetry] UNHANDLED ERROR:', error)
    return res.status(500).json({
      error: 'Could not generate telemetry explanation right now.',
      code: 'GEMINI_ERROR',
    })
  }
}
