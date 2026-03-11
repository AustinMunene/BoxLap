<template>
  <div class="race-view">
    <div class="container">
      <!-- Header -->
      <div class="race-header" v-if="!loading">
        <div class="race-meta">
          <router-link to="/" class="back-link">← Back</router-link>
          <span class="race-season">{{ season }} · Round {{ round }}</span>
        </div>
        <h1 class="race-title" v-if="currentRace">{{ currentRace.raceName }}</h1>
        <h1 class="race-title" v-else>Race {{ round }} — {{ season }}</h1>
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
            <LapTimeChart :drivers="chartDriverData" />
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
        <div v-if="activeTab === 'insights'">
          <div class="insights-grid" v-if="insights.length > 0">
            <InsightCard
              v-for="insight in insights"
              :key="insight.title"
              v-bind="insight"
            />
          </div>
          <div v-else class="empty-state">
            <div class="empty-icon">💡</div>
            <p>Load lap data in Pace Analysis to generate insights.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRaceData } from '@/composables/useRaceData'
import { useSeasonStore } from '@/stores/seasonStore'
import { getTeamColor, getCircuitFlag, TYRE_COLORS } from '@/constants/teams'
import RaceResultTable from '@/components/ui/RaceResultTable.vue'
import InsightCard from '@/components/ui/InsightCard.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import LapTimeChart from '@/components/charts/LapTimeChart.vue'
import StrategyTimeline from '@/components/charts/StrategyTimeline.vue'
import PaceBar from '@/components/charts/PaceBar.vue'

const props = defineProps<{
  season: number
  round: number
}>()

const seasonStore = useSeasonStore()
const raceData = useRaceData(props.season, props.round)

const { results, laps, stints, pits, drivers, loading, error, insights } = raceData

const activeTab = ref('overview')
const loadingLaps = ref(false)

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'laptimes', label: 'Lap Times' },
  { id: 'strategy', label: 'Pit Strategy' },
  { id: 'pace', label: 'Pace Analysis' },
  { id: 'insights', label: 'Insights' },
]

const currentRace = computed(() => {
  if (!seasonStore.schedule.length) return null
  return seasonStore.schedule.find(r => r.round === String(props.round)) || null
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

async function loadAllLaps() {
  loadingLaps.value = true
  const session = raceData.currentSession.value
  if (!session) return

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

onMounted(async () => {
  if (seasonStore.schedule.length === 0) {
    seasonStore.loadCurrentSeason()
  }
  await raceData.load()
})
</script>

<style scoped>
.race-view {
  padding-bottom: 4rem;
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
.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 0.875rem;
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
