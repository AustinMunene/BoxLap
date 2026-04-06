const store: Record<string, { data: unknown; ts: number; ttlMs: number }> = {}
const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * In-memory cache with per-key TTL.
 *
 * @param ttlMs - Time-to-live in ms (default 5 minutes). Wikipedia images use 24h.
 */
export async function cached<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = DEFAULT_TTL_MS): Promise<T> {
  const hit = store[key]
  if (hit && Date.now() - hit.ts < hit.ttlMs) return hit.data as T
  const data = await fetcher()
  store[key] = { data, ts: Date.now(), ttlMs }
  return data
}
