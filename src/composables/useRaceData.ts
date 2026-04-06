import { computed, watch, type MaybeRefOrGetter, toValue } from 'vue'
import { useRaceStore } from '@/stores/raceStore'
import { useInsights } from './useInsights'

export function useRaceData(season: MaybeRefOrGetter<number>, round: MaybeRefOrGetter<number>) {
  const store = useRaceStore()
  const seasonVal = () => toValue(season)
  const roundVal = () => toValue(round)

  async function load() {
    await store.loadRace(seasonVal(), roundVal())
    // Load laps for top 10 drivers after race loads
    if (store.currentSession) {
      const sk = store.currentSession.session_key
      /**
       * Prefer OpenF1 `driver_number` when available.
       * Ergast `permanentNumber` is not guaranteed to match OpenF1 driver numbers for a given session,
       * which can cause 404s and unnecessary rate-limit pressure.
       */
      const openf1Nums = store.drivers.slice(0, 10).map(d => d.driver_number).filter(n => Number.isFinite(n))
      const fallbackNums = store.results.slice(0, 10).map(r => parseInt(r.Driver.permanentNumber, 10)).filter(n => Number.isFinite(n))
      const driverNums = openf1Nums.length > 0 ? openf1Nums : fallbackNums

      // Serialize inside OpenF1 limiter; Promise.allSettled is fine here because the limiter throttles.
      await Promise.allSettled(driverNums.map(n => store.loadLapsForDriver(sk, n)))
    }
  }

  const { insights } = useInsights(
    computed(() => store.results),
    computed(() => store.laps),
    computed(() => store.stints),
    computed(() => store.pits)
  )

  // Pass additional telemetry into useInsights when available so new
  // telemetry-driven insights can be produced (speed trap, SC impact, weather).
  const { insights: insightsExtended } = useInsights(
    computed(() => store.results),
    computed(() => store.laps),
    computed(() => store.stints),
    computed(() => store.pits),
    computed(() => store.carData),
    computed(() => store.raceControl),
    computed(() => store.weather),
    computed(() => store.intervals)
  )

  // Watch for session changes to load positions
  watch(() => store.currentSession, async (session) => {
    if (session) {
      if (store.positions.length === 0) await store.loadPositions(session.session_key)
    }
  })

  return {
    results: computed(() => store.results),
    laps: computed(() => store.laps),
    stints: computed(() => store.stints),
    pits: computed(() => store.pits),
    carData: computed(() => store.carData),
    intervals: computed(() => store.intervals),
    weather: computed(() => store.weather),
    raceControl: computed(() => store.raceControl),
    drivers: computed(() => store.drivers),
    positions: computed(() => store.positions),
    currentSession: computed(() => store.currentSession),
    loading: computed(() => store.loading),
    error: computed(() => store.error),
    insights,
    insightsExtended,
    load,
    loadCarData: (driverNumber: number) => {
      if (store.currentSession) return store.loadCarData(store.currentSession.session_key, driverNumber)
    },
    loadIntervals: () => {
      if (store.currentSession) return store.loadIntervals(store.currentSession.session_key)
    },
    loadWeather: () => {
      if (store.currentSession) return store.loadWeather(store.currentSession.session_key)
    },
    loadRaceControl: () => {
      if (store.currentSession) return store.loadRaceControl(store.currentSession.session_key)
    },
    loadLapsForDriver: (driverNumber: number) => {
      if (store.currentSession) {
        return store.loadLapsForDriver(store.currentSession.session_key, driverNumber)
      }
    }
  }
}
