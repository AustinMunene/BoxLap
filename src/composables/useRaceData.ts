import { computed, watch } from 'vue'
import { useRaceStore } from '@/stores/raceStore'
import { useInsights } from './useInsights'

export function useRaceData(season: number, round: number) {
  const store = useRaceStore()

  async function load() {
    await store.loadRace(season, round)
    // Load laps for top 10 drivers after race loads
    if (store.currentSession) {
      const sk = store.currentSession.session_key
      const driverNums = store.results.slice(0, 10).map(r => parseInt(r.Driver.permanentNumber))
      await Promise.allSettled(driverNums.map(n => store.loadLapsForDriver(sk, n)))
      await store.loadPositions(sk)
    }
  }

  const { insights } = useInsights(
    computed(() => store.results),
    computed(() => store.laps),
    computed(() => store.stints),
    computed(() => store.pits)
  )

  // Watch for session changes to load positions
  watch(() => store.currentSession, async (session) => {
    if (session) {
      await store.loadPositions(session.session_key)
    }
  })

  return {
    results: computed(() => store.results),
    laps: computed(() => store.laps),
    stints: computed(() => store.stints),
    pits: computed(() => store.pits),
    drivers: computed(() => store.drivers),
    positions: computed(() => store.positions),
    currentSession: computed(() => store.currentSession),
    loading: computed(() => store.loading),
    error: computed(() => store.error),
    insights,
    load,
    loadLapsForDriver: (driverNumber: number) => {
      if (store.currentSession) {
        return store.loadLapsForDriver(store.currentSession.session_key, driverNumber)
      }
    }
  }
}
