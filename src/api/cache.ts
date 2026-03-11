const store: Record<string, { data: unknown; ts: number }> = {}
const TTL = 5 * 60 * 1000 // 5 minutes

export async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = store[key]
  if (hit && Date.now() - hit.ts < TTL) return hit.data as T
  const data = await fetcher()
  store[key] = { data, ts: Date.now() }
  return data
}
