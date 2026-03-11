import { computed } from 'vue'
import type { Ref } from 'vue'
import type { Lap, Stint, PitStop } from '@/api/openf1'
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
    description: `${result.Driver.givenName} ${result.Driver.familyName}'s team completed their pit stops in ${best.total.toFixed(2)}s total — the fastest pit wall of the race.`,
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
    description: `At ${biggest.team}, ${biggest.driver1} was ${biggest.delta.toFixed(3)}s per lap faster than ${biggest.driver2} on average clean laps — the biggest intra-team pace gap of the race.`,
    type: 'teammate',
    accent: '#B6BABD',
  }
}

export function useInsights(
  results: Ref<ErgastRaceResult[]>,
  lapsData: Ref<Record<number, Lap[]>>,
  stints: Ref<Stint[]>,
  pits: Ref<PitStop[]>
) {
  const insights = computed((): Insight[] => {
    return [
      getRacePaceWinner(lapsData.value, results.value),
      getBiggestMover(results.value),
      getPitStopWinner(pits.value, results.value),
      getStrategyEffect(stints.value, results.value),
      getTeammateDeltas(lapsData.value, results.value),
    ].filter((i): i is Insight => i !== null)
  })

  return { insights }
}
