import { cached } from './cache'

const BASE = 'https://api.openf1.org/v1'

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OpenF1 API error: ${res.status} ${url}`)
  return res.json()
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
}
