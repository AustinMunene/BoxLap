import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getSeasonRaces,
  getDriverStandings,
  getConstructorStandings,
  getLastRaceResults,
  getNextRace,
} from '@/api/ergast'
import type { ErgastRace, ErgastDriverStanding, ErgastConstructorStanding } from '@/api/ergast'

export const useSeasonStore = defineStore('season', () => {
  const schedule = ref<ErgastRace[]>([])
  const driverStandings = ref<ErgastDriverStanding[]>([])
  const constructorStandings = ref<ErgastConstructorStanding[]>([])
  const lastRace = ref<ErgastRace | null>(null)
  const nextRace = ref<ErgastRace | null>(null)
  const lastRaceResults = ref<{ race: ErgastRace; results: import('@/api/ergast').ErgastRaceResult[] } | null>(
    null
  )
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Currently selected season year.
   * Changing this re-fetches schedule and standings for that year.
   */
  const selectedSeason = ref<number>(new Date().getFullYear())

  /**
   * Seasons available for selection (2023 = earliest with solid OpenF1 coverage).
   */
  const availableSeasons = computed(() => {
    const current = new Date().getFullYear()
    const seasons: number[] = []
    for (let y = current; y >= 2023; y--) seasons.push(y)
    return seasons
  })

  const isCurrentSeason = computed(() => selectedSeason.value === new Date().getFullYear())

  /** @deprecated Use selectedSeason — kept for gradual migration */
  const currentYear = computed(() => selectedSeason.value)

  const upcomingRaces = computed(() =>
    schedule.value.filter(r => new Date(r.date) >= new Date())
  )

  const pastRaces = computed(() => schedule.value.filter(r => new Date(r.date) < new Date()))

  async function loadCurrentSeason() {
    loading.value = true
    error.value = null
    const year = selectedSeason.value
    const isLiveYear = year === new Date().getFullYear()
    try {
      const settled = await Promise.allSettled([
        getSeasonRaces(year) as Promise<{ MRData: { RaceTable: { Races: ErgastRace[] } } }>,
        getDriverStandings(year) as Promise<{
          MRData: { StandingsTable: { StandingsLists: Array<{ DriverStandings: ErgastDriverStanding[] }> } }
        }>,
        getConstructorStandings(year) as Promise<{
          MRData: { StandingsTable: { StandingsLists: Array<{ ConstructorStandings: ErgastConstructorStanding[] }> } }
        }>,
        ...(isLiveYear
          ? [
              getLastRaceResults() as Promise<{
                MRData: {
                  RaceTable: {
                    Races: Array<ErgastRace & { Results: import('@/api/ergast').ErgastRaceResult[] }>
                  }
                }
              }>,
              getNextRace() as Promise<{ MRData: { RaceTable: { Races: ErgastRace[] } } }>,
            ]
          : []),
      ])

      const racesData = settled[0]
      const driverData = settled[1]
      const constructorData = settled[2]
      const lastRaceData = isLiveYear ? settled[3] : null
      const nextRaceData = isLiveYear ? settled[4] : null

      if (racesData.status === 'fulfilled') {
        schedule.value = racesData.value?.MRData?.RaceTable?.Races || []
      }

      if (driverData.status === 'fulfilled') {
        const lists = driverData.value?.MRData?.StandingsTable?.StandingsLists
        driverStandings.value = lists?.[0]?.DriverStandings || []
      }

      if (constructorData.status === 'fulfilled') {
        const lists = constructorData.value?.MRData?.StandingsTable?.StandingsLists
        constructorStandings.value = lists?.[0]?.ConstructorStandings || []
      }

      if (isLiveYear && lastRaceData?.status === 'fulfilled' && lastRaceData.value) {
        const races = lastRaceData.value?.MRData?.RaceTable?.Races
        if (races && races.length > 0) {
          const race = races[0]
          lastRace.value = race
          lastRaceResults.value = { race, results: race.Results || [] }
        }
      } else {
        lastRace.value = null
        lastRaceResults.value = null
      }

      if (isLiveYear && nextRaceData?.status === 'fulfilled' && nextRaceData.value) {
        const races = nextRaceData.value?.MRData?.RaceTable?.Races
        nextRace.value = races?.[0] || null
      } else {
        nextRace.value = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load season data'
      console.error('loadCurrentSeason error:', e)
    } finally {
      loading.value = false
    }
  }

  function setSelectedSeason(year: number) {
    if (!availableSeasons.value.includes(year)) return
    if (selectedSeason.value === year) return
    selectedSeason.value = year
    void loadCurrentSeason()
  }

  /** Sync navbar from route without re-fetching (caller already loaded data). */
  function syncSelectedSeasonOnly(year: number) {
    if (availableSeasons.value.includes(year)) selectedSeason.value = year
  }

  return {
    schedule,
    driverStandings,
    constructorStandings,
    lastRace,
    nextRace,
    lastRaceResults,
    loading,
    error,
    upcomingRaces,
    pastRaces,
    selectedSeason,
    availableSeasons,
    isCurrentSeason,
    currentYear,
    loadCurrentSeason,
    setSelectedSeason,
    syncSelectedSeasonOnly,
  }
})
