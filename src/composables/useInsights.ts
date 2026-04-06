import { computed } from 'vue'
import type { Ref } from 'vue'
import type { Lap, Stint, PitStop } from '@/api/openf1'
import type { CarDataSample, IntervalData, WeatherData, RaceControlMessage } from '@/types/openf1'
import type { ErgastRaceResult } from '@/api/ergast'

export interface Insight {
  icon: string
  title: string
  description: string
  type: 'pace' | 'strategy' | 'mover' | 'pit' | 'teammate'
  accent?: string
}

function median(vals: number[]): number {
  if (vals.length === 0) return 0
  const sorted = [...vals].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function cleanLaps(laps: Lap[]): number[] {
  const valid = laps
    .filter(l => l.lap_duration != null && l.lap_duration > 0 && !l.is_pit_out_lap)
    .map(l => l.lap_duration as number)

  if (valid.length === 0) return []
  const med = median(valid)
  return valid.filter(t => t <= med + 2)
}

function getRacePaceWinner(
  lapsData: Record<number, Lap[]>,
  results: ErgastRaceResult[]
): Insight | null {
  const driverMedians: Array<{ code: string; name: string; median: number }> = []

  for (const result of results) {
    const driverNum = parseInt(result.Driver.permanentNumber)
    const driverLaps = lapsData[driverNum]
    if (!driverLaps || driverLaps.length === 0) continue
    const clean = cleanLaps(driverLaps)
    if (clean.length < 5) continue
    const med = median(clean)
    driverMedians.push({
      code: result.Driver.code,
      name: `${result.Driver.givenName} ${result.Driver.familyName}`,
      median: med,
    })
  }

  if (driverMedians.length === 0) return null
  driverMedians.sort((a, b) => a.median - b.median)
  const winner = driverMedians[0]

  return {
    icon: '⚡',
    title: 'Race Pace Leader',
    description: `${winner.name} (${winner.code}) had the fastest median clean lap time at ${winner.median.toFixed(3)}s, edging out ${driverMedians[1]?.name ?? 'the field'} by ${(driverMedians[1]?.median - winner.median).toFixed(3)}s.`,
    type: 'pace',
    accent: '#E8002D',
  }
}

function getBiggestMover(results: ErgastRaceResult[]): Insight | null {
  if (results.length === 0) return null

  let biggest: { name: string; code: string; delta: number } | null = null

  for (const r of results) {
    const grid = parseInt(r.grid)
    const finish = parseInt(r.position)
    if (isNaN(grid) || isNaN(finish) || grid === 0) continue
    const delta = grid - finish // positive = moved forward
    if (!biggest || delta > biggest.delta) {
      biggest = {
        name: `${r.Driver.givenName} ${r.Driver.familyName}`,
        code: r.Driver.code,
        delta,
      }
    }
  }

  if (!biggest || biggest.delta <= 0) return null

  return {
    icon: '🚀',
    title: 'Biggest Mover',
    description: `${biggest.name} gained ${biggest.delta} position${biggest.delta !== 1 ? 's' : ''} during the race, making the most of their starting position.`,
    type: 'mover',
    accent: '#27F4D2',
  }
}

function getPitStopWinner(pits: PitStop[], results: ErgastRaceResult[]): Insight | null {
  if (pits.length === 0 || results.length === 0) return null

  const driverTotals: Record<number, number> = {}
  for (const p of pits) {
    if (!p.pit_duration || p.pit_duration > 60) continue
    driverTotals[p.driver_number] = (driverTotals[p.driver_number] || 0) + p.pit_duration
  }

  const entries = Object.entries(driverTotals)
    .map(([num, total]) => ({ driverNumber: parseInt(num), total }))
    .filter(e => e.total > 0)
    .sort((a, b) => a.total - b.total)

  if (entries.length === 0) return null

  const best = entries[0]
  const result = results.find(r => parseInt(r.Driver.permanentNumber) === best.driverNumber)
  if (!result) return null

  return {
    icon: '🔧',
    title: 'Fastest Pit Crew',
    description: `${result.Driver.givenName} ${result.Driver.familyName}'s team completed their pit stops in ${best.total.toFixed(2)}s total - the fastest pit wall of the race.`,
    type: 'pit',
    accent: '#FF8000',
  }
}

function getStrategyEffect(stints: Stint[], results: ErgastRaceResult[]): Insight | null {
  if (stints.length === 0 || results.length === 0) return null

  const compoundStarts: Record<string, number[]> = {}
  const driverFirstStint: Record<number, string> = {}

  for (const s of stints) {
    if (s.stint_number === 1) {
      driverFirstStint[s.driver_number] = s.compound
    }
  }

  for (const [driverNum, compound] of Object.entries(driverFirstStint)) {
    const result = results.find(r => parseInt(r.Driver.permanentNumber) === parseInt(driverNum))
    if (!result) continue
    const pos = parseInt(result.position)
    if (isNaN(pos)) continue
    if (!compoundStarts[compound]) compoundStarts[compound] = []
    compoundStarts[compound].push(pos)
  }

  const avgs = Object.entries(compoundStarts)
    .filter(([, positions]) => positions.length >= 2)
    .map(([compound, positions]) => ({
      compound,
      avg: positions.reduce((a, b) => a + b, 0) / positions.length,
      count: positions.length,
    }))
    .sort((a, b) => a.avg - b.avg)

  if (avgs.length < 2) return null
  const best = avgs[0]
  const worst = avgs[avgs.length - 1]

  return {
    icon: '📊',
    title: 'Strategy Insight',
    description: `Drivers starting on ${best.compound} averaged P${best.avg.toFixed(1)}, while ${worst.compound} starters averaged P${worst.avg.toFixed(1)}. Starting tyre choice had a ${(worst.avg - best.avg).toFixed(1)}-position impact on average finishing position.`,
    type: 'strategy',
    accent: '#FFC906',
  }
}

function getTeammateDeltas(
  lapsData: Record<number, Lap[]>,
  results: ErgastRaceResult[]
): Insight | null {
  if (results.length === 0) return null

  const teams: Record<string, ErgastRaceResult[]> = {}
  for (const r of results) {
    const team = r.Constructor.name
    if (!teams[team]) teams[team] = []
    teams[team].push(r)
  }

  const deltas: Array<{ team: string; driver1: string; driver2: string; delta: number }> = []

  for (const [team, drivers] of Object.entries(teams)) {
    if (drivers.length < 2) continue
    const [d1, d2] = drivers

    const laps1 = lapsData[parseInt(d1.Driver.permanentNumber)]
    const laps2 = lapsData[parseInt(d2.Driver.permanentNumber)]
    if (!laps1 || !laps2) continue

    const clean1 = cleanLaps(laps1)
    const clean2 = cleanLaps(laps2)
    if (clean1.length < 5 || clean2.length < 5) continue

    const med1 = median(clean1)
    const med2 = median(clean2)
    const delta = Math.abs(med1 - med2)
    const faster = med1 < med2 ? d1.Driver.code : d2.Driver.code

    deltas.push({ team, driver1: faster, driver2: med1 < med2 ? d2.Driver.code : d1.Driver.code, delta })
  }

  if (deltas.length === 0) return null
  deltas.sort((a, b) => b.delta - a.delta)
  const biggest = deltas[0]

  return {
    icon: '👥',
    title: 'Biggest Teammate Gap',
    description: `At ${biggest.team}, ${biggest.driver1} was ${biggest.delta.toFixed(3)}s per lap faster than ${biggest.driver2} on average clean laps - the biggest intra-team pace gap of the race.`,
    type: 'teammate',
    accent: '#B6BABD',
  }
}

export function useInsights(
  results: Ref<ErgastRaceResult[]>,
  lapsData: Ref<Record<number, Lap[]>>,
  stints: Ref<Stint[]>,
  pits: Ref<PitStop[]>
  // Optional additional telemetry and session-level data
  , carData?: Ref<Record<number, CarDataSample[]>>
  , raceControl?: Ref<RaceControlMessage[]>
  , weather?: Ref<WeatherData[]>
  , intervals?: Ref<IntervalData[]>
) {
  // Helper: safe unwrap optional refs
  const _carData = carData ? carData.value : {}
  const _raceControl = raceControl ? raceControl.value : []
  const _weather = weather ? weather.value : []
  const _intervals = intervals ? intervals.value : []

  /**
   * SPEED TRAP WINNER
   * Finds the highest recorded top speed from car_data across all loaded drivers.
   * Filters to only straight-line speed (DRS open = drs >= 8, throttle >= 95)
   * to avoid counting braking zones. Returns driver, topSpeed, lap (if available).
   */
  function getSpeedTrapWinner(carData: Record<number, CarDataSample[]>, drivers: ErgastRaceResult[]) {
    let best: { driver: string; topSpeed: number; lap: number | null } | null = null
    // Iterate each driver's telemetry samples
    for (const [driverNumStr, samples] of Object.entries(carData)) {
      const driverNum = parseInt(driverNumStr)
      for (const s of samples || []) {
        // Validate sample has needed fields
        if (s.speed == null || s.throttle == null || s.drs == null) continue
        // Straight-line heuristic: DRS open and near-full throttle
        if (s.drs >= 8 && s.throttle >= 95 && !s.brake) {
          const speed = Number(s.speed)
          if (!best || speed > best.topSpeed) {
            // lap may not be present in telemetry; keep null if unknown
            best = { driver: String(driverNum), topSpeed: speed, lap: s.lap_number ?? null }
          }
        }
      }
    }
    if (!best) return null
    // Try to map driver number -> readable name from results
    const res = drivers.find(r => parseInt(r.Driver.permanentNumber) === parseInt(best!.driver))
    return {
      icon: '💨',
      title: 'Top Speed (Speed Trap)',
      description: `${res ? `${res.Driver.givenName} ${res.Driver.familyName}` : `#${best.driver}`} recorded ${best.topSpeed.toFixed(1)} km/h${best.lap ? ` on lap ${best.lap}` : ''}.`,
      type: 'pace' as const,
      accent: '#00A3FF',
    }
  }

  /**
   * SAFETY CAR IMPACT
   * Parses raceControl messages to find SC/VSC periods.
   * Calculates how many laps ran under safety car and which drivers
   * benefited most from the timing (drivers who started a new stint during SC).
   */
  function getSafetyCarImpact(raceControl: RaceControlMessage[], stintsArr: Stint[]) {
    // Build SC ranges from raceControl messages: find DEPLOYED -> CLEAR pairs
    const scRanges: Array<{ startLap: number; endLap: number }> = []
    let current: { startLap: number | null } | null = null
    for (const m of raceControl || []) {
      if (m.category === 'SafetyCar' && (m.flag === 'DEPLOYED' || (m.message && /DEPLOYED/i.test(m.message)))) {
        current = { startLap: m.lap_number ?? null }
      }
      if (current && m.category === 'SafetyCar' && (m.flag === 'CLEAR' || /CLEAR/i.test(m.message))) {
        const start = current.startLap ?? 0
        const end = m.lap_number ?? start
        scRanges.push({ startLap: start, endLap: end })
        current = null
      }
    }

    // Count laps covered by SC ranges
    const scLaps: number[] = []
    for (const r of scRanges) {
      for (let l = r.startLap; l <= r.endLap; l++) scLaps.push(l)
    }

    // Beneficiaries: drivers who started a new stint (stint_start lap) during any SC lap
    const beneficiaries = new Set<string>()
    for (const s of stintsArr || []) {
      for (const l of scLaps) {
        if (s.lap_start === l) {
          beneficiaries.add(String(s.driver_number))
        }
      }
    }

    return {
      icon: '🚨',
      title: 'Safety Car Impact',
      description: `Safety Car covered ${Array.from(new Set(scLaps)).length} lap(s). Benefited drivers: ${Array.from(beneficiaries).join(', ') || 'None detected'}.`,
      type: 'strategy' as const,
      accent: '#FF3B30',
    }
  }

  /**
   * WEATHER EFFECT ON PACE
   * Correlates track_temperature from weather data with lap times.
   * Finds the lap range where track temp peaked and checks if lap times
   * improved (rubber laid down) or degraded (overheating tyres).
   */
  function getWeatherEffect(weatherArr: WeatherData[], lapsLookup: Record<number, Lap[]>) {
    if (!weatherArr || weatherArr.length === 0) return null
    // Find sample with max track_temperature
    const sampleWithMax = weatherArr.reduce((best, s) => {
      if (!best) return s
      return (s.track_temperature ?? -Infinity) > (best.track_temperature ?? -Infinity) ? s : best
    }, null as WeatherData | null)
    if (!sampleWithMax) return null

    // Attempt to infer lap number from sample timestamp by checking lap start dates in lapsLookup
    const sampleTime = new Date(sampleWithMax.date).getTime()
    // Build per-lap aggregated lap times across drivers
    const perLapTimes: Record<number, number[]> = {}
    for (const driverLaps of Object.values(lapsLookup)) {
      for (const lap of driverLaps || []) {
        if (!lap.lap_duration) continue
        perLapTimes[lap.lap_number] = perLapTimes[lap.lap_number] || []
        perLapTimes[lap.lap_number].push(lap.lap_duration)
      }
    }
    // Convert to avg per lap
    const avgPerLap: Array<{ lap: number; avg: number }> = Object.entries(perLapTimes).map(([lap, vals]) => ({ lap: parseInt(lap), avg: vals.reduce((a, b) => a + b, 0) / vals.length }))
    if (avgPerLap.length === 0) return null

    // Find lap whose median start time is closest to the weather sample time
    let closestLap: number | null = null
    let closestDelta = Infinity
    for (const [_, driverLaps] of Object.entries(lapsLookup)) {
      for (const lap of driverLaps || []) {
        if (!lap.date_start) continue
        const d = Math.abs(new Date(lap.date_start).getTime() - sampleTime)
        if (d < closestDelta) {
          closestDelta = d
          closestLap = lap.lap_number
        }
      }
    }

    // Compare average lap time 3 laps before vs 3 laps after the peak lap
    const peakLap = closestLap ?? avgPerLap[Math.floor(avgPerLap.length / 2)].lap
    const window = 3
    const before = avgPerLap.filter(p => p.lap >= Math.max(1, peakLap - window) && p.lap < peakLap).map(p => p.avg)
    const after = avgPerLap.filter(p => p.lap > peakLap && p.lap <= peakLap + window).map(p => p.avg)
    if (before.length === 0 || after.length === 0) return null
    const avgBefore = before.reduce((a, b) => a + b, 0) / before.length
    const avgAfter = after.reduce((a, b) => a + b, 0) / after.length
    const delta = avgAfter - avgBefore

    return {
      icon: '🌡️',
      title: 'Weather & Pace',
      description: `Track temp peaked around lap ${peakLap}. Average lap time ${delta > 0 ? 'worsened' : 'improved'} by ${Math.abs(delta).toFixed(2)}s in the following ${window} laps, suggesting ${delta > 0 ? 'thermal degradation' : 'improved grip/rubbering'}.`,
      type: 'pace' as const,
      accent: '#007AFF',
    }
  }

  /**
   * GAP EVOLUTION MOMENTS
   * Scans intervals data to find the lap where the race leader's
   * gap was largest (dominance peak) and smallest (closest battle).
   */
  function getGapEvolutionMoments(intervalsArr: IntervalData[]) {
    if (!intervalsArr || intervalsArr.length === 0) return null
    // We will look for samples where gap_to_leader is numeric and use those to find peaks
    const parsed: Array<{ date: string; driver_number: number; gapToLeaderSeconds: number | null }> = []
    for (const s of intervalsArr) {
      const raw = s.gap_to_leader
      let secs: number | null = null
      if (typeof raw === 'string') {
        if (/lap/i.test(raw)) {
          // '1 LAP' -> treat as large gap (we'll set to a big number)
          secs = 9999
        } else {
          // Remove leading + and parse seconds
          const m = raw.replace('+', '')
          const n = Number(m)
          secs = isNaN(n) ? null : n
        }
      } else if (typeof raw === 'number') secs = raw
      parsed.push({ date: s.date, driver_number: s.driver_number, gapToLeaderSeconds: secs })
    }

    // Find sample with max gap and min non-zero gap
    const valid = parsed.filter(p => p.gapToLeaderSeconds != null)
    if (valid.length === 0) return null
    valid.sort((a, b) => (a.gapToLeaderSeconds as number) - (b.gapToLeaderSeconds as number))
    const closest = valid[0]
    const furthest = valid[valid.length - 1]

    return {
      icon: '📈',
      title: 'Gap Evolution',
      description: `Closest battle sampled at ${closest.date} with ${closest.gapToLeaderSeconds}s to leader. Biggest dominance sampled at ${furthest.date} with ${furthest.gapToLeaderSeconds}s gap.`,
      type: 'pace' as const,
      accent: '#9B59B6',
    }
  }

  /**
   * DRS TRAIN DETECTOR
   * Finds moments where 3+ cars were within 1 second of each other
   * using interval_to_position_ahead data.
   */
  function getDrsTrains(intervalsArr: IntervalData[]) {
    if (!intervalsArr || intervalsArr.length === 0) return null
    // Group samples by timestamp to look for clusters
    const byTime: Record<string, IntervalData[]> = {}
    for (const s of intervalsArr) {
      const t = s.date
      if (!byTime[t]) byTime[t] = []
      byTime[t].push(s)
    }

    const events: Array<{ lapSampleTime: string; drivers: number[]; gaps: number[] }> = []
    for (const [t, samples] of Object.entries(byTime)) {
      // Sort by position-ahead (smallest first) and detect chains
      const sorted = samples
        .filter(s => s.interval_to_position_ahead != null)
        .sort((a, b) => (a.interval_to_position_ahead ?? 0) - (b.interval_to_position_ahead ?? 0))
      // Look for sequences where successive gap <= 1s
      const chain: number[] = []
      const gaps: number[] = []
      for (const s of sorted) {
        const gap = Number(s.interval_to_position_ahead)
        if (isNaN(gap)) continue
        if (chain.length === 0 || gap <= 1) {
          chain.push(s.driver_number)
          gaps.push(gap)
        } else {
          if (chain.length >= 3) events.push({ lapSampleTime: t, drivers: [...chain], gaps: [...gaps] })
          chain.length = 0
          gaps.length = 0
          chain.push(s.driver_number)
          gaps.push(gap)
        }
      }
      if (chain.length >= 3) events.push({ lapSampleTime: t, drivers: [...chain], gaps: [...gaps] })
    }

    if (events.length === 0) return null
    const first = events[0]
    return {
      icon: '🚂',
      title: 'DRS Train Detected',
      description: `Detected a DRS train at ${first.lapSampleTime} with drivers ${first.drivers.join(', ')} within ~1s of each other.`,
      type: 'pace' as const,
      accent: '#00C853',
    }
  }
  const insights = computed((): Insight[] => {
    // Start with existing insights
    const base = [
      getRacePaceWinner(lapsData.value, results.value),
      getBiggestMover(results.value),
      getPitStopWinner(pits.value, results.value),
      getStrategyEffect(stints.value, results.value),
      getTeammateDeltas(lapsData.value, results.value),
    ].filter((i): i is Insight => i !== null)

    // Append new telemetry-driven insights when data is available
    try {
      if (Object.keys(_carData || {}).length > 0) {
        const sp = getSpeedTrapWinner(_carData, results.value)
        if (sp) base.push(sp)
      }

      if ((_raceControl || []).length > 0) {
        const sc = getSafetyCarImpact(_raceControl, stints.value)
        if (sc) base.push(sc)
      }

      if ((_weather || []).length > 0 && Object.keys(lapsData.value || {}).length > 0) {
        const w = getWeatherEffect(_weather, lapsData.value)
        if (w) base.push(w)
      }

      if ((_intervals || []).length > 0) {
        const g = getGapEvolutionMoments(_intervals)
        if (g) base.push(g)
        const t = getDrsTrains(_intervals)
        if (t) base.push(t)
      }
    } catch (e) {
      // Non-fatal: if any insight computation fails, log and continue
      console.error('Insight generation error:', e)
    }

    return base
  })

  return { insights }
}
