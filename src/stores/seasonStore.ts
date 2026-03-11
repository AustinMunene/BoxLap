import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getSeasonRaces,
  getDriverStandings,
  getConstructorStandings,
  getLastRaceResults,
  getNextRace
} from '@/api/ergast'
import type { ErgastRace, ErgastDriverStanding, ErgastConstructorStanding } from '@/api/ergast'

export const useSeasonStore = defineStore('season', () => {
  const schedule = ref<ErgastRace[]>([])
  const driverStandings = ref<ErgastDriverStanding[]>([])
  const constructorStandings = ref<ErgastConstructorStanding[]>([])
  const lastRace = ref<ErgastRace | null>(null)
  const nextRace = ref<ErgastRace | null>(null)
  const lastRaceResults = ref<{ race: ErgastRace; results: import('@/api/ergast').ErgastRaceResult[] } | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentYear = new Date().getFullYear()

  const upcomingRaces = computed(() =>
    schedule.value.filter(r => new Date(r.date) >= new Date())
  )

  const pastRaces = computed(() =>
    schedule.value.filter(r => new Date(r.date) < new Date())
  )

  async function loadCurrentSeason() {
    loading.value = true
    error.value = null
    try {
      const [racesData, driverData, constructorData, lastRaceData, nextRaceData] = await Promise.allSettled([
        getSeasonRaces(currentYear) as Promise<{ MRData: { RaceTable: { Races: ErgastRace[] } } }>,
        getDriverStandings() as Promise<{ MRData: { StandingsTable: { StandingsLists: Array<{ DriverStandings: ErgastDriverStanding[] }> } } }>,
        getConstructorStandings() as Promise<{ MRData: { StandingsTable: { StandingsLists: Array<{ ConstructorStandings: ErgastConstructorStanding[] }> } } }>,
        getLastRaceResults() as Promise<{ MRData: { RaceTable: { Races: Array<ErgastRace & { Results: import('@/api/ergast').ErgastRaceResult[] }> } } }>,
        getNextRace() as Promise<{ MRData: { RaceTable: { Races: ErgastRace[] } } }>,
      ])

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

      if (lastRaceData.status === 'fulfilled') {
        const races = lastRaceData.value?.MRData?.RaceTable?.Races
        if (races && races.length > 0) {
          const race = races[0]
          lastRace.value = race
          lastRaceResults.value = { race, results: race.Results || [] }
        }
      }

      if (nextRaceData.status === 'fulfilled') {
        const races = nextRaceData.value?.MRData?.RaceTable?.Races
        nextRace.value = races?.[0] || null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load season data'
      console.error('loadCurrentSeason error:', e)
    } finally {
      loading.value = false
    }
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
    currentYear,
    loadCurrentSeason
  }
})
