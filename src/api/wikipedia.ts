/**
 * wikipedia.ts
 *
 * Fetches driver headshots and team logos from the Wikipedia REST API.
 * Free, no authentication required, no rate limits for reasonable usage.
 *
 * We use the /page/summary endpoint which returns a thumbnail image
 * URL alongside basic article metadata. The thumbnail is typically
 * 320px wide - sufficient for card display.
 *
 * Results are cached with a 24-hour TTL via the existing cached()
 * utility since driver/team images almost never change mid-season.
 */

import { cached } from './cache'

const WIKI_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary'

/**
 * Maps our driver codes to their Wikipedia article names.
 * Wikipedia uses full names with underscores.
 * Update this map when the driver lineup changes.
 */
export const DRIVER_WIKI_NAMES: Record<string, string> = {
  VER: 'Max_Verstappen',
  HAM: 'Lewis_Hamilton',
  LEC: 'Charles_Leclerc',
  NOR: 'Lando_Norris',
  PIA: 'Oscar_Piastri',
  RUS: 'George_Russell',
  SAI: 'Carlos_Sainz_Jr.',
  ALO: 'Fernando_Alonso',
  STR: 'Lance_Stroll',
  GAS: 'Pierre_Gasly',
  OCO: 'Esteban_Ocon',
  ALB: 'Alexander_Albon',
  BOT: 'Valtteri_Bottas',
  ZHO: 'Zhou_Guanyu',
  TSU: 'Yuki_Tsunoda',
  LAW: 'Liam_Lawson',
  HUL: 'Nico_Hülkenberg',
  MAG: 'Kevin_Magnussen',
  BEA: 'Oliver_Bearman',
  ANT: 'Andrea_Kimi_Antonelli',
  HAD: 'Isack_Hadjar',
  COL: 'Franco_Colapinto',
  BOR: 'Gabriel_Bortoleto',
}

/**
 * Maps constructor names from Ergast to their Wikipedia article names.
 */
export const TEAM_WIKI_NAMES: Record<string, string> = {
  Mercedes: 'Mercedes-AMG_Petronas_F1_Team',
  Ferrari: 'Scuderia_Ferrari',
  'Red Bull': 'Red_Bull_Racing',
  'Red Bull Racing': 'Red_Bull_Racing',
  McLaren: 'McLaren_F1_Team',
  'Aston Martin': 'Aston_Martin_in_Formula_One',
  'Aston Martin F1 Team': 'Aston_Martin_in_Formula_One',
  'Alpine F1 Team': 'Alpine_F1_Team',
  Alpine: 'Alpine_F1_Team',
  Williams: 'Williams_Racing',
  'RB F1 Team': 'RB_Formula_One_Team',
  'Visa Cash App RB': 'RB_Formula_One_Team',
  'Haas F1 Team': 'Haas_F1_Team',
  'Kick Sauber': 'Stake_F1_Team_Kick_Sauber',
  'Stake F1 Team': 'Stake_F1_Team_Kick_Sauber',
  Audi: 'Audi_in_Formula_One',
  'Cadillac F1 Team': 'Cadillac_F1_Team',
}

const WIKI_IMAGE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Fetches the thumbnail image URL for a Wikipedia article.
 * Returns null if the article has no image or the fetch fails -
 * callers must handle the null case with a fallback placeholder.
 *
 * Data source: Wikipedia REST `GET /page/summary/{title}`.
 *
 * @param articleName - Wikipedia article name with underscores
 * @returns Image URL string or null
 */
export async function getWikipediaImage(articleName: string): Promise<string | null> {
  return cached(
    `wiki_image_${articleName}`,
    async () => {
      try {
        const res = await fetch(`${WIKI_BASE}/${encodeURIComponent(articleName)}`)
        if (!res.ok) return null
        const data = (await res.json()) as { thumbnail?: { source?: string } }
        return data?.thumbnail?.source ?? null
      } catch {
        return null
      }
    },
    WIKI_IMAGE_TTL_MS
  )
}

/**
 * Fetches images for all drivers in a list concurrently.
 * Returns a map of driver_code → image URL (or null if unavailable).
 * Uses Promise.allSettled so one failed fetch doesn't block the rest.
 *
 * @param driverCodes - Array of 3-letter driver codes e.g. ['VER', 'HAM']
 * @returns Record of code → URL or null
 */
export async function getAllDriverImages(driverCodes: string[]): Promise<Record<string, string | null>> {
  const results = await Promise.allSettled(
    driverCodes.map(async (code) => {
      const wikiName = DRIVER_WIKI_NAMES[code]
      if (!wikiName) return [code, null] as const
      const url = await getWikipediaImage(wikiName)
      return [code, url] as const
    })
  )

  return Object.fromEntries(
    results
      .filter((r): r is PromiseFulfilledResult<[string, string | null]> => r.status === 'fulfilled')
      .map(r => r.value)
  )
}

/**
 * Same as getAllDriverImages but for teams.
 *
 * @param teamNames - Constructor names as returned by Ergast
 */
export async function getAllTeamImages(teamNames: string[]): Promise<Record<string, string | null>> {
  const results = await Promise.allSettled(
    teamNames.map(async (name) => {
      const wikiName = TEAM_WIKI_NAMES[name]
      if (!wikiName) return [name, null] as const
      const url = await getWikipediaImage(wikiName)
      return [name, url] as const
    })
  )

  return Object.fromEntries(
    results
      .filter((r): r is PromiseFulfilledResult<[string, string | null]> => r.status === 'fulfilled')
      .map(r => r.value)
  )
}
