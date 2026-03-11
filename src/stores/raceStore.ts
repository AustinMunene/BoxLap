import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getLaps, getStints, getPitStops, getDrivers, getPositions, getSessions } from '@/api/openf1'
import { getRaceResults } from '@/api/ergast'
import type { Lap, Stint, PitStop, RaceDriver, Position, Session } from '@/api/openf1'
import type { ErgastRaceResult } from '@/api/ergast'

export const useRaceStore = defineStore('race', () => {
  const results = ref<ErgastRaceResult[]>([])
  const laps = ref<Record<number, Lap[]>>({})
  const stints = ref<Stint[]>([])
  const pits = ref<PitStop[]>([])
  const drivers = ref<RaceDriver[]>([])
  const positions = ref<Position[]>([])
  const sessions = ref<Session[]>([])
  const currentSession = ref<Session | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadRace(season: number, round: number) {
    loading.value = true
    error.value = null
    try {
      // Load Ergast results
      const ergastData = await getRaceResults(season, round) as { MRData: { RaceTable: { Races: Array<{ Results: ErgastRaceResult[] }> } } }
      const races = ergastData?.MRData?.RaceTable?.Races
      if (races && races.length > 0) {
        results.value = races[0].Results || []
      }

      // Load OpenF1 sessions to get session key
      const sessionsData = await getSessions(season) as Session[]
      sessions.value = sessionsData || []

      // Find matching race session (by round order)
      if (sessionsData && sessionsData.length >= round) {
        currentSession.value = sessionsData[round - 1] || null
      } else if (sessionsData && sessionsData.length > 0) {
        currentSession.value = sessionsData[sessionsData.length - 1]
      }

      if (currentSession.value) {
        const sk = currentSession.value.session_key
        const [stintsData, pitsData, driversData] = await Promise.all([
          getStints(sk) as Promise<Stint[]>,
          getPitStops(sk) as Promise<PitStop[]>,
          getDrivers(sk) as Promise<RaceDriver[]>,
        ])
        stints.value = stintsData || []
        pits.value = pitsData || []
        drivers.value = driversData || []
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load race data'
      console.error('loadRace error:', e)
    } finally {
      loading.value = false
    }
  }

  async function loadLapsForDriver(sessionKey: number, driverNumber: number) {
    if (laps.value[driverNumber]) return
    try {
      const data = await getLaps(sessionKey, driverNumber) as Lap[]
      laps.value = { ...laps.value, [driverNumber]: data || [] }
    } catch (e) {
      console.error(`loadLapsForDriver error for #${driverNumber}:`, e)
    }
  }

  async function loadPositions(sessionKey: number) {
    try {
      const data = await getPositions(sessionKey) as Position[]
      positions.value = data || []
    } catch (e) {
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
    sessions,
    currentSession,
    loading,
    error,
    loadRace,
    loadLapsForDriver,
    loadPositions,
    reset
  }
})
