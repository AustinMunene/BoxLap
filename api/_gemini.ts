/**
 * _gemini.ts
 *
 * Shared Gemini client for all PitWall serverless functions.
 * Lazily instantiates the client on first use so importing this module never
 * throws when `GEMINI_API_KEY` is not yet present in `process.env` (e.g. dev
 * middleware load order).
 *
 * Model: gemini-2.0-flash
 *
 * Environment variable: GEMINI_API_KEY (never VITE_ prefixed)
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

let genAI: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    throw new Error('Server misconfiguration')
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(key)
  }
  return genAI
}

/**
 * Returns the shared Gemini model instance.
 *
 * @returns GenerativeModel configured for gemini-2.0-flash
 */
export function getGeminiModel() {
  return getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' })
}

/**
 * Sends a prompt to Gemini and returns the plain text response.
 *
 * @param prompt - The full prompt string to send
 * @returns The model's text response as a plain string
 * @throws If the API call fails or returns an empty response
 */
export async function generateText(prompt: string): Promise<string> {
  const model = getGeminiModel()
  const result = await model.generateContent(prompt)
  const text = result.response.text()

  if (!text || text.trim() === '') {
    throw new Error('Empty response from Gemini')
  }

  return text.trim()
}

/**
 * Reads HTTP status from `@google/generative-ai` errors (e.g. 429 when quota is exceeded).
 */
export function getGeminiHttpStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const n = (error as { status?: number }).status
    return typeof n === 'number' ? n : undefined
  }
  return undefined
}

/**
 * Parses "Please retry in 16.2s" from Gemini error messages for Retry-After hints.
 */
export function getGeminiRetryAfterSeconds(error: unknown): number {
  const msg = error instanceof Error ? error.message : String(error)
  const m = msg.match(/retry in ([\d.]+)\s*s/i)
  if (m) return Math.max(1, Math.ceil(parseFloat(m[1])))
  return 60
}
