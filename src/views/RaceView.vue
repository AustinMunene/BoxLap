<template>
  <div class="race-view">
    <div
      v-if="pipeline.loading"
      class="pipeline-progress"
      :style="{ width: `${pipeline.progress}%` }"
    />
    <div class="container">
      <!-- Header -->
      <div class="race-header" v-if="!loading">
        <div class="race-meta">
          <router-link to="/" class="back-link">← Back</router-link>
          <span class="race-season">{{ season }} · Round {{ round }}</span>
          <span v-if="raceAvailability" class="race-avail-badge" :data-avail="raceAvailability">
            {{ raceAvailability === 'today' ? 'Today' : raceAvailability === 'upcoming' ? 'Upcoming' : 'Complete' }}
          </span>
        </div>
        <h1 class="race-title" v-if="currentRace">{{ currentRace.raceName }}</h1>
        <h1 class="race-title" v-else>Race {{ round }} - {{ season }}</h1>
        <div class="race-info" v-if="currentRace">
          <span>{{ currentRace.Circuit.circuitName }}</span>
          <span>{{ getCircuitFlag(currentRace.Circuit.Location.country) }} {{ currentRace.Circuit.Location.country }}</span>
          <span class="font-data">{{ formatDate(currentRace.date) }}</span>
        </div>
      </div>

      <!-- Error state -->
      <div v-if="error" class="error-banner glass-card">
        <span>⚠️ {{ error }}</span>
      </div>

      <!-- Tabs -->
      <div class="tabs-bar">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- OVERVIEW -->
        <div v-if="activeTab === 'overview'">
          <div v-if="loading" class="loading-grid">
            <SkeletonBlock height="200px" />
            <SkeletonBlock height="400px" />
          </div>
          <template v-else-if="results.length > 0">
            <RaceSummaryCard
              :laps="laps"
              :results="results"
              :pits="pits"
              :drivers="drivers"
              :sc-laps="scVscLapsMerged"
              :winner="results[0]?.Driver?.code ?? ''"
            />

            <!-- Podium -->
            <div class="overview-grid">
              <div class="glass-card podium-card">
                <div class="card-title-label">Podium</div>
                <div class="podium">
                  <div v-for="pos in [1, 2, 3]" :key="pos" class="podium-item">
                    <span class="pos-badge" :class="`pos-${pos}`">{{ pos }}</span>
                    <div v-if="getResult(pos)">
                      <div class="podium-name">{{ getResult(pos)?.Driver.givenName }} {{ getResult(pos)?.Driver.familyName }}</div>
                      <div class="podium-team" :style="{ color: getTeamColor(getResult(pos)?.Constructor.name || '') }">
                        {{ getResult(pos)?.Constructor.name }}
                      </div>
                      <div class="podium-time font-data">{{ getResult(pos)?.Time?.time || getResult(pos)?.status }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="auto-insights">
                <div class="card-title-label">Key Insights</div>
                <div class="insight-list">
                  <InsightCard
                    v-for="insight in insights.slice(0, 3)"
                    :key="insight.title"
                    v-bind="insight"
                  />
                  <div v-if="insights.length === 0" class="no-insights">
                    Load lap data in the Pace Analysis tab to generate insights.
                  </div>
                </div>
              </div>
            </div>

            <!-- Result Table -->
            <div class="glass-card mt-section">
              <div class="card-header-pad">
                <div class="card-title-label">Full Results</div>
              </div>
              <RaceResultTable :results="results" />
            </div>
          </template>
          <div v-else class="empty-state">
            <div class="empty-icon">🏁</div>
            <p>No results available for this race.</p>
          </div>
        </div>

        <!-- QUALIFYING -->
        <div v-if="activeTab === 'qualifying'">
          <div v-if="qualifyingTabLoading" class="loading-grid">
            <SkeletonBlock height="200px" />
            <SkeletonBlock height="400px" />
          </div>
          <template v-else-if="qualifyingErgast.length > 0 && qualifyingTabSession">
            <div class="glass-card mb-section quali-results-card">
              <div class="card-title-label">Qualifying</div>
              <p class="quali-kicker">Q1 / Q2 / Q3 from Ergast · grid from race results · gap vs pole (Q3)</p>
              <div class="overflow-x-auto">
                <table class="quali-table">
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th>Driver</th>
                      <th>Grid</th>
                      <th>Q1</th>
                      <th>Q2</th>
                      <th>Q3</th>
                      <th>Gap to pole</th>
                      <th>Tyre (fast lap)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in qualifyingTableRows" :key="row.code">
                      <td class="font-data">{{ row.position }}</td>
                      <td>{{ row.name }}</td>
                      <td class="font-data">{{ row.grid }}</td>
                      <td class="font-data">{{ row.q1 }}</td>
                      <td class="font-data">{{ row.q2 }}</td>
                      <td class="font-data">{{ row.q3 }}</td>
                      <td class="font-data">{{ row.gap }}</td>
                      <td>{{ row.tyre }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="glass-card tab-card">
              <div class="card-title-label card-header-pad">Qualifying lap times</div>
              <p class="quali-kicker pad-x">OpenF1 session - toggle drivers to match the chart</p>
              <div class="driver-toggles quali-toggles">
                <button
                  v-for="driver in qualifyingChartDriverOptions"
                  :key="driver.number"
                  class="driver-toggle"
                  :class="{ active: qualifyingSelectedDrivers.includes(driver.number) }"
                  :style="{ '--color': driver.color }"
                  @click="toggleQualifyingDriver(driver.number)"
                >
                  {{ driver.code }}
                </button>
              </div>
              <LapTimeChart :drivers="qualifyingChartDrivers" />
            </div>
          </template>
          <div v-else class="empty-state">
            <div class="empty-icon">🏎️</div>
            <p v-if="qualifyingTabError">{{ qualifyingTabError }}</p>
            <p v-else>Qualifying data could not be loaded.</p>
            <button type="button" class="load-laps-btn mt-2" @click="loadQualifyingTabData">Retry</button>
          </div>
        </div>

        <!-- BREAKDOWN -->
        <div v-if="activeTab === 'breakdown'">
          <div class="space-y-4">
            <ChartWrapper
              title="Sector Heatmap"
              subtitle="Which driver was quickest in each sector (median over the race)"
              :oneliner="oneLiners?.sectorHeatmap ?? ''"
              :loading="loading"
              :error="error || ''"
            >
              <SectorHeatmap :results="results" :lapsByDriver="laps" />
            </ChartWrapper>

            <ChartWrapper
              title="Tyre Life"
              subtitle="Tyre Life - how quickly each compound wore out"
              :oneliner="oneLiners?.tyreDegradation ?? ''"
              :loading="loading"
              :error="error || ''"
            >
              <TyreDegradation :results="results" :lapsByDriver="laps" :stints="stints" />
            </ChartWrapper>

            <ChartWrapper
              title="Top Speed"
              subtitle="Top Speed - who had the most horsepower on the straights"
              :oneliner="oneLiners?.speedTrap ?? ''"
              :loading="loading"
              :error="error || ''"
            >
              <SpeedTrapBreakdown :results="results" :lapsByDriver="laps" />
            </ChartWrapper>

            <ChartWrapper
              title="Quali vs Race Pace"
              subtitle="Quali vs Race Pace - who actually had race speed?"
              :oneliner="oneLiners?.qualiVsRace ?? ''"
              :loading="qualifyingLoading"
              :error="qualifyingError"
            >
              <QualiVsRace
                :results="results"
                :raceLapsByDriver="laps"
                :qualifyingSession="qualifyingSession"
                :qualiLapsByDriver="qualifyingLaps"
              />
              <div v-if="!qualifyingSession && !qualifyingLoading" class="mt-2">
                <button class="load-laps-btn" @click="loadQualifyingLaps">Load qualifying laps</button>
              </div>
            </ChartWrapper>

            <ChartWrapper
              title="Lap Consistency"
              subtitle="Lap Consistency - who drove the same lap time over and over?"
              :oneliner="oneLiners?.consistency ?? ''"
              :loading="loading"
              :error="error || ''"
            >
              <ConsistencyChart :results="results" :lapsByDriver="laps" />
            </ChartWrapper>

            <div v-if="oneLinersError" class="glass-card p-4 text-sm text-gray-300">
              {{ oneLinersError }}
            </div>
          </div>
        </div>

        <!-- LAP TIMES -->
        <div v-if="activeTab === 'laptimes'">
          <div class="glass-card tab-card">
            <div class="tab-card-header">
              <div class="card-title-label">Lap Time Chart</div>
              <div class="driver-toggles">
                <button
                  v-for="driver in availableDrivers"
                  :key="driver.number"
                  class="driver-toggle"
                  :class="{ active: selectedDrivers.includes(driver.number) }"
                  :style="{ '--color': driver.color }"
                  @click="toggleDriver(driver.number)"
                >
                  {{ driver.code }}
                </button>
              </div>
              <button class="load-laps-btn" @click="loadAllLaps" :disabled="loadingLaps">
                {{ loadingLaps ? 'Loading...' : 'Load Laps' }}
              </button>
            </div>
            <LapTimeChart :drivers="chartDriverData" :scLaps="pipelineScLaps" :vscLaps="pipelineVscLaps" />
            <!-- Gap evolution chart below the main lap time chart -->
            <div class="mt-4">
              <GapEvolutionChart :intervals="intervalsData" />
            </div>
            <!-- Weather overlay toggle -->
            <div class="mt-2">
              <button class="btn" @click="showWeather = !showWeather">{{ showWeather ? 'Hide' : 'Show' }} Weather Overlay</button>
            </div>
            <div v-if="showWeather" class="mt-3">
              <WeatherOverlay :weather="weather" />
            </div>
          </div>
        </div>

        <!-- PIT STRATEGY -->
        <div v-if="activeTab === 'strategy'">
          <div class="glass-card tab-card">
            <div class="card-title-label card-header-pad">Pit Strategy Timeline</div>
            <div v-if="stints.length > 0" class="strategy-container">
              <StrategyTimeline
                :results="results"
                :stints="stints"
                :pits="pits"
              />
              <div class="tyre-legend">
                <div v-for="(info, compound) in TYRE_COLORS" :key="compound" class="legend-item">
                  <span class="legend-dot" :style="{ background: info.bg }"></span>
                  <span>{{ compound }}</span>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <p>Stint data not available for this session.</p>
            </div>
          </div>
        </div>

        <!-- PACE ANALYSIS -->
        <div v-if="activeTab === 'pace'">
          <div class="pace-grid">
            <div class="glass-card tab-card">
              <div class="card-title-label card-header-pad">Average Clean Race Pace</div>
              <PaceBar :drivers="paceData" />
            </div>

            <div class="glass-card tab-card">
              <div class="card-title-label card-header-pad">Teammate Pace Delta</div>
              <div class="teammate-list">
                <div
                  v-for="delta in teammateDelta"
                  :key="delta.team"
                  class="teammate-row"
                >
                  <div
                    class="team-strip"
                    :style="{ background: getTeamColor(delta.team), height: '36px' }"
                  ></div>
                  <div class="teammate-info">
                    <div class="teammate-team">{{ delta.team }}</div>
                    <div class="teammate-drivers">
                      <span class="font-data driver-code-small">{{ delta.d1 }}</span>
                      <span class="delta-sep">vs</span>
                      <span class="font-data driver-code-small">{{ delta.d2 }}</span>
                    </div>
                  </div>
                  <div class="font-data teammate-delta" :style="{ color: delta.delta > 0.2 ? '#E8002D' : '#27F4D2' }">
                    Δ {{ delta.delta.toFixed(3) }}s
                  </div>
                </div>
                <div v-if="teammateDelta.length === 0" class="empty-state">
                  No teammate data available.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- INSIGHTS -->
        <div v-if="activeTab === 'insights'" class="insights-tab">
          <section v-if="pipelineRaceStats" class="insights-block">
            <RaceStory :raceStats="pipelineRaceStats" />
          </section>

          <section v-if="insightKeyStats" class="insights-block">
            <div class="section-kicker-race">Key stats</div>
            <div class="key-stats-row">
              <div class="key-stat-card">
                <span class="key-stat-icon">⏱</span>
                <div class="key-stat-label">Race pace</div>
                <div class="key-stat-value">{{ insightKeyStats.pace }}</div>
                <div class="key-stat-sub">{{ insightKeyStats.paceDetail }}</div>
              </div>
              <div class="key-stat-card">
                <span class="key-stat-icon">🔧</span>
                <div class="key-stat-label">Fastest pit</div>
                <div class="key-stat-value">{{ insightKeyStats.pit }}</div>
                <div class="key-stat-sub">{{ insightKeyStats.pitDetail }}</div>
              </div>
              <div class="key-stat-card">
                <span class="key-stat-icon">↗</span>
                <div class="key-stat-label">Biggest mover</div>
                <div class="key-stat-value">{{ insightKeyStats.mover }}</div>
                <div class="key-stat-sub">{{ insightKeyStats.moverDetail }}</div>
              </div>
              <div class="key-stat-card">
                <span class="key-stat-icon">💨</span>
                <div class="key-stat-label">Top speed</div>
                <div class="key-stat-value">{{ insightKeyStats.speed }}</div>
                <div class="key-stat-sub">{{ insightKeyStats.speedDetail }}</div>
              </div>
            </div>
          </section>

          <section class="insights-block">
            <div class="section-kicker-race">Detailed insights</div>
            <div class="insights-grid-detailed" v-if="insights.length > 0">
              <InsightCard
                v-for="insight in insights"
                :key="insight.title"
                v-bind="insight"
              />
            </div>
            <div v-else class="empty-state insights-empty">
              <div class="empty-icon">💡</div>
              <p>Load lap data in Pace Analysis to generate insights.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, toRef } from 'vue'
import { useRaceData } from '@/composables/useRaceData'
import { useSeasonStore } from '@/stores/seasonStore'
import { getTeamColor, getCircuitFlag, TYRE_COLORS } from '@/constants/teams'
import RaceResultTable from '@/components/ui/RaceResultTable.vue'
import RaceSummaryCard from '@/components/RaceSummaryCard.vue'
import InsightCard from '@/components/ui/InsightCard.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import LapTimeChart from '@/components/charts/LapTimeChart.vue'
import StrategyTimeline from '@/components/charts/StrategyTimeline.vue'
import PaceBar from '@/components/charts/PaceBar.vue'
import GapEvolutionChart from '@/components/charts/GapEvolutionChart.vue'
import WeatherOverlay from '@/components/charts/WeatherOverlay.vue'
import RaceStory from '@/components/RaceStory.vue'
import { usePostRacePipeline } from '@/composables/usePostRacePipeline'
import ChartWrapper from '@/components/ui/ChartWrapper.vue'
import SectorHeatmap from '@/components/charts/SectorHeatmap.vue'
import TyreDegradation from '@/components/charts/TyreDegradation.vue'
import SpeedTrapBreakdown from '@/components/charts/SpeedTrapTable.vue'
import QualiVsRace from '@/components/charts/QualiVsRace.vue'
import ConsistencyChart from '@/components/charts/ConsistencyChart.vue'
import { generateChartOneLiners, type ChartOneLiners } from '@/api/chartOneLiners'
import { getQualifyingResults } from '@/api/ergast'
import { getRaceAvailability } from '@/utils/raceAvailability'
import { getQualifyingSession, getLaps, getStints, type Session, type Lap, type Stint } from '@/api/openf1'

const props = defineProps<{
  season: number
  round: number
}>()

const seasonStore = useSeasonStore()
const raceData = useRaceData(toRef(props, 'season'), toRef(props, 'round'))

const { results, laps, stints, pits, drivers, weather, loading, error, insights } = raceData

// `useRaceData` already exposes computed refs; avoid wrapping to keep template typing correct.
const intervalsData = raceData.intervals
const carDataRef = raceData.carData

// Kick off the post-race pipeline which orchestrates loading telemetry
// and parsing safety car / VSC periods. computeRaceStats is intentionally
// left unimplemented pending your guidance; this pipeline will still
// load intervals/weather/raceControl and top-10 laps.
const pipeline = usePostRacePipeline(
  computed(() => raceData.currentSession.value?.session_key ?? 0),
  toRef(props, 'season'),
  toRef(props, 'round')
)
const pipelineRaceStats = computed(() => pipeline.raceStats.value)
const pipelineScLaps = computed(() => pipeline.scLaps.value)
const pipelineVscLaps = computed(() => pipeline.vscLaps.value)

/** SC + VSC lap numbers to exclude from clean pace (same as pipeline parsing). */
const scVscLapsMerged = computed(() => [
  ...new Set([...(pipelineScLaps.value ?? []), ...(pipelineVscLaps.value ?? [])]),
])

/**
 * Compact stat row for the Insights tab (from computed race stats - no extra API calls).
 */
const insightKeyStats = computed(() => {
  const rs = pipelineRaceStats.value
  if (!rs) return null
  const pace = rs.pacingRanking[0]
  const pit = rs.pitRanking[0]
  const mover = rs.biggestGainers[0]
  return {
    pace: pace ? pace.driver : '-',
    paceDetail: pace ? `~${pace.avgPace.toFixed(3)}s clean` : '',
    pit: pit ? pit.driver : '-',
    pitDetail: pit ? `${pit.totalPitTime}s total` : '',
    mover: mover ? mover.driver : '-',
    moverDetail: mover ? `+${mover.delta} pos` : '',
    speed: rs.topSpeed.speed > 0 ? rs.topSpeed.driver : '-',
    speedDetail: rs.topSpeed.speed > 0 ? `${rs.topSpeed.speed} km/h` : '',
  }
})

const activeTab = ref('overview')
const loadingLaps = ref(false)

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'qualifying', label: 'Qualifying' },
  { id: 'breakdown', label: 'Breakdown' },
  { id: 'laptimes', label: 'Lap Times' },
  { id: 'strategy', label: 'Pit Strategy' },
  { id: 'pace', label: 'Pace Analysis' },
  { id: 'insights', label: 'Insights' },
]

// Breakdown tab state
const oneLiners = ref<ChartOneLiners | null>(null)
const oneLinersError = ref('')
const oneLinersLoading = ref(false)

const qualifyingSession = ref<Session | null>(null)
const qualifyingLaps = ref<Record<number, Lap[]>>({})
const qualifyingLoading = ref(false)
const qualifyingError = ref('')

/** Qualifying tab: separate from Breakdown’s qualifying fetch */
const qualifyingTabLoading = ref(false)
const qualifyingTabError = ref('')
const qualifyingErgast = ref<
  Array<{
    position: string
    Q1?: string
    Q2?: string
    Q3?: string
    Driver: { code: string; givenName: string; familyName: string; permanentNumber: string }
  }>
>([])
const qualifyingTabSession = ref<Session | null>(null)
const qualifyingTabLaps = ref<Record<number, Lap[]>>({})
const qualifyingTabStints = ref<Stint[]>([])
const qualifyingTabReady = ref(false)
const qualifyingSelectedDrivers = ref<number[]>([])

function parseQualiTime(t: string | undefined): number | null {
  if (!t || t === '') return null
  const clean = t.replace(/^\+\s*/, '').trim()
  if (clean === '' || /dnf/i.test(clean)) return null
  const parts = clean.split(':')
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10)
    const secs = parseFloat(parts[1])
    if (Number.isFinite(mins) && Number.isFinite(secs)) return mins * 60 + secs
  }
  const n = parseFloat(clean)
  return Number.isFinite(n) ? n : null
}

function bestQualiSeconds(row: { Q1?: string; Q2?: string; Q3?: string }): number | null {
  const t = row.Q3 || row.Q2 || row.Q1
  return parseQualiTime(t)
}

function formatGapSeconds(delta: number): string {
  if (delta <= 0) return '-'
  const d = Math.abs(delta)
  return `+${d.toFixed(3)}`
}

function qualiTyreForDriver(driverNumber: number): string {
  const laps = qualifyingTabLaps.value[driverNumber]
  if (!laps?.length) return '-'
  let bestLap: Lap | null = null
  for (const l of laps) {
    if (!l.lap_duration || l.lap_duration <= 0) continue
    if (!bestLap || (l.lap_duration as number) < (bestLap.lap_duration as number)) bestLap = l
  }
  if (!bestLap) return '-'
  const ln = bestLap.lap_number
  const stint = qualifyingTabStints.value.find(
    s => s.driver_number === driverNumber && ln >= s.lap_start && ln <= s.lap_end
  )
  return stint?.compound ?? '-'
}

const qualifyingTableRows = computed(() => {
  const rows = qualifyingErgast.value
  if (!rows.length) return []
  const pole = rows[0]
  const poleT = bestQualiSeconds(pole)
  return rows.map((row, i) => {
    const code = row.Driver.code
    const num = parseInt(row.Driver.permanentNumber, 10)
    const grid = results.value.find(r => r.Driver.code === code)?.grid ?? '-'
    let gap = '-'
    if (i === 0) gap = 'POLE'
    else if (poleT != null) {
      const t = bestQualiSeconds(row)
      if (t != null) gap = formatGapSeconds(t - poleT)
    }
    return {
      position: row.position,
      code,
      name: `${row.Driver.givenName} ${row.Driver.familyName}`,
      grid,
      q1: row.Q1 || '-',
      q2: row.Q2 || '-',
      q3: row.Q3 || '-',
      gap,
      tyre: qualiTyreForDriver(num),
    }
  })
})

const qualifyingChartDriverOptions = computed(() =>
  results.value.slice(0, 12).map(r => ({
    number: parseInt(r.Driver.permanentNumber, 10),
    code: r.Driver.code,
    color: getTeamColor(r.Constructor.name),
  }))
)

const qualifyingChartDrivers = computed(() =>
  qualifyingSelectedDrivers.value.map(num => {
    const result = results.value.find(r => parseInt(r.Driver.permanentNumber, 10) === num)
    return {
      code: result?.Driver.code || `#${num}`,
      color: result ? getTeamColor(result.Constructor.name) : '#888',
      laps: qualifyingTabLaps.value[num] || [],
    }
  })
)

async function loadQualifyingTabData() {
  qualifyingTabLoading.value = true
  qualifyingTabError.value = ''
  try {
    const data = (await getQualifyingResults(props.season, props.round)) as {
      MRData?: {
        RaceTable?: { Races?: Array<{ QualifyingResults?: typeof qualifyingErgast.value }> }
      }
    }
    const qRows = data?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults ?? []
    qualifyingErgast.value = qRows
    if (qRows.length === 0) {
      qualifyingTabError.value = 'No qualifying results for this race.'
      return
    }

    const session = await getQualifyingSession(props.season, props.round)
    qualifyingTabSession.value = session
    if (!session) {
      qualifyingTabError.value = 'No qualifying session found for this round.'
      return
    }

    const st = await getStints(session.session_key)
    qualifyingTabStints.value = Array.isArray(st) ? st : []

    const topNums = qRows
      .slice(0, 10)
      .map(r => parseInt(r.Driver.permanentNumber, 10))
      .filter(n => Number.isFinite(n))
    const map: Record<number, Lap[]> = {}
    for (const n of topNums) {
      const laps = (await getLaps(session.session_key, n)) as Lap[]
      map[n] = Array.isArray(laps) ? laps : []
    }
    qualifyingTabLaps.value = map
    qualifyingSelectedDrivers.value = topNums.slice(0, 5)
    qualifyingTabReady.value = true
  } catch (e) {
    qualifyingTabError.value = 'Could not load qualifying data.'
    console.error('loadQualifyingTabData', e)
  } finally {
    qualifyingTabLoading.value = false
  }
}

function toggleQualifyingDriver(num: number) {
  const idx = qualifyingSelectedDrivers.value.indexOf(num)
  if (idx === -1) {
    if (qualifyingSelectedDrivers.value.length < 6) qualifyingSelectedDrivers.value.push(num)
  } else {
    qualifyingSelectedDrivers.value.splice(idx, 1)
  }
}

/** Clear qualifying state when the route race changes (avoid stale Ergast/OpenF1). */
function resetQualifyingForNewRace() {
  qualifyingSession.value = null
  qualifyingLaps.value = {}
  qualifyingLoading.value = false
  qualifyingError.value = ''
  qualifyingTabLoading.value = false
  qualifyingTabError.value = ''
  qualifyingErgast.value = []
  qualifyingTabSession.value = null
  qualifyingTabLaps.value = {}
  qualifyingTabStints.value = []
  qualifyingTabReady.value = false
  qualifyingSelectedDrivers.value = []
}

/**
 * Loads qualifying session and laps for the top 10 finishers only.
 *
 * Data source:
 * - OpenF1 `/sessions` filtered to Qualifying (via `getQualifyingSession`)
 * - OpenF1 `/laps` for that qualifying session (via `getLaps`)
 *
 * Why: loading all 20 drivers' qualifying laps is slower and not needed
 * for a fan-first chart. Top 10 is usually sufficient for the story.
 */
async function loadQualifyingLaps() {
  if (qualifyingLoading.value) return
  qualifyingLoading.value = true
  qualifyingError.value = ''
  try {
    const session = await getQualifyingSession(props.season, props.round)
    qualifyingSession.value = session
    if (!session) return

    const driverNums = results.value.slice(0, 10).map(r => parseInt(r.Driver.permanentNumber))
    const entries = await Promise.all(
      driverNums.map(async (n) => {
        const laps = await getLaps(session.session_key, n) as Lap[]
        return [n, laps] as const
      })
    )
    const map: Record<number, Lap[]> = {}
    for (const [n, ls] of entries) map[n] = ls || []
    qualifyingLaps.value = map
  } catch (e) {
    qualifyingError.value = 'Could not load qualifying laps for Breakdown.'
  } finally {
    qualifyingLoading.value = false
  }
}

/**
 * Loads Claude one-liners for the Breakdown charts.
 *
 * Data source: `/api/generateChartOneLiners` (Claude, backend-only).
 */
async function loadBreakdownOneLiners() {
  if (!pipelineRaceStats.value || oneLinersLoading.value) return
  oneLinersLoading.value = true
  oneLinersError.value = ''
  try {
    oneLiners.value = await generateChartOneLiners(pipelineRaceStats.value, props.season, props.round)
  } catch (e) {
    oneLinersError.value = 'Could not generate chart insights right now.'
  } finally {
    oneLinersLoading.value = false
  }
}

watch(
  () => pipelineRaceStats.value,
  async (rs) => {
    if (!rs) return
    // Fire and forget: Breakdown tab can render charts without these.
    await loadBreakdownOneLiners()
  },
  { immediate: true }
)

const currentRace = computed(() => {
  if (!seasonStore.schedule.length) return null
  return seasonStore.schedule.find(r => r.round === String(props.round)) || null
})

const raceAvailability = computed(() => {
  const cr = currentRace.value
  if (!cr) return null
  return getRaceAvailability(cr.date, props.season)
})

function getResult(position: number) {
  return results.value.find(r => parseInt(r.position) === position)
}

// Driver toggles
const selectedDrivers = ref<number[]>([])

const availableDrivers = computed(() =>
  results.value.slice(0, 10).map(r => ({
    number: parseInt(r.Driver.permanentNumber),
    code: r.Driver.code,
    color: getTeamColor(r.Constructor.name),
  }))
)

function toggleDriver(num: number) {
  const idx = selectedDrivers.value.indexOf(num)
  if (idx === -1) {
    if (selectedDrivers.value.length < 6) selectedDrivers.value.push(num)
  } else {
    selectedDrivers.value.splice(idx, 1)
  }
}

const chartDriverData = computed(() =>
  selectedDrivers.value.map(num => {
    const result = results.value.find(r => parseInt(r.Driver.permanentNumber) === num)
    return {
      code: result?.Driver.code || `#${num}`,
      color: result ? getTeamColor(result.Constructor.name) : '#888',
      laps: laps.value[num] || [],
    }
  })
)

const showWeather = ref(false)

async function loadAllLaps() {
  loadingLaps.value = true
  const session = raceData.currentSession.value
  if (!session) {
    loadingLaps.value = false
    return
  }

  const nums = results.value.slice(0, 10).map(r => parseInt(r.Driver.permanentNumber))
  await Promise.allSettled(
    nums.map(n => raceData.loadLapsForDriver(n))
  )
  selectedDrivers.value = nums.slice(0, 5)
  loadingLaps.value = false
}

// Pace data for bar chart
const paceData = computed(() => {
  return results.value.slice(0, 15).map(r => {
    const num = parseInt(r.Driver.permanentNumber)
    const driverLaps = laps.value[num] || []
    const valid = driverLaps
      .filter(l => l.lap_duration && l.lap_duration > 0 && !l.is_pit_out_lap)
      .map(l => l.lap_duration as number)
    if (valid.length < 3) return null
    const sorted = [...valid].sort((a, b) => a - b)
    const med = sorted[Math.floor(sorted.length / 2)]
    const clean = valid.filter(t => t <= med + 2)
    const avg = clean.reduce((a, b) => a + b, 0) / clean.length
    return {
      code: r.Driver.code,
      pace: avg,
      color: getTeamColor(r.Constructor.name),
    }
  }).filter((d): d is { code: string; pace: number; color: string } => d !== null)
})

// Teammate deltas
const teammateDelta = computed(() => {
  const teams: Record<string, typeof results.value> = {}
  for (const r of results.value) {
    const team = r.Constructor.name
    if (!teams[team]) teams[team] = []
    teams[team].push(r)
  }

  return Object.entries(teams)
    .filter(([, drivers]) => drivers.length === 2)
    .map(([team, drivers]) => {
      const [d1, d2] = drivers
      const l1 = laps.value[parseInt(d1.Driver.permanentNumber)] || []
      const l2 = laps.value[parseInt(d2.Driver.permanentNumber)] || []

      const avg = (ls: typeof l1) => {
        const valid = ls.filter(l => l.lap_duration && l.lap_duration > 0 && !l.is_pit_out_lap).map(l => l.lap_duration as number)
        if (valid.length < 3) return null
        const sorted = [...valid].sort((a, b) => a - b)
        const med = sorted[Math.floor(sorted.length / 2)]
        const clean = valid.filter(t => t <= med + 2)
        return clean.reduce((a, b) => a + b, 0) / clean.length
      }

      const a1 = avg(l1)
      const a2 = avg(l2)
      if (a1 === null || a2 === null) return null

      const faster = a1 < a2 ? d1 : d2
      const slower = a1 < a2 ? d2 : d1
      return {
        team,
        d1: faster.Driver.code,
        d2: slower.Driver.code,
        delta: Math.abs(a1 - a2),
      }
    })
    .filter((d): d is { team: string; d1: string; d2: string; delta: number } => d !== null)
    .sort((a, b) => b.delta - a.delta)
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })
}

watch(
  () => activeTab.value,
  t => {
    if (t === 'qualifying' && !qualifyingTabReady.value) void loadQualifyingTabData()
  }
)

watch(
  () => [props.season, props.round] as const,
  async () => {
    resetQualifyingForNewRace()
    seasonStore.syncSelectedSeasonOnly(props.season)
    await raceData.load()
    if (raceData.currentSession.value) {
      await Promise.allSettled([
        raceData.loadIntervals(),
        raceData.loadWeather(),
        raceData.loadRaceControl(),
      ])
    }
    if (activeTab.value === 'qualifying') {
      void loadQualifyingTabData()
    }
  }
)

onMounted(async () => {
  seasonStore.syncSelectedSeasonOnly(props.season)
  if (seasonStore.schedule.length === 0) {
    seasonStore.loadCurrentSeason()
  }
  await raceData.load()

  // Also kick off loads for intervals/weather/raceControl immediately
  if (raceData.currentSession.value) {
    await Promise.allSettled([
      raceData.loadIntervals(),
      raceData.loadWeather(),
      raceData.loadRaceControl(),
    ])
  }

  // Preload Breakdown dependencies that are cheap:
  // - One-liners are fetched only after raceStats is available (watch above).
  // - Qualifying laps are loaded on-demand by button to avoid slowing initial render.
})
</script>

<style scoped>
.race-view {
  padding-bottom: 4rem;
  position: relative;
}

.pipeline-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: #e8002d;
  transition: width 0.3s ease;
  z-index: 9999;
  box-shadow: 0 0 8px rgba(232, 0, 45, 0.6);
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.race-header {
  padding: 2rem 0 1.5rem;
}

.race-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.back-link {
  color: #666;
  text-decoration: none;
  font-size: 0.875rem;
  transition: color 0.15s;
}

.back-link:hover { color: #fff; }

.race-season {
  font-size: 0.75rem;
  color: #444;
  font-family: 'DM Mono', monospace;
  letter-spacing: 0.06em;
}

.race-avail-badge {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-family: 'DM Mono', monospace;
}

.race-avail-badge[data-avail="available"] {
  color: #86efac;
  background: rgba(134, 239, 172, 0.12);
  border: 1px solid rgba(134, 239, 172, 0.25);
}

.race-avail-badge[data-avail="today"] {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.race-avail-badge[data-avail="upcoming"] {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.race-title {
  font-size: 2rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  margin-bottom: 0.5rem;
}

.race-info {
  display: flex;
  gap: 1.5rem;
  font-size: 0.875rem;
  color: #666;
  flex-wrap: wrap;
}

.error-banner {
  padding: 1rem 1.25rem;
  color: #ff6b6b;
  margin-bottom: 1rem;
}

.tabs-bar {
  display: flex;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 1.5rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.tab-content {
  min-height: 400px;
}

.mb-section {
  margin-bottom: 1rem;
}

.quali-results-card {
  padding: 1.25rem;
}

.quali-kicker {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 1rem;
}

.quali-kicker.pad-x {
  padding: 0 1.25rem 0.5rem;
}

.quali-toggles {
  padding: 0 1.25rem 1rem;
}

.quali-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.quali-table th,
.quali-table td {
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.quali-table th {
  color: #888;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
}

/* Overview */
.overview-grid {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 1rem;
  align-items: start;
}

.podium-card {
  padding: 1.5rem;
}

.auto-insights {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.insight-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.no-insights {
  font-size: 0.875rem;
  color: #555;
  padding: 1rem;
}

.mt-section {
  margin-top: 1rem;
}

.summary-card {
  padding: 1.5rem;
}

.summary-body {
  font-size: 0.9rem;
  color: #ccc;
  line-height: 1.6;
  white-space: pre-wrap;
}

.card-header-pad {
  padding: 1rem 1.25rem 0;
}

.card-title-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #555;
  margin-bottom: 1rem;
}

.podium {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.podium-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.pos-badge {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.8rem;
  font-family: 'DM Mono', monospace;
  flex-shrink: 0;
}

.pos-1 { background: #FFD700; color: #000; }
.pos-2 { background: #C0C0C0; color: #000; }
.pos-3 { background: #CD7F32; color: #000; }

.podium-name { font-size: 0.9rem; font-weight: 600; }
.podium-team { font-size: 0.75rem; margin-top: 0.1rem; }
.podium-time { font-size: 0.75rem; color: #666; }

/* Lap Times tab */
.tab-card {
  padding: 1.5rem;
}

.tab-card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.driver-toggles {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  flex: 1;
}

.driver-toggle {
  padding: 0.2rem 0.625rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  color: #888;
  cursor: pointer;
  transition: all 0.15s;
  letter-spacing: 0.04em;
}

.driver-toggle.active {
  border-color: var(--color);
  color: var(--color);
  background: color-mix(in srgb, var(--color) 15%, transparent);
}

.load-laps-btn {
  padding: 0.375rem 1rem;
  border-radius: 6px;
  background: rgba(232, 0, 45, 0.15);
  border: 1px solid rgba(232, 0, 45, 0.4);
  color: #E8002D;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.load-laps-btn:hover:not(:disabled) {
  background: rgba(232, 0, 45, 0.25);
}

.load-laps-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Strategy tab */
.strategy-container {
  padding: 0 1.5rem 1.5rem;
}

.tyre-legend {
  display: flex;
  gap: 1.5rem;
  margin-top: 1.25rem;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #888;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

/* Pace tab */
.pace-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  align-items: start;
}

.teammate-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.teammate-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.team-strip {
  width: 3px;
  border-radius: 2px;
  flex-shrink: 0;
}

.teammate-info { flex: 1; }
.teammate-team { font-size: 0.8rem; color: #888; margin-bottom: 0.2rem; }
.teammate-drivers { display: flex; align-items: center; gap: 0.5rem; }
.driver-code-small { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.04em; }
.delta-sep { font-size: 0.7rem; color: #555; }
.teammate-delta { font-size: 0.875rem; font-weight: 600; }

/* Insights tab */
.insights-tab {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.insights-block {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-kicker-race {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #666;
  margin-bottom: 0.25rem;
}

.key-stats-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  -webkit-overflow-scrolling: touch;
}

.key-stat-card {
  flex: 0 0 auto;
  width: 160px;
  max-width: 160px;
  padding: 0.75rem 0.875rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.key-stat-icon {
  font-size: 1rem;
  opacity: 0.85;
}

.key-stat-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #666;
  margin-top: 0.35rem;
}

.key-stat-value {
  font-size: 0.9rem;
  font-weight: 700;
  color: #fff;
  margin-top: 0.25rem;
  font-family: 'DM Mono', monospace;
}

.key-stat-sub {
  font-size: 0.7rem;
  color: #888;
  margin-top: 0.2rem;
}

.insights-grid-detailed {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  grid-auto-rows: 1fr;
}

@media (max-width: 1100px) {
  .insights-grid-detailed {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .insights-grid-detailed {
    grid-template-columns: 1fr;
  }
}

.insights-empty {
  padding: 2rem;
}

.loading-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: #555;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

@media (max-width: 900px) {
  .overview-grid,
  .pace-grid {
    grid-template-columns: 1fr;
  }
}
</style>
