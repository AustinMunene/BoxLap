import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getLaps,
  getStints,
  getPitStops,
  getDrivers,
  getPositions,
  getSessions,
  getCarData,
  getCarDataForLap,
  getIntervals,
  getWeather,
  getRaceControl,
} from '@/api/openf1'
import type { CarDataSample, IntervalData, WeatherData, RaceControlMessage } from '@/types/openf1'
import { getRaceResults } from '@/api/ergast'
import type { Lap, Stint, PitStop, RaceDriver, Position, Session } from '@/api/openf1'
import type { ErgastRaceResult } from '@/api/ergast'

/**
 * Converts time-series speed data to distance-series by integrating
 * speed over time (distance += speed_ms * delta_t).
 *
 * We do this because OpenF1's free tier does not provide GPS coordinates.
 * The result is an approximation - accuracy is sufficient for driver
 * comparison but not for absolute track position mapping.
 *
 * speed is in km/h → convert to m/s by dividing by 3.6
 * delta_t is the difference in seconds between consecutive samples
 *
 * @param samples - CarDataSample[] ordered by date ascending
 * @returns The same array with distance_m added to each sample
 */
/**
 * Resolves the OpenF1 race session for an Ergast round. Prefer `round_number`
 * on the session row; never rely on array index alone.
 */
function resolveRaceSessionForRound(
  sessionsData: Session[],
  round: number,
  ergastRaceDate: string | undefined
): Session | null {
  if (!sessionsData?.length) return null

  const byRound = sessionsData.find(s => s.round_number === round)
  if (byRound) return byRound

  if (ergastRaceDate) {
    const t = new Date(ergastRaceDate).getTime()
    const sorted = [...sessionsData].sort(
      (a, b) =>
        Math.abs(new Date(a.date_start).getTime() - t) -
        Math.abs(new Date(b.date_start).getTime() - t)
    )
    return sorted[0] ?? null
  }

  const idx = round - 1
  if (idx >= 0 && idx < sessionsData.length) return sessionsData[idx] ?? null
  return sessionsData[sessionsData.length - 1] ?? null
}

function computeDistanceFromSpeed(
  samples: CarDataSample[]
): Array<CarDataSample & { distance_m: number }> {
  let distance = 0
  return samples.map((sample, i) => {
    if (i === 0) return { ...sample, distance_m: 0 }
    const prev = samples[i - 1]
    const deltaT = Math.max(
      0,
      (new Date(sample.date).getTime() - new Date(prev.date).getTime()) / 1000
    )
    const speedMs = (sample.speed ?? 0) / 3.6
    distance += speedMs * deltaT
    return { ...sample, distance_m: Math.round(distance) }
  })
}

export const useRaceStore = defineStore('race', () => {
  const results = ref<ErgastRaceResult[]>([])
  const laps = ref<Record<number, Lap[]>>({})
  const stints = ref<Stint[]>([])
  const pits = ref<PitStop[]>([])
  const drivers = ref<RaceDriver[]>([])
  const positions = ref<Position[]>([])
  const sessions = ref<Session[]>([])
  const currentSession = ref<Session | null>(null)

  const carData = ref<Record<number, CarDataSample[]>>({})

  /**
   * Filtered telemetry for a single lap, keyed by `${driverNumber}-${lapNumber}`.
   *
   * Data source: OpenF1 `/car_data`, filtered using lap timestamps from `/laps`.
   * Samples include integrated `distance_m` for chart X-axis.
   */
  const lapTelemetry = ref<Record<string, Array<CarDataSample & { distance_m: number }>>>({})

  const intervals = ref<IntervalData[]>([])
  const weather = ref<WeatherData[]>([])
  const raceControl = ref<RaceControlMessage[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadRace(season: number, round: number) {
    loading.value = true
    error.value = null
    try {
      const ergastData = (await getRaceResults(season, round)) as {
        MRData: {
          RaceTable: {
            Races: Array<{ Results: ErgastRaceResult[]; date?: string; round?: string }>
          }
        }
      }
      const races = ergastData?.MRData?.RaceTable?.Races
      let ergastRaceDate: string | undefined
      if (races && races.length > 0) {
        results.value = races[0].Results || []
        ergastRaceDate = races[0].date
      }

      const sessionsData = (await getSessions(season)) as Session[]
      sessions.value = sessionsData || []

      currentSession.value = resolveRaceSessionForRound(sessionsData || [], round, ergastRaceDate)

      if (currentSession.value) {
        const sk = currentSession.value.session_key
        const [stintsData, pitsData, driversData] = await Promise.all([
          getStints(sk) as Promise<Stint[]>,
          getPitStops(sk) as Promise<PitStop[]>,
          getDrivers(sk) as Promise<RaceDriver[]>,
        ])
        stints.value = Array.isArray(stintsData) ? stintsData : []
        pits.value = Array.isArray(pitsData) ? pitsData : []
        drivers.value = Array.isArray(driversData) ? driversData : []
      }
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 429) {
        error.value = 'Telemetry temporarily unavailable (OpenF1 rate limit). Please try again later.'
        // eslint-disable-next-line no-console
        console.warn('OpenF1 rate limit hit while loading race telemetry', err)
      } else {
        error.value = e instanceof Error ? e.message : 'Failed to load race data'
        console.error('loadRace error:', e)
      }
    } finally {
      loading.value = false
    }
  }

  async function loadLapsForDriver(sessionKey: number, driverNumber: number) {
    if (laps.value[driverNumber]?.length) return
    try {
      const data = (await getLaps(sessionKey, driverNumber)) as Lap[]
      laps.value = { ...laps.value, [driverNumber]: Array.isArray(data) ? data : [] }
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 404 || err.status === 429) {
        laps.value = { ...laps.value, [driverNumber]: [] }
        return
      }
      console.error(`loadLapsForDriver error for #${driverNumber}:`, e)
    }
  }

  async function loadCarData(sessionKey: number, driverNumber: number) {
    if (carData.value[driverNumber]?.length) return
    try {
      const raw = await getCarData(sessionKey, driverNumber)
      carData.value[driverNumber] = Array.isArray(raw) ? (raw as CarDataSample[]) : []
    } catch (e) {
      console.error(`loadCarData error for #${driverNumber}:`, e)
      carData.value[driverNumber] = []
    }
  }

  /**
   * Loads car telemetry for one driver filtered to a single lap.
   *
   * Data source: OpenF1 `/car_data`; window from `laps` via `date_start` / next lap.
   */
  /**
   * Loads car telemetry for one driver filtered to a single lap.
   *
   * Data source: OpenF1 `/car_data` with date_gt/date_lt params; window from
   * `laps` via `date_start` / next lap's `date_start`.
   * Samples include integrated `distance_m` for chart X-axis.
   *
   * We now pass the lap time window directly to OpenF1 as query params.
   * This replaces the previous pattern of fetching the full session (~20,000
   * samples) and filtering in JS - which caused HTTP 422 "too much data" errors.
   * OpenF1 returns ~200-400 samples for a single lap, well within free tier limits.
   */
  async function loadTelemetryForLap(sessionKey: number, driverNumber: number, lapNumber: number) {
    const key = `${driverNumber}-${lapNumber}`
    if ((lapTelemetry.value[key]?.length ?? 0) > 0) return

    try {
      const driverLaps = laps.value[driverNumber]
      if (!driverLaps?.length) {
        throw new Error(`No lap data available for driver ${driverNumber}. Lap data may still be loading.`)
      }

      const targetLap = driverLaps.find(l => l.lap_number === lapNumber)
      const nextLap = driverLaps.find(l => l.lap_number === lapNumber + 1)
      if (!targetLap?.date_start) {
        throw new Error(`Lap ${lapNumber} not found for driver ${driverNumber}. Available laps may not include this lap number.`)
      }

      const lapStart = targetLap.date_start
      const lapEnd = nextLap?.date_start ?? null

      const lapData = await getCarDataForLap(
        sessionKey,
        driverNumber,
        lapStart,
        lapEnd ?? null
      )

      // No JS filtering needed - OpenF1 already scoped the response to this lap.
      // We still compute distance_m via speed integration as before.
      const withDistance = computeDistanceFromSpeed(lapData)

      lapTelemetry.value = { ...lapTelemetry.value, [key]: withDistance }
    } catch (error: unknown) {
      /**
       * Log the full error for debugging. Do NOT silently swallow it -
       * an empty array here causes the UI to show "Select drivers to begin"
       * forever with no explanation. Better to surface the error.
       */
      console.error(`[raceStore] loadTelemetryForLap failed for driver ${driverNumber} lap ${lapNumber}:`, error)
      // Re-throw so TelemetryView can catch and show a user-facing error state
      throw error
    }
  }

  async function loadIntervals(sessionKey: number) {
    try {
      const raw = await getIntervals(sessionKey)
      intervals.value = Array.isArray(raw) ? (raw as IntervalData[]) : []
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 404 || err.status === 429) {
        intervals.value = []
        return
      }
      console.error('loadIntervals error:', e)
      intervals.value = []
    }
  }

  async function loadWeather(sessionKey: number) {
    try {
      const raw = await getWeather(sessionKey)
      weather.value = Array.isArray(raw) ? (raw as WeatherData[]) : []
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 404 || err.status === 429) {
        weather.value = []
        return
      }
      console.error('loadWeather error:', e)
      weather.value = []
    }
  }

  async function loadRaceControl(sessionKey: number) {
    try {
      const raw = await getRaceControl(sessionKey)
      raceControl.value = Array.isArray(raw) ? (raw as RaceControlMessage[]) : []
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 404 || err.status === 429) {
        raceControl.value = []
        return
      }
      console.error('loadRaceControl error:', e)
      raceControl.value = []
    }
  }

  async function loadPositions(sessionKey: number) {
    try {
      const data = (await getPositions(sessionKey)) as Position[]
      positions.value = Array.isArray(data) ? data : []
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 429) {
        return
      }
      console.error('loadPositions error:', e)
    }
  }

  function reset() {
    results.value = []
    laps.value = {}
    stints.value = []
    pits.value = []
    drivers.value = []
    positions.value = []
    carData.value = {}
    lapTelemetry.value = {}
    intervals.value = []
    weather.value = []
    raceControl.value = []
    currentSession.value = null
    error.value = null
  }

  return {
    results,
    laps,
    stints,
    pits,
    drivers,
    positions,
    carData,
    lapTelemetry,
    intervals,
    weather,
    raceControl,
    sessions,
    currentSession,
    loading,
    error,
    loadRace,
    loadLapsForDriver,
    loadCarData,
    loadTelemetryForLap,
    loadIntervals,
    loadWeather,
    loadRaceControl,
    loadPositions,
    reset,
  }
})
