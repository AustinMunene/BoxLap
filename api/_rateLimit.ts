/**
 * api/_rateLimit.ts
 *
 * Shared in-memory rate limiting for Vercel serverless functions.
 *
 * Why this exists:
 * - Every `/api` endpoint must have rate limiting (CURSOR.md Rule 2).
 * - We keep the logic centralized so endpoints don't copy-paste.
 *
 * Trade-offs:
 * - In-memory maps reset on cold starts and don't coordinate across instances.
 * - This is still a meaningful protection for a small app without dependencies.
 */

import type { VercelRequest } from '@vercel/node'

type RateLimitRecord = { count: number; resetTime: number }

const buckets = new Map<string, RateLimitRecord>()

/**
 * Extracts a best-effort client IP for rate limiting.
 *
 * Data source: Vercel populates `x-forwarded-for` for incoming requests.
 *
 * Returns: A string IP identifier (falls back to `unknown`).
 */
export function getClientIp(req: VercelRequest): string {
  const header = req.headers['x-forwarded-for']
  const forwarded = Array.isArray(header) ? header[0] : header
  const ip = forwarded?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  return ip
}

/**
 * Enforces a fixed-window rate limit per IP.
 *
 * Returns: `{ allowed: true }` when request may proceed, otherwise `{ allowed: false, retryAfterSeconds }`.
 */
export function checkRateLimit(opts: {
  /** Client identifier, usually the IP from `getClientIp()` */
  key: string
  /** Maximum requests allowed in the window. */
  limit: number
  /** Window size in milliseconds. Example: 3600_000 for 1 hour. */
  windowMs: number
}): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now()
  const record = buckets.get(opts.key)

  // First request: initialize the bucket.
  if (!record) {
    buckets.set(opts.key, { count: 1, resetTime: now + opts.windowMs })
    return { allowed: true }
  }

  // Window elapsed: reset the bucket.
  if (now > record.resetTime) {
    buckets.set(opts.key, { count: 1, resetTime: now + opts.windowMs })
    return { allowed: true }
  }

  // Over limit: deny and return retry-after.
  if (record.count >= opts.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000))
    return { allowed: false, retryAfterSeconds }
  }

  // Allowed: increment and proceed.
  record.count += 1
  return { allowed: true }
}

