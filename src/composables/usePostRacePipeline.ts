/**
 * usePostRacePipeline.ts
 *
 * Orchestrates the full post-race data load in the correct sequence.
 * Some calls can run in parallel, others depend on prior results.
 *
 * Load order (implemented here):
 * 1. In parallel: drivers, results, stints, pits, intervals, weather, raceControl
 * 2. After results: load laps for top 10 drivers (most relevant for charts)
 * 3. After raceControl: parse SC/VSC periods into usable lap ranges
 * 4. After all laps loaded: compute `raceStats` (includes venue, weather, championship snapshot for Gemini)
 * 5. UI components call `/api/generateRaceStory` and `/api/generateChartOneLiners` when ready
 */

import { ref, watch, type Ref, type MaybeRefOrGetter, toValue } from 'vue'
import { useRaceStore } from '@/stores/raceStore'
import type { RaceStats } from '@/api/claudeInsights'
import type { RaceControlMessage } from '@/types/openf1'
import { getDriverStandings } from '@/api/ergast'
import type { ErgastDriverStanding } from '@/api/ergast'
import { formatChampionshipSnapshot, summarizeWeather } from '@/lib/aiStoryContext'

export function usePostRacePipeline(
  sessionKey: Ref<number>,
  season: MaybeRefOrGetter<number>,
  round: MaybeRefOrGetter<number>
) {
  const store = useRaceStore()
  const loading = ref(true)
  const error = ref('')
  const progress = ref(0) // used to show a progress bar during load
  const raceStats = ref<RaceStats | null>(null)
  const scLaps = ref<number[]>([])
  const vscLaps = ref<number[]>([])
  const championshipStandingsSummary = ref('Championship standings unavailable.')

  /** Re-run when navigating to another race (new OpenF1 session key). */
  let lastProcessedSessionKey = 0

  watch(
    () => store.currentSession?.session_key ?? sessionKey.value,
    async (sk) => {
      // Wait until the parent view/store has loaded a real session key.
      if (!sk || sk <= 0) return
      if (lastProcessedSessionKey === sk) return
      lastProcessedSessionKey = sk
      raceStats.value = null

    try {
      const seasonN = toValue(season)
      /**
       * Important: RaceView already calls `store.loadRace()` via `useRaceData`.
       * Calling it again here doubles OpenF1 traffic (and causes 429 storms).
       *
       * This pipeline now assumes base race data is loaded by the view/store,
       * and only computes derived artifacts (SC/VSC + raceStats) once the store
       * has a session key and the needed arrays are present.
       */
      progress.value = 10

      // Load these only if they are still empty (avoid duplicate OpenF1 calls).
      if (store.intervals.length === 0) await store.loadIntervals(sk)
      progress.value = 25
      if (store.weather.length === 0) await store.loadWeather(sk)
      progress.value = 35
      if (store.raceControl.length === 0) await store.loadRaceControl(sk)
      progress.value = 45

      // Step 2 - parse SC/VSC periods from race control messages
      // before loading laps so charts are ready to mark them immediately
      scLaps.value = parseSafetyCarLaps(store.raceControl)
      vscLaps.value = parseVscLaps(store.raceControl)
      progress.value = 55

      // Step 3 - championship snapshot for Gemini (non-fatal if Ergast fails)
      championshipStandingsSummary.value = 'Championship standings unavailable.'
      try {
        const ds = (await getDriverStandings(seasonN)) as {
          MRData?: { StandingsTable?: { StandingsLists?: Array<{ DriverStandings?: ErgastDriverStanding[] }> } }
        }
        const rows = ds?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? []
        championshipStandingsSummary.value = formatChampionshipSnapshot(rows)
      } catch {
        // Ergast can fail independently of OpenF1; story generation still works without standings.
      }

      progress.value = 100
    } catch (e) {
      error.value = 'Failed to load race data. Please try again.'
      // eslint-disable-next-line no-console
      console.error('usePostRacePipeline error:', e)
    } finally {
      loading.value = false
    }
    },
    { immediate: true }
  )

  /**
   * Race stats for Gemini only after laps, stints, and pits are present.
   * RaceView loads laps asynchronously after loadRace; without this guard,
   * raceStats was computed with empty laps and the story failed.
   */
  watch(
    () => ({
      sk: store.currentSession?.session_key ?? 0,
      resultsLen: store.results.length,
      lapDrivers: Object.keys(store.laps).length,
      stintsLen: store.stints.length,
      pitsLen: store.pits.length,
      champ: championshipStandingsSummary.value,
    }),
    () => {
      const sk = store.currentSession?.session_key
      if (!sk || sk <= 0) return
      const seasonN = toValue(season)
      const roundN = toValue(round)
      const needLaps = Math.min(10, Math.max(store.results.length, 1))
      const ready =
        store.results.length > 0 &&
        Object.keys(store.laps).length >= needLaps &&
        store.stints.length > 0 &&
        store.pits.length > 0
      if (!ready) {
        raceStats.value = null
        return
      }
      try {
        scLaps.value = parseSafetyCarLaps(store.raceControl)
        raceStats.value = computeRaceStats(
          store,
          seasonN,
          roundN,
          scLaps.value,
          championshipStandingsSummary.value
        )
      } catch (e) {
        raceStats.value = null
        // eslint-disable-next-line no-console
        console.error('usePostRacePipeline computeRaceStats:', e)
      }
    },
    { deep: true, immediate: true }
  )

  return { loading, error, progress, raceStats, scLaps, vscLaps }
}

/**
 * Parses race control messages to extract lap numbers where the
 * safety car was deployed. Finds "SafetyCar" category messages
 * with flag "DEPLOYED" (start) and "CLEAR" (end), then fills in
 * the lap range between them.
 */
function parseSafetyCarLaps(raceControl: RaceControlMessage[]): number[] {
  const { scRanges } = parseSafetyCarRanges(raceControl)
  const laps: number[] = []
  for (const r of scRanges) {
    for (let l = r.start; l <= r.end; l++) laps.push(l)
  }
  return Array.from(new Set(laps)).sort((a, b) => a - b)
}

/**
 * Same as above but for Virtual Safety Car periods.
 * VSC is detected by the start message containing "VIRTUAL" while still using
 * the DEPLOYED/CLEAR flags to define the period boundaries.
 */
function parseVscLaps(raceControl: RaceControlMessage[]): number[] {
  const { vscRanges } = parseSafetyCarRanges(raceControl)
  const laps: number[] = []
  for (const r of vscRanges) {
    for (let l = r.start; l <= r.end; l++) laps.push(l)
  }
  return Array.from(new Set(laps)).sort((a, b) => a - b)
}

/**
 * Parses OpenF1 race control messages into SC and VSC lap ranges.
 *
 * Data source: OpenF1 `race_control` endpoint (via store.loadRaceControl()).
 *
 * Why: we follow your hint precisely for period boundaries:
 * - start when `category === "SafetyCar"` and `flag === "DEPLOYED"`
 * - end when `category === "SafetyCar"` and `flag === "CLEAR"`
 * Then we classify the period as VSC if the *start* message contains "VIRTUAL".
 *
 * Returns: { scRanges, vscRanges } where each range is inclusive { start, end } laps.
 */
function parseSafetyCarRanges(raceControl: RaceControlMessage[]): {
  scRanges: Array<{ start: number; end: number }>
  vscRanges: Array<{ start: number; end: number }>
} {
  const scRanges: Array<{ start: number; end: number }> = []
  const vscRanges: Array<{ start: number; end: number }> = []

  let current: { start: number; isVsc: boolean } | null = null

  for (const m of raceControl || []) {
    if (m.category !== 'SafetyCar') continue

    // DEPLOYED marks the start of the period.
    if (m.flag === 'DEPLOYED') {
      if (m.lap_number == null) continue
      const isVsc = /VIRTUAL/i.test(m.message)
      current = { start: m.lap_number, isVsc }
      continue
    }

    // CLEAR marks the end of the current period.
    if (m.flag === 'CLEAR' && current) {
      const end = m.lap_number ?? current.start
      if (current.isVsc) vscRanges.push({ start: current.start, end })
      else scRanges.push({ start: current.start, end })
      current = null
    }
  }

  return { scRanges, vscRanges }
}

/**
 * Builds the RaceStats object from store data.
 * This is the structured summary we pass to Claude via the serverless function.
 * All computation happens here so the backend receives clean, summarised numbers.
 *
 * Aggregation rules:
 * - pacingRanking: top 10 drivers by median clean lap time (exclude drivers with <5 valid laps)
 * - pitRanking: total pit duration + stop count per driver (filter out pit stops > 60s as outliers)
 * - biggestGainers: grid position - finish position (positive = gained positions)
 * - biggestLosers: finish position - grid position (negative values)
 * - safetyCarLaps: already computed from raceControl messages
 * - topSpeed: taken from car telemetry if available (drs >= 8, throttle >= 95)
 * - strategies: all stints per driver formatted as readable tyre strategy (e.g. "Hard (10L) → Medium (15L)")
 */
function computeRaceStats(
  store: ReturnType<typeof useRaceStore>,
  season: number,
  round: number,
  safetyCarLaps: number[],
  championshipStandingsSummary: string
): RaceStats {
  // Get winner and race name from results
  const winner = store.results[0]
  if (!winner) {
    throw new Error('No race results available - cannot compute RaceStats')
  }

  const session = store.currentSession
  const raceName = session?.circuit_short_name || `Round ${round}`
  const circuitName = session?.circuit_short_name || raceName
  const country = session?.country_name ?? ''
  const location = session?.location ?? ''
  const weatherSummary = summarizeWeather(store.weather ?? [])
  const winnerName = `${winner.Driver.givenName} ${winner.Driver.familyName}`
  const winnerTeam = winner.Constructor.name

  // Total laps: find the race duration in the results
  // Use the winner's lap count (they completed the race)
  const totalLaps = parseInt(winner.laps) || 0

  // Fastest lap: search all loaded laps for the minimum lap duration across all drivers
  let fastestLapTime = 999999
  let fastestLapDriver = 'Unknown'
  for (const [driverNum, laps] of Object.entries(store.laps)) {
    for (const lap of laps || []) {
      if (lap.lap_duration && lap.lap_duration > 0 && !lap.is_pit_out_lap) {
        if (lap.lap_duration < fastestLapTime) {
          fastestLapTime = lap.lap_duration
          const result = store.results.find(r => parseInt(r.Driver.permanentNumber) === parseInt(driverNum))
          fastestLapDriver = result ? result.Driver.code : `#${driverNum}`
        }
      }
    }
  }
  // Format fastest lap time as M:SS.sss
  const fastestLapTimeStr = fastestLapTime === 999999 ? 'N/A' : formatLapTime(fastestLapTime)

  // Pace ranking: top 10 drivers by median clean lap time
  // Clean laps: filter out outliers (pit stops, safety car, etc.)
  // Only include drivers with at least 5 valid laps
  const paceRanking: RaceStats['pacingRanking'] = []
  const driverPaces: Array<{
    driver: string
    code: string
    avgPace: number
  }> = []
  for (const result of store.results) {
    const driverNum = parseInt(result.Driver.permanentNumber)
    const driverLaps = store.laps[driverNum] || []
    const validLaps = driverLaps
      .filter(l => l.lap_duration && l.lap_duration > 0 && !l.is_pit_out_lap)
      .map(l => l.lap_duration as number)
    if (validLaps.length < 5) continue

    // Sort and find median
    const sorted = [...validLaps].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2

    // Filter outliers: keep laps within median + 2 seconds
    const clean = validLaps.filter(t => t <= median + 2)
    const avg = clean.reduce((a, b) => a + b, 0) / clean.length

    driverPaces.push({
      driver: `${result.Driver.givenName.charAt(0)}. ${result.Driver.familyName}`,
      code: result.Driver.code,
      avgPace: avg,
    })
  }
  // Sort by average pace and take top 10
  driverPaces.sort((a, b) => a.avgPace - b.avgPace)
  for (const dp of driverPaces.slice(0, 10)) {
    paceRanking.push({
      driver: dp.code,
      avgPace: parseFloat(dp.avgPace.toFixed(3)),
    })
  }

  // Pit stop ranking: total pit time + stop count per driver
  const pitRanking: RaceStats['pitRanking'] = []
  const driverPits: Record<number, { totalTime: number; stops: number }> = {}
  for (const pit of store.pits || []) {
    if (!pit.pit_duration || pit.pit_duration > 60) continue // Filter outliers
    if (!driverPits[pit.driver_number]) driverPits[pit.driver_number] = { totalTime: 0, stops: 0 }
    driverPits[pit.driver_number].totalTime += pit.pit_duration
    driverPits[pit.driver_number].stops += 1
  }
  // Build ranking
  for (const [driverNum, pits] of Object.entries(driverPits)) {
    const result = store.results.find(r => parseInt(r.Driver.permanentNumber) === parseInt(driverNum))
    if (result) {
      pitRanking.push({
        driver: result.Driver.code,
        totalPitTime: parseFloat(pits.totalTime.toFixed(2)),
        stops: pits.stops,
      })
    }
  }
  pitRanking.sort((a, b) => a.totalPitTime - b.totalPitTime)

  // Biggest movers: grid vs finish position
  const biggestGainers: RaceStats['biggestGainers'] = []
  const biggestLosers: RaceStats['biggestLosers'] = []
  for (const result of store.results) {
    const grid = parseInt(result.grid)
    const finish = parseInt(result.position)
    if (isNaN(grid) || isNaN(finish) || grid === 0) continue
    const delta = grid - finish // positive = moved forward
    if (delta > 0) {
      biggestGainers.push({ driver: result.Driver.code, delta })
    } else if (delta < 0) {
      // Store as negative number (e.g., -3 means lost 3 positions)
      biggestLosers.push({ driver: result.Driver.code, delta })
    }
  }
  biggestGainers.sort((a, b) => b.delta - a.delta)
  biggestLosers.sort((a, b) => a.delta - b.delta) // sort by most negative first

  // Top speed: from car telemetry (if loaded)
  let topSpeed: RaceStats['topSpeed'] = { driver: 'N/A', speed: 0 }
  for (const [driverNumStr, samples] of Object.entries(store.carData)) {
    for (const s of samples || []) {
      if (s.speed && s.drs && s.throttle && s.drs >= 8 && s.throttle >= 95 && !s.brake) {
        if (s.speed > topSpeed.speed) {
          const result = store.results.find(r => parseInt(r.Driver.permanentNumber) === parseInt(driverNumStr))
          topSpeed = {
            driver: result ? result.Driver.code : `#${driverNumStr}`,
            speed: parseFloat(s.speed.toFixed(1)),
          }
        }
      }
    }
  }

  // Tyre strategies: all stints per driver formatted as readable string
  const strategies: RaceStats['strategies'] = []
  const driverStints: Record<number, { compounds: string[]; laps: number[] }> = {}
  for (const stint of store.stints || []) {
    if (!driverStints[stint.driver_number]) {
      driverStints[stint.driver_number] = { compounds: [], laps: [] }
    }
    driverStints[stint.driver_number].compounds.push(stint.compound)
    driverStints[stint.driver_number].laps.push(stint.lap_end - stint.lap_start + 1)
  }
  // Format as "Hard (10L) → Medium (15L)" etc
  for (const [driverNum, stintData] of Object.entries(driverStints)) {
    const result = store.results.find(r => parseInt(r.Driver.permanentNumber) === parseInt(driverNum))
    if (result) {
      const strategyStr = stintData.compounds
        .map((c, i) => `${c} (${stintData.laps[i]}L)`)
        .join(' → ')
      strategies.push({
        driver: result.Driver.code,
        strategy: strategyStr,
      })
    }
  }

  return {
    raceName,
    season,
    round,
    winner: winnerName,
    winnerTeam,
    totalLaps,
    fastestLapDriver,
    fastestLapTime: fastestLapTimeStr,
    pacingRanking: paceRanking,
    pitRanking,
    biggestGainers,
    biggestLosers,
    safetyCarLaps,
    topSpeed,
    strategies,
    circuitName,
    country,
    location,
    weatherSummary,
    championshipStandingsSummary,
  }
}

/**
 * Formats a lap time in seconds to M:SS.sss format.
 * Example: 95.234 seconds → "1:35.234"
 */
function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(3).padStart(7, '0')}`
}
