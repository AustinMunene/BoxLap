import { cached } from './cache'
import { getSeasonRaces } from './ergast'
import type { CarDataSample } from '../types/openf1'

const BASE = 'https://api.openf1.org/v1'

/**
 * OpenF1 request queue — sequential with a fixed gap after each request completes.
 * Free tier ~4 req/s; 260ms spacing keeps us safely under the limit even when
 * many callers enqueue work at once. Cache hits bypass the network path in
 * `cached()` and never enter this queue.
 */
const REQUEST_DELAY_MS = 260
let requestQueue: Promise<void> = Promise.resolve()

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Enqueue work so only one OpenF1 fetch runs at a time, with delay after completion.
 */
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const result = requestQueue.then(() => fn())
  requestQueue = result
    .then(() => delay(REQUEST_DELAY_MS))
    .catch(() => delay(REQUEST_DELAY_MS))
  return result
}

/** Max extra attempts after HTTP 429 (each waits for Retry-After or backoff). */
const OPENF1_MAX_429_RETRIES = 6

function parseRetryAfterSeconds(res: Response): number | null {
  const h = res.headers.get('retry-after')
  if (!h) return null
  const asInt = parseInt(h, 10)
  if (!Number.isNaN(asInt)) return Math.max(0, asInt)
  const when = Date.parse(h)
  if (!Number.isNaN(when)) return Math.max(0, (when - Date.now()) / 1000)
  return null
}

/**
 * One JSON GET with bounded 429 handling (Retry-After or exponential backoff).
 * Wrapped by `queued()` via `get()` so concurrent callers serialize.
 */
async function fetchOpenF1JsonOnce<T>(url: string): Promise<T> {
  let rateLimitRetries = 0

  for (;;) {
    const res = await fetch(url)

    if (res.status === 429) {
      if (rateLimitRetries >= OPENF1_MAX_429_RETRIES) {
        const error = new Error(`OpenF1 API error: 429 ${url}`) as Error & { status?: number; url?: string }
        error.status = 429
        error.url = url
        throw error
      }
      const fromHeader = parseRetryAfterSeconds(res)
      const backoffSec = fromHeader ?? Math.min(45, 2 ** rateLimitRetries)
      await delay(backoffSec * 1000 + Math.floor(Math.random() * 250))
      rateLimitRetries++
      continue
    }

    if (!res.ok) {
      const error = new Error(`OpenF1 API error: ${res.status} ${url}`) as Error & {
        status?: number
        url?: string
      }
      error.status = res.status
      error.url = url
      throw error
    }

    return res.json() as Promise<T>
  }
}

function fetchOpenF1Json<T>(url: string): Promise<T> {
  return queued(() => fetchOpenF1JsonOnce<T>(url))
}

/**
 * Generic GET for OpenF1: queued + JSON parse.
 *
 * @param url Full API endpoint URL
 * @returns Parsed JSON response
 * @throws Error with status and url properties if request fails
 */
async function get<T>(url: string): Promise<T> {
  return fetchOpenF1Json<T>(url)
}

export const getLaps = (sessionKey: number, driverNumber: number) =>
  cached(`laps-${sessionKey}-${driverNumber}`, () =>
    get(`${BASE}/laps?session_key=${sessionKey}&driver_number=${driverNumber}`)
  )

export const getStints = (sessionKey: number) =>
  cached(`stints-${sessionKey}`, () =>
    get(`${BASE}/stints?session_key=${sessionKey}`)
  )

export const getPitStops = (sessionKey: number) =>
  cached(`pits-${sessionKey}`, () =>
    get(`${BASE}/pit?session_key=${sessionKey}`)
  )

export const getDrivers = (sessionKey: number) =>
  cached(`drivers-${sessionKey}`, () =>
    get(`${BASE}/drivers?session_key=${sessionKey}`)
  )

export const getPositions = (sessionKey: number) =>
  cached(`positions-${sessionKey}`, () =>
    get(`${BASE}/position?session_key=${sessionKey}`)
  )

export const getSessions = (year: number) =>
  cached(`sessions-${year}`, () =>
    get(`${BASE}/sessions?year=${year}&session_type=Race`)
  )

export const getAllRaceDrivers = async (sessionKey: number): Promise<RaceDriver[]> => {
  return cached(`race-drivers-${sessionKey}`, () =>
    get<RaceDriver[]>(`${BASE}/drivers?session_key=${sessionKey}`)
  )
}

export interface Lap {
  session_key: number
  driver_number: number
  lap_number: number
  lap_duration: number | null
  duration_sector_1: number | null
  duration_sector_2: number | null
  duration_sector_3: number | null
  is_pit_out_lap: boolean
  date_start: string
  /** OpenF1 segment status codes per mini sector (qualifying). */
  segments_sector_1?: number[] | null
  segments_sector_2?: number[] | null
  segments_sector_3?: number[] | null
}

export interface Stint {
  session_key: number
  driver_number: number
  stint_number: number
  lap_start: number
  lap_end: number
  compound: string
  tyre_age_at_start: number
}

export interface PitStop {
  session_key: number
  driver_number: number
  lap_number: number
  pit_duration: number
  date: string
}

export interface RaceDriver {
  session_key: number
  driver_number: number
  broadcast_name: string
  full_name: string
  name_acronym: string
  team_name: string
  team_colour: string
  first_name: string
  last_name: string
  headshot_url: string
  country_code: string
}

export interface Position {
  session_key: number
  driver_number: number
  date: string
  position: number
}

export interface Session {
  session_key: number
  session_name: string
  session_type: string
  date_start: string
  date_end: string
  gmt_offset: string
  location: string
  country_name: string
  circuit_short_name: string
  year: number
  meeting_key: number
  /** When present, matches Ergast championship round (1-based). Prefer over array index. */
  round_number?: number
}

/**
 * All session rows for a season (any session type). Used for home “next weekend” UI.
 *
 * Data source: OpenF1 `GET /sessions?year={year}`
 */
export const getAllSessionsForYear = (year: number) =>
  cached(`sessions-all-${year}`, () => get<Session[]>(`${BASE}/sessions?year=${year}`))
/**
 * Returns the OpenF1 Qualifying session for a given championship round (1-based).
 *
 * Data source: OpenF1 `/sessions?year=` filtered to `session_type === 'Qualifying'`,
 * ordered by `date_start` so index aligns with Ergast round order for typical calendars.
 */
export async function getQualifyingSession(year: number, round: number): Promise<Session | null> {
  const all = (await getAllSessionsForYear(year)) as Session[]
  const quali = all
    .filter(s => s.session_type === 'Qualifying')
    .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())

  const byRound = quali.find(s => s.round_number === round)
  if (byRound) return byRound

  const idx = round - 1
  if (idx >= 0 && idx < quali.length) return quali[idx] ?? null

  const racesResp = (await getSeasonRaces(year)) as {
    MRData?: { RaceTable?: { Races?: Array<{ round: string; date: string }> } }
  }
  const races = racesResp.MRData?.RaceTable?.Races
  const ergastRace = Array.isArray(races) ? races.find(r => parseInt(r.round, 10) === round) : undefined
  const raceDate = ergastRace?.date
  if (!raceDate || !quali.length) return null

  const t = new Date(raceDate).getTime()
  const sorted = [...quali].sort(
    (a, b) =>
      Math.abs(new Date(a.date_start).getTime() - t) -
      Math.abs(new Date(b.date_start).getTime() - t)
  )
  return sorted[0] ?? null
}

export async function getUpcomingWeekendSessions(): Promise<Session[]> {
  const year = new Date().getFullYear()
  const nowIso = new Date().toISOString()
  let sessions: Session[] = []
  try {
    sessions = (await getAllSessionsForYear(year)) as Session[]
  } catch {
    return []
  }
  const upcoming = sessions.filter(s => s.date_start >= nowIso)
  if (upcoming.length === 0) return []

  const byMeeting = new Map<string, Session[]>()
  for (const s of upcoming) {
    const key =
      s.meeting_key != null
        ? String(s.meeting_key)
        : `${s.year}-${s.circuit_short_name ?? ''}-${s.location ?? ''}`
    const arr = byMeeting.get(key)
    if (arr) arr.push(s)
    else byMeeting.set(key, [s])
  }

  const firstGroup = Array.from(byMeeting.values())[0] ?? []
  return firstGroup.sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
  )
}

/**
 * Fetches car telemetry data for a specific driver in a session.
 *
 * Returns time-series data sampled ~3.7 times per second. Each entry includes:
 * - `date`: ISO timestamp for the sample
 * - `driver_number`: integer driver number
 * - `rpm`: engine rpm at sample
 * - `speed`: speed in km/h
 * - `n_gear`: gearbox gear (number or null)
 * - `throttle`: 0-100 throttle percentage
 * - `brake`: boolean whether brake pedal is applied
 * - `drs`: numeric DRS state (0,8,10,12,14) where higher values indicate DRS open
 *
 * Useful for: speed trap comparisons, throttle/brake analysis, DRS usage.
 * Endpoint: GET /car_data?session_key=...&driver_number=...
 */
export const getCarData = (sessionKey: number, driverNumber: number) =>
  cached(`car_data_${sessionKey}_${driverNumber}`, () =>
    get(`${BASE}/car_data?session_key=${sessionKey}&driver_number=${driverNumber}`)
  )

/**
 * Fetches car telemetry data scoped to a specific time window.
 *
 * Data source: OpenF1 /car_data
 * Unlike getCarData() which fetches the full session (~20,000 samples),
 * this function passes date_gt and date_lt as query params to let
 * OpenF1 filter server-side. A single lap is ~200-400 samples -
 * well within the free tier limit that causes the 422 error.
 *
 * The date params use OpenF1's supported filter syntax:
 *   date_gt = samples strictly after this ISO timestamp
 *   date_lt = samples strictly before this ISO timestamp
 *
 * @param sessionKey - OpenF1 session key
 * @param driverNumber - Driver's car number
 * @param lapStart - ISO timestamp of lap start (from LapData.date_start)
 * @param lapEnd - ISO timestamp of next lap start (or null for final lap)
 * @returns CarDataSample[] scoped to the lap window
 */
export const getCarDataForLap = (
  sessionKey: number,
  driverNumber: number,
  lapStart: string,
  lapEnd: string | null
): Promise<CarDataSample[]> => {
  // Build the cache key including the lap window so different laps
  // are cached independently and don't overwrite each other
  const cacheKey = `car_data_lap_${sessionKey}_${driverNumber}_${lapStart}`

  return cached(cacheKey, () => {
    // Build query params - always include session and driver
    let url = `${BASE}/car_data?session_key=${sessionKey}&driver_number=${driverNumber}&date>${lapStart}`

    // Only add the upper bound if we have a next lap start time.
    // For the final lap of a race we omit date_lt and let OpenF1
    // return everything from lapStart to end of session.
    if (lapEnd) {
      url += `&date<${lapEnd}`
    }

    return get<CarDataSample[]>(url)
  })
}

/**
 * Fetches the gap data between cars throughout the race.
 *
 * Each entry includes:
 * - `date`: ISO timestamp for the sample
 * - `driver_number`: integer driver number
 * - `gap_to_leader`: string like "+5.234" or "1 LAP"
 * - `interval_to_position_ahead`: numeric seconds to the car directly ahead
 *
 * Useful for: gap evolution charts, undercut/overcut windows, battle detection.
 * Endpoint: GET /intervals?session_key=...
 */
export const getIntervals = (sessionKey: number) =>
  cached(`intervals_${sessionKey}`, () =>
    get(`${BASE}/intervals?session_key=${sessionKey}`)
  )

/**
 * Fetches weather data sampled throughout the session.
 *
 * Each entry includes: `date`, `air_temperature`, `track_temperature`,
 * `humidity`, `pressure`, `wind_speed`, `wind_direction`, `rainfall` (boolean).
 * Useful for correlating lap time changes with track temperature evolution
 * and explaining tyre behaviour shifts mid-race.
 * Endpoint: GET /weather?session_key=...
 */
export const getWeather = (sessionKey: number) =>
  cached(`weather_${sessionKey}`, () =>
    get(`${BASE}/weather?session_key=${sessionKey}`)
  )

/**
 * Fetches race control messages throughout the session.
 *
 * Each entry includes: `date`, `lap_number`, `category`, `message`, `flag`, `scope`, `sector`.
 * - `category` examples: Flag, SafetyCar, Drs, Other
 * - `flag` examples: GREEN, YELLOW, DOUBLE YELLOW, RED, CHEQUERED, CLEAR
 * Useful for marking SC/VSC periods on charts, DRS enabled laps,
 * and explaining sudden lap time spikes.
 * Endpoint: GET /race_control?session_key=...
 */
export const getRaceControl = (sessionKey: number) =>
  cached(`race_control_${sessionKey}`, () =>
    get(`${BASE}/race_control?session_key=${sessionKey}`)
  )

