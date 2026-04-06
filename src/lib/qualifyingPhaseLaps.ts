import type { Lap } from '@/api/openf1'
import type { RaceControlMessage } from '@/types/openf1'

/**
 * Finds Q1/Q2/Q3 phase boundaries from race control messages.
 *
 * OpenF1 marks qualifying phase endings with chequered flags (often category Flag).
 * There are typically 3 chequered messages in qualifying — we use the first two
 * timestamps as Q1 end and Q2 end.
 *
 * Fallback: `Other` messages containing PERIOD ENDED / SESSION ENDED.
 * Last resort: split all lap `date_start` values into three equal thirds by time.
 */
export function findPhaseBoundaries(
  raceControl: RaceControlMessage[],
  allLapsByDriver?: Record<number, Lap[]>
): { q1End: string | null; q2End: string | null } {
  const chequeredFlags = raceControl
    .filter(m => m.flag === 'CHEQUERED' || m.message?.toLowerCase().includes('chequered'))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  console.log('[QualiDebug] chequered flags found:', chequeredFlags.length, chequeredFlags)

  if (chequeredFlags.length >= 2) {
    return {
      q1End: chequeredFlags[0].date,
      q2End: chequeredFlags[1].date,
    }
  }

  const sessionEnds = raceControl
    .filter(
      m =>
        m.category === 'Other' &&
        (m.message?.includes('PERIOD ENDED') || m.message?.includes('SESSION ENDED'))
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  console.log('[QualiDebug] session end messages found:', sessionEnds.length, sessionEnds)

  if (sessionEnds.length >= 2) {
    return {
      q1End: sessionEnds[0].date,
      q2End: sessionEnds[1].date,
    }
  }

  if (allLapsByDriver) {
    const allTimes: number[] = []
    for (const laps of Object.values(allLapsByDriver)) {
      for (const l of laps || []) {
        if (l.date_start) allTimes.push(new Date(l.date_start).getTime())
      }
    }
    allTimes.sort((a, b) => a - b)
    if (allTimes.length >= 3) {
      const n = allTimes.length
      const i1 = Math.floor(n / 3)
      const i2 = Math.floor((2 * n) / 3)
      return {
        q1End: new Date(allTimes[i1]).toISOString(),
        q2End: new Date(allTimes[i2]).toISOString(),
      }
    }
  }

  return { q1End: null, q2End: null }
}

/**
 * Splits qualifying laps into Q1 / Q2 / Q3 using boundary timestamps when present.
 * Falls back to all laps per driver when boundaries are missing.
 */
export function getLapsForPhase(
  allLaps: Record<number, Lap[]>,
  boundaries: { q1End: string | null; q2End: string | null },
  phase: 'Q1' | 'Q2' | 'Q3'
): Record<number, Lap[]> {
  const { q1End, q2End } = boundaries
  const result: Record<number, Lap[]> = {}

  for (const [driverNumStr, laps] of Object.entries(allLaps)) {
    const lapsList = laps || []
    let filtered: Lap[]

    if (phase === 'Q1' && q1End) {
      filtered = lapsList.filter(l => new Date(l.date_start).getTime() < new Date(q1End).getTime())
    } else if (phase === 'Q2' && q1End && q2End) {
      const t1 = new Date(q1End).getTime()
      const t2 = new Date(q2End).getTime()
      filtered = lapsList.filter(l => {
        const t = new Date(l.date_start).getTime()
        return t >= t1 && t < t2
      })
    } else if (phase === 'Q3' && q2End) {
      const t2 = new Date(q2End).getTime()
      filtered = lapsList.filter(l => new Date(l.date_start).getTime() >= t2)
    } else {
      filtered = lapsList
    }

    if (filtered.length > 0) {
      result[Number(driverNumStr)] = filtered
    }
  }

  return result
}

export function bestLapForDriver(laps: Lap[] | undefined): Lap | null {
  const list = laps ?? []
  const valid = list.filter(l => l.lap_duration !== null && l.duration_sector_1 !== null)
  if (!valid.length) return null
  return valid.reduce((best, lap) =>
    (lap.lap_duration ?? Infinity) < (best.lap_duration ?? Infinity) ? lap : best
  )
}
