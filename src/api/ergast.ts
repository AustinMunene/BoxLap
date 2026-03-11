import { cached } from './cache'

// Ergast API is now hosted at api.jolpi.ca as ergast.com shut down in Dec 2024
const BASE = 'https://api.jolpi.ca/ergast/f1'

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Ergast API error: ${res.status} ${url}`)
  return res.json()
}

export const getLastRaceResults = () =>
  cached('last-race-results', () =>
    get(`${BASE}/current/last/results.json`)
  )

export const getNextRace = () =>
  cached('next-race', () =>
    get(`${BASE}/current/next.json`)
  )

export const getSeasonRaces = (year: number) =>
  cached(`season-races-${year}`, () =>
    get(`${BASE}/${year}/races.json`)
  )

export const getRaceResults = (year: number, round: number) =>
  cached(`race-results-${year}-${round}`, () =>
    get(`${BASE}/${year}/${round}/results.json`)
  )

export const getDriverStandings = (year: number = 'current' as unknown as number) =>
  cached(`driver-standings-${year}`, () =>
    get(`${BASE}/${year}/driverStandings.json`)
  )

export const getConstructorStandings = (year: number = 'current' as unknown as number) =>
  cached(`constructor-standings-${year}`, () =>
    get(`${BASE}/${year}/constructorStandings.json`)
  )

export const getAllRaceResultsForSeason = (year: number) =>
  cached(`all-race-results-${year}`, () =>
    get(`${BASE}/${year}/results.json?limit=500`)
  )

export const getCircuitResults = (circuitId: string) =>
  cached(`circuit-results-${circuitId}`, () =>
    get(`${BASE}/circuits/${circuitId}/results.json?limit=200`)
  )

// Types
export interface ErgastRaceResult {
  position: string
  positionText: string
  points: string
  grid: string
  laps: string
  status: string
  Time?: { millis: string; time: string }
  FastestLap?: {
    rank: string
    lap: string
    Time: { time: string }
    AverageSpeed: { units: string; speed: string }
  }
  Driver: {
    driverId: string
    permanentNumber: string
    code: string
    url: string
    givenName: string
    familyName: string
    dateOfBirth: string
    nationality: string
  }
  Constructor: {
    constructorId: string
    url: string
    name: string
    nationality: string
  }
}

export interface ErgastRace {
  season: string
  round: string
  url: string
  raceName: string
  Circuit: {
    circuitId: string
    url: string
    circuitName: string
    Location: {
      lat: string
      long: string
      locality: string
      country: string
    }
  }
  date: string
  time?: string
  Results?: ErgastRaceResult[]
}

export interface ErgastDriverStanding {
  position: string
  positionText: string
  points: string
  wins: string
  Driver: {
    driverId: string
    permanentNumber: string
    code: string
    givenName: string
    familyName: string
    dateOfBirth: string
    nationality: string
  }
  Constructors: Array<{
    constructorId: string
    name: string
    nationality: string
  }>
}

export interface ErgastConstructorStanding {
  position: string
  positionText: string
  points: string
  wins: string
  Constructor: {
    constructorId: string
    name: string
    nationality: string
  }
}
