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
      <div class="tabs-bar race-tabs">
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
            <div class="overview-grid overview-lower">
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
              <div class="phase-selector">
                <button
                  v-for="phase in (['Q1', 'Q2', 'Q3'] as const)"
                  :key="phase"
                  type="button"
                  class="phase-btn"
                  :class="{ 'phase-btn--active': selectedQualiPhase === phase }"
                  @click="selectedQualiPhase = phase"
                >
                  {{ phase }}
                  <span class="phase-count">{{ getPhaseDriverCount(phase) }}</span>
                </button>
              </div>
              <div class="view-toggle">
                <button
                  type="button"
                  class="view-btn"
                  :class="{ 'view-btn--active': qualiView === 'mini' }"
                  title="Mini sector colour map"
                  @click="qualiView = 'mini'"
                >
                  ⬛ Mini Sectors
                </button>
                <button
                  type="button"
                  class="view-btn"
                  :class="{ 'view-btn--active': qualiView === 'sector' }"
                  title="Sector summary card"
                  @click="qualiView = 'sector'"
                >
                  ▬ Sector View
                </button>
              </div>
              <div class="view-note">
                <span v-if="!phaseBoundaries.q1End">
                  ⚠ Phase boundaries unavailable for this session — showing session-best lap for all phases
                </span>
              </div>
              <p class="quali-phase-hint">
                Mini sectors use OpenF1 for the selected phase when race-control boundaries exist; otherwise
                session-best lap.
              </p>
              <div class="quali-blocks-wrap quali-driver-list-wrap">
                <TransitionGroup name="driver-sort" tag="div" class="quali-driver-list">
                  <div
                    v-for="entry in displayedDrivers"
                    :key="entry.driverNumber"
                    class="quali-driver-block"
                  >
                    <div class="quali-row">
                      <span
                        class="quali-pos font-data"
                        :class="{ 'quali-pos--pole': entry.displayPosition === 1 }"
                      >
                        {{ entry.displayPosition }}
                      </span>
                      <div
                        class="quali-team-strip"
                        :style="{
                          background: getTeamColor(
                            (entry.ergastData
                              ? results.find(
                                  r => r.Driver.code === entry.ergastData?.Driver.code
                                )?.Constructor.name
                              : undefined) ||
                              entry.driver?.team_name ||
                              ''
                          ),
                        }"
                      />
                      <span class="quali-name">{{
                        entry.ergastData
                          ? `${entry.ergastData.Driver.givenName} ${entry.ergastData.Driver.familyName}`
                          : entry.driver?.full_name ?? `#${entry.driverNumber}`
                      }}</span>
                      <span class="quali-time quali-time--q1 font-data">{{
                        entry.ergastData?.Q1 || '-'
                      }}</span>
                      <span class="quali-time quali-time--q2 font-data">{{
                        entry.ergastData?.Q2 || '-'
                      }}</span>
                      <span class="quali-time quali-time--q3 font-data">{{
                        entry.ergastData?.Q3 || '-'
                      }}</span>
                      <span
                        class="quali-gap font-data"
                        :class="{ 'quali-gap--pole': entry.displayPosition === 1 }"
                      >
                        {{
                          entry.displayPosition === 1 ? 'POLE' : getQualiGapForDisplayedEntry(entry)
                        }}
                      </span>
                      <span class="quali-tyre">{{ qualiTyreForDriver(entry.driverNumber) }}</span>
                    </div>
                    <div
                      v-if="qualiView === 'mini' && qualiMiniByDriver[entry.driverNumber]"
                      class="quali-mini-row"
                    >
                      <span class="mini-label">S1</span>
                      <div class="mini-boxes">
                        <div
                          v-for="(seg, idx) in qualiMiniByDriver[entry.driverNumber].seg1"
                          :key="`s1-${idx}`"
                          class="mini-box"
                          :style="{ background: MINI_SECTOR_COLORS[seg] ?? '#333' }"
                        />
                      </div>
                      <span class="mini-time">{{
                        formatMiniSectorTime(qualiMiniByDriver[entry.driverNumber].s1)
                      }}</span>
                      <span class="mini-label">S2</span>
                      <div class="mini-boxes">
                        <div
                          v-for="(seg, idx) in qualiMiniByDriver[entry.driverNumber].seg2"
                          :key="`s2-${idx}`"
                          class="mini-box"
                          :style="{ background: MINI_SECTOR_COLORS[seg] ?? '#333' }"
                        />
                      </div>
                      <span class="mini-time">{{
                        formatMiniSectorTime(qualiMiniByDriver[entry.driverNumber].s2)
                      }}</span>
                      <span class="mini-label">S3</span>
                      <div class="mini-boxes">
                        <div
                          v-for="(seg, idx) in qualiMiniByDriver[entry.driverNumber].seg3"
                          :key="`s3-${idx}`"
                          class="mini-box"
                          :style="{ background: MINI_SECTOR_COLORS[seg] ?? '#333' }"
                        />
                      </div>
                      <span class="mini-time">{{
                        formatMiniSectorTime(qualiMiniByDriver[entry.driverNumber].s3)
                      }}</span>
                    </div>
                    <div v-if="qualiView === 'sector'" class="sector-summary-row">
                      <div
                        v-for="sector in (['S1', 'S2', 'S3'] as const)"
                        :key="sector"
                        class="sector-block"
                        :style="{ background: getSectorColor(entry, sector) }"
                      >
                        <span class="sector-block-label">{{ sector }}</span>
                        <span class="sector-block-time">
                          {{ formatSector(getSectorTime(entry, sector)) }}
                        </span>
                        <span v-if="getSectorDelta(entry, sector)" class="sector-block-delta">
                          {{ getSectorDelta(entry, sector) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </TransitionGroup>
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
          <section class="insights-block">
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
import { useRoute } from 'vue-router'
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
import {
  getQualifyingSession,
  getLaps,
  getStints,
  getRaceControl,
  type Session,
  type Lap,
  type Stint,
} from '@/api/openf1'
import type { RaceControlMessage } from '@/types/openf1'
import { findPhaseBoundaries, getLapsForPhase, bestLapForDriver } from '@/lib/qualifyingPhaseLaps'

const props = defineProps<{
  season: number
  round: number
}>()

const route = useRoute()
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
const selectedQualiPhase = ref<'Q1' | 'Q2' | 'Q3'>('Q3')
const qualifyingTabRaceControl = ref<RaceControlMessage[]>([])
const phaseBoundaries = ref<{ q1End: string | null; q2End: string | null }>({
  q1End: null,
  q2End: null,
})
const qualiView = ref<'mini' | 'sector'>('mini')

const MINI_SECTOR_COLORS: Record<number, string> = {
  2048: '#00c853',
  2049: '#9c27b0',
  2051: '#ffd600',
  2052: '#333333',
  2064: '#e8002d',
}

const phaseQualiLaps = computed(() =>
  getLapsForPhase(qualifyingTabLaps.value, phaseBoundaries.value, selectedQualiPhase.value)
)

const phaseBestLaps = computed(() => {
  const result: Record<number, Lap> = {}
  for (const [driverNumStr, laps] of Object.entries(phaseQualiLaps.value)) {
    const driverNum = Number(driverNumStr)
    const validLaps = (laps || []).filter(
      l => l.lap_duration !== null && l.duration_sector_1 !== null
    )
    if (!validLaps.length) continue
    result[driverNum] = validLaps.reduce((best, lap) =>
      (lap.lap_duration ?? Infinity) < (best.lap_duration ?? Infinity) ? lap : best
    )
  }
  return result
})

const phaseDriverRanking = computed(() =>
  Object.entries(phaseBestLaps.value)
    .map(([driverNum, lap]) => ({
      driverNumber: Number(driverNum),
      lap,
      driver: drivers.value.find(d => d.driver_number === Number(driverNum)),
    }))
    .filter(entry => entry.driver && entry.lap.lap_duration !== null)
    .sort((a, b) => (a.lap.lap_duration ?? 99) - (b.lap.lap_duration ?? 99))
)

const displayedDrivers = computed(() =>
  phaseDriverRanking.value.map((entry, index) => ({
    ...entry,
    displayPosition: index + 1,
    ergastData: getErgastDriverData(entry.driverNumber),
  }))
)

function getErgastDriverData(driverNumber: number) {
  const openf1Driver = drivers.value.find(d => d.driver_number === driverNumber)
  if (!openf1Driver) return null
  return (
    qualifyingErgast.value.find(r => r.Driver.code === openf1Driver.name_acronym) ?? null
  )
}

function getPhaseDriverCount(phase: 'Q1' | 'Q2' | 'Q3'): number {
  const laps = getLapsForPhase(qualifyingTabLaps.value, phaseBoundaries.value, phase)
  let n = 0
  for (const list of Object.values(laps)) {
    const valid = (list || []).filter(
      l => l.lap_duration !== null && l.duration_sector_1 !== null
    )
    if (valid.length) n++
  }
  return n
}

function getQualiGapForDisplayedEntry(entry: {
  displayPosition: number
  driverNumber: number
  lap: Lap
}): string {
  const pole = phaseDriverRanking.value[0]
  if (!pole?.lap?.lap_duration || entry.lap.lap_duration == null) return '-'
  if (entry.driverNumber === pole.driverNumber) return '-'
  return formatGapSeconds(entry.lap.lap_duration - pole.lap.lap_duration)
}

function formatGapSeconds(delta: number): string {
  if (delta <= 0) return '-'
  const d = Math.abs(delta)
  return `+${d.toFixed(3)}`
}

function qualiTyreForDriver(driverNumber: number): string {
  const laps = phaseQualiLaps.value[driverNumber]
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
      laps: phaseQualiLaps.value[num] || [],
    }
  })
)

function formatMiniSectorTime(s: number | null | undefined): string {
  if (s == null || s === undefined) return '—'
  return s.toFixed(3)
}

type MiniRow = {
  seg1: number[]
  seg2: number[]
  seg3: number[]
  s1: number | null
  s2: number | null
  s3: number | null
}

function miniSectorRow(driverNumber: number): MiniRow | null {
  const lap = bestLapForDriver(phaseQualiLaps.value[driverNumber])
  if (!lap) return null
  return {
    seg1: lap.segments_sector_1 ?? [],
    seg2: lap.segments_sector_2 ?? [],
    seg3: lap.segments_sector_3 ?? [],
    s1: lap.duration_sector_1,
    s2: lap.duration_sector_2,
    s3: lap.duration_sector_3,
  }
}

const qualiMiniByDriver = computed(() => {
  const out: Record<number, MiniRow> = {}
  for (const entry of phaseDriverRanking.value) {
    const m = miniSectorRow(entry.driverNumber)
    if (m) out[entry.driverNumber] = m
  }
  return out
})

type QualiDriverEntry = { driverNumber: number }

/**
 * Sector summary colours: purple = fastest in sector for the phase; green = personal best;
 * yellow = slower than PB; grey = no time.
 */
function getSectorColor(driverEntry: QualiDriverEntry, sector: 'S1' | 'S2' | 'S3'): string {
  const sectorKey =
    sector === 'S1' ? 'duration_sector_1' : sector === 'S2' ? 'duration_sector_2' : 'duration_sector_3'

  const driverTime = phaseBestLaps.value[driverEntry.driverNumber]?.[sectorKey as keyof Lap] as
    | number
    | null
    | undefined
  if (driverTime == null) return '#222'

  const allTimes = phaseDriverRanking.value
    .map(e => phaseBestLaps.value[e.driverNumber]?.[sectorKey as keyof Lap] as number | null | undefined)
    .filter((t): t is number => t != null)
  if (!allTimes.length) return '#222'
  const overallBest = Math.min(...allTimes)

  if (Math.abs(driverTime - overallBest) < 0.001) return '#9C27B0'

  const driverPhaseLaps = phaseQualiLaps.value[driverEntry.driverNumber] ?? []
  const sectorTimes = driverPhaseLaps
    .map(l => l[sectorKey as keyof Lap] as number | null | undefined)
    .filter((t): t is number => t != null)
  if (!sectorTimes.length) return '#222'
  const personalBest = Math.min(...sectorTimes)

  if (Math.abs(driverTime - personalBest) < 0.001) return '#00C853'

  return '#FFD600'
}

function getSectorTime(driverEntry: QualiDriverEntry, sector: 'S1' | 'S2' | 'S3'): number | null {
  const key =
    sector === 'S1' ? 'duration_sector_1' : sector === 'S2' ? 'duration_sector_2' : 'duration_sector_3'
  const v = phaseBestLaps.value[driverEntry.driverNumber]?.[key as keyof Lap]
  return typeof v === 'number' ? v : null
}

function formatSector(seconds: number | null): string {
  if (seconds == null) return '—'
  return seconds.toFixed(3)
}

function getSectorDelta(driverEntry: QualiDriverEntry, sector: 'S1' | 'S2' | 'S3'): string | null {
  const sectorKey =
    sector === 'S1' ? 'duration_sector_1' : sector === 'S2' ? 'duration_sector_2' : 'duration_sector_3'

  const driverTime = phaseBestLaps.value[driverEntry.driverNumber]?.[sectorKey as keyof Lap] as
    | number
    | undefined
  if (driverTime == null) return null

  const allTimes = phaseDriverRanking.value
    .map(e => phaseBestLaps.value[e.driverNumber]?.[sectorKey as keyof Lap] as number | undefined)
    .filter((t): t is number => t != null)
  if (!allTimes.length) return null
  const best = Math.min(...allTimes)
  const delta = driverTime - best

  if (delta < 0.001) return null
  return `+${delta.toFixed(3)}`
}

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

    const [st, rc] = await Promise.all([
      getStints(session.session_key),
      getRaceControl(session.session_key),
    ])
    qualifyingTabStints.value = Array.isArray(st) ? st : []

    const rcRows = Array.isArray(rc) ? (rc as RaceControlMessage[]) : []
    qualifyingTabRaceControl.value = rcRows
    console.log(
      '[QualiDebug] race control messages:',
      rcRows.map(m => ({
        date: m.date,
        message: m.message,
        category: m.category,
        flag: m.flag,
      }))
    )

    const topNums = qRows
      .slice(0, 10)
      .map(r => parseInt(r.Driver.permanentNumber, 10))
      .filter(n => Number.isFinite(n))
    const lapEntries = await Promise.all(
      topNums.map(async n => {
        const laps = (await getLaps(session.session_key, n)) as Lap[]
        return [n, Array.isArray(laps) ? laps : []] as const
      })
    )
    const map: Record<number, Lap[]> = {}
    for (const [n, laps] of lapEntries) map[n] = laps
    qualifyingTabLaps.value = map

    phaseBoundaries.value = findPhaseBoundaries(rcRows, map)
    console.log('[Qualifying] Phase boundaries:', phaseBoundaries.value)
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
  selectedQualiPhase.value = 'Q3'
  qualifyingTabRaceControl.value = []
  phaseBoundaries.value = { q1End: null, q2End: null }
  qualiView.value = 'mini'
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
  const urlSeason = Number(route.params.season)
  if (Number.isFinite(urlSeason) && urlSeason !== seasonStore.selectedSeason) {
    /** URL is source of truth for race pages — sync navbar without clearing (see `syncSelectedSeasonOnly`). */
    seasonStore.syncSelectedSeasonOnly(urlSeason)
  }
  if (seasonStore.schedule.length === 0) {
    await seasonStore.loadCurrentSeason()
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

.phase-selector {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.phase-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #666;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Titillium Web', sans-serif;
}

.phase-btn--active {
  background: rgba(232, 0, 45, 0.12);
  border-color: rgba(232, 0, 45, 0.3);
  color: #e8002d;
}

.phase-count {
  font-size: 11px;
  font-weight: 700;
  color: #444;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 7px;
  border-radius: 10px;
  font-family: 'DM Mono', monospace;
  transition: color 0.2s;
}

.phase-btn--active .phase-count {
  color: rgba(232, 0, 45, 0.6);
  background: rgba(232, 0, 45, 0.08);
}

.quali-phase-hint {
  font-size: 11px;
  color: #555;
  margin: 0 0 12px;
  line-height: 1.4;
}

.view-toggle {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
}

.view-btn {
  padding: 7px 16px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #666;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Titillium Web', sans-serif;
}

.view-btn--active {
  background: rgba(232, 0, 45, 0.12);
  border-color: rgba(232, 0, 45, 0.3);
  color: #e8002d;
}

.view-note {
  font-size: 11px;
  color: #555;
  margin-bottom: 16px;
  font-style: italic;
}

.sector-summary-row {
  display: flex;
  gap: 6px;
  padding: 6px 16px 12px 56px;
  align-items: center;
}

.sector-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 14px;
  border-radius: 6px;
  width: 160px;
  height: 36px;
  transition: transform 0.15s, opacity 0.15s;
  opacity: 0.92;
  flex-shrink: 0;
}

.sector-block:hover {
  opacity: 1;
  transform: translateY(-1px);
}

.sector-block-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
}

.sector-block-time {
  font-size: 13px;
  font-weight: 800;
  font-family: 'DM Mono', monospace;
  color: #fff;
  flex: 1;
  text-align: center;
}

.sector-block-delta {
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  color: rgba(255, 255, 255, 0.55);
  flex-shrink: 0;
  text-align: right;
  min-width: 44px;
}

.quali-driver-list-wrap {
  position: relative;
  overflow-x: auto;
}

.quali-driver-list {
  position: relative;
}

.driver-sort-move {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.driver-sort-enter-active {
  transition: all 0.3s ease;
}

.driver-sort-leave-active {
  transition: all 0.2s ease;
  position: absolute;
  width: 100%;
}

.driver-sort-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.driver-sort-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.quali-blocks-wrap {
  overflow-x: auto;
}

.quali-driver-block {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  transition: background 0.15s;
  margin-bottom: 2px;
}

.quali-driver-block:hover {
  background: rgba(255, 255, 255, 0.025);
}

.quali-row {
  display: grid;
  grid-template-columns: 40px 4px 1fr 100px 100px 100px 90px 80px;
  align-items: center;
  gap: 12px;
  padding: 14px 16px 8px;
}

.quali-pos {
  font-weight: 700;
}

.quali-team-strip {
  width: 4px;
  height: 32px;
  border-radius: 2px;
  flex-shrink: 0;
}

.quali-pos--pole {
  color: #9c27b0;
  font-weight: 900;
}

.quali-gap--pole {
  color: #9c27b0;
  font-weight: 800;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.quali-name {
  font-size: 0.9rem;
  color: #eee;
}

.quali-mini-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px 12px 56px;
  flex-wrap: nowrap;
  overflow-x: auto;
}

.mini-label {
  font-size: 10px;
  font-weight: 700;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 1px;
  flex-shrink: 0;
  width: 20px;
}

.mini-boxes {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.mini-box {
  width: 9px;
  height: 14px;
  border-radius: 2px;
}

.mini-time {
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  color: #666;
  flex-shrink: 0;
  margin-right: 16px;
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

@media (max-width: 768px) {
  .race-header {
    padding: 16px 0;
  }

  .race-title {
    font-size: 28px;
  }

  .tabs-bar,
  .race-tabs {
    display: flex;
    overflow-x: auto;
    gap: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    -ms-overflow-style: none;
    scrollbar-width: none;
    margin: 0 calc(-1 * var(--page-padding, 16px));
    padding: 0 var(--page-padding, 16px);
  }

  .tabs-bar::-webkit-scrollbar,
  .race-tabs::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    flex-shrink: 0;
    padding: 12px 16px;
    font-size: 12px;
    white-space: nowrap;
  }

  .quali-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  .quali-time--q1,
  .quali-time--q2 {
    display: none;
  }

  .quali-mini-row {
    overflow-x: auto;
    padding-bottom: 8px;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .quali-mini-row::-webkit-scrollbar {
    display: none;
  }

  .sector-summary-row {
    gap: 4px;
    padding-left: 40px;
  }

  .sector-block {
    width: 100px;
    padding: 6px 8px;
    gap: 4px;
  }

  .sector-block-time {
    font-size: 11px;
  }

  .sector-block-delta {
    display: none;
  }

  .insights-grid-detailed {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1280px) {
  .race-tabs .tab-btn {
    padding: 14px 28px;
    font-size: 14px;
  }

  .overview-lower {
    grid-template-columns: 320px 1fr;
    gap: 32px;
  }

  .quali-row {
    display: grid;
    grid-template-columns: 40px 4px 1fr 120px 120px 120px 100px 90px;
    align-items: center;
    gap: 20px;
  }

  .quali-time--q1,
  .quali-time--q2 {
    display: block;
  }
}
</style>
