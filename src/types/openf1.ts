/**
 * src/types/openf1.ts
 *
 * Centralized OpenF1 API response types for PitWall.
 *
 * Why this file exists:
 * - Phase 3 introduces multiple new telemetry + breakdown charts.
 * - We need a single, documented source of truth for response shapes.
 * - We avoid leaking `any` into the rest of the codebase.
 *
 * Note:
 * - These interfaces model the fields PitWall uses today.
 * - OpenF1 can return additional fields; we intentionally keep this lean.
 */

/**
 * OpenF1 `/car_data` response shape.
 *
 * Data source: `GET https://api.openf1.org/v1/car_data?...`
 *
 * Each row is one telemetry sample (roughly ~4 samples/second).
 * `speed` is in km/h.
 */
export interface CarDataSample {
  date: string // ISO 8601 timestamp
  driver_number: number
  rpm: number | null
  speed: number | null // km/h
  n_gear: number | null // 1–8, 0 can appear as neutral depending on feed
  throttle: number | null // 0–100
  brake: boolean | null
  drs: number | null // 0=closed, 8=eligible, 10/12/14=open (varies by track)
  lap_number?: number | null
  session_key?: number | null
}

/**
 * OpenF1 `/intervals` response shape.
 *
 * Data source: `GET https://api.openf1.org/v1/intervals?...`
 *
 * `gap_to_leader` is often a string (e.g. "+5.234" or "1 LAP").
 * We keep it as-is and only parse it at the chart/insight layer.
 */
export interface IntervalSample {
  date: string
  driver_number: number
  gap_to_leader: string | number
  interval_to_position_ahead: number | null
  lap_number?: number | null
  session_key?: number | null
}

/**
 * OpenF1 `/weather` response shape.
 *
 * Data source: `GET https://api.openf1.org/v1/weather?...`
 */
export interface WeatherSample {
  date: string
  air_temperature: number | null // °C
  track_temperature: number | null // °C
  humidity: number | null // %
  pressure: number | null // mbar
  wind_speed: number | null // km/h (OpenF1 commonly reports km/h)
  wind_direction: number | null // degrees
  rainfall: boolean | null
  session_key?: number | null
}

/**
 * OpenF1 `/race_control` response shape.
 *
 * Data source: `GET https://api.openf1.org/v1/race_control?...`
 *
 * Notes:
 * - For Safety Car messages, OpenF1 uses `flag` values like "DEPLOYED" and "CLEAR".
 * - For track flags, values like "GREEN", "YELLOW", "RED", etc.
 */
export interface RaceControlMessage {
  date: string
  lap_number: number | null
  category: 'Flag' | 'SafetyCar' | 'Drs' | 'Other'
  message: string
  flag:
    | 'GREEN'
    | 'YELLOW'
    | 'DOUBLE YELLOW'
    | 'RED'
    | 'CHEQUERED'
    | 'DEPLOYED'
    | 'CLEAR'
    | null
  scope: 'Track' | 'Sector' | 'Driver' | null
  sector: number | null
  session_key?: number | null
}

/**
 * OpenF1 `/laps` response shape.
 *
 * Data source: `GET https://api.openf1.org/v1/laps?...`
 *
 * Notes:
 * - `st_speed` is the speed trap reading (km/h) for a lap.
 * - `date_start` is used to define lap time windows for telemetry filtering.
 */
export interface LapData {
  date_start: string | null
  driver_number: number
  lap_number: number
  lap_duration: number | null // seconds; null if lap incomplete
  duration_sector_1: number | null
  duration_sector_2: number | null
  duration_sector_3: number | null
  i1_speed: number | null
  i2_speed: number | null
  st_speed: number | null // km/h
  is_pit_out_lap: boolean
  session_key?: number | null
}

/**
 * OpenF1 `/stints` response shape.
 *
 * Data source: `GET https://api.openf1.org/v1/stints?...`
 */
export interface StintData {
  driver_number: number
  stint_number: number
  lap_start: number
  lap_end: number
  compound: 'SOFT' | 'MEDIUM' | 'HARD' | 'INTERMEDIATE' | 'WET' | string
  tyre_age_at_start: number | null
  session_key?: number | null
}

/**
 * Aliases for names used in the legacy openf1Types.ts module.
 * These allow files that imported from @/api/openf1Types to use the
 * same type names after migrating to this canonical type file.
 */
export type IntervalData = IntervalSample
export type WeatherData = WeatherSample

