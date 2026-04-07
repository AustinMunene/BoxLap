<template>
  <div class="drivers-view">
    <div class="container">
      <!-- Header -->
      <div class="page-header">
        <h1 class="page-title">Drivers</h1>
        <span class="page-sub">{{ seasonStore.selectedSeason }} Championship</span>
      </div>

      <!-- Loading -->
      <div v-if="seasonStore.loading" class="loading-grid">
        <SkeletonBlock v-for="n in 6" :key="n" height="120px" rounded />
      </div>

      <!-- Driver Cards Grid -->
      <div v-else-if="seasonStore.driverStandings.length" class="drivers-grid">
        <div
          v-for="standing in seasonStore.driverStandings"
          :key="standing.Driver.driverId"
          class="driver-card glass-card glass-card--interactive"
          role="link"
          tabindex="0"
          :style="{ '--team-color': getTeamColor(standing.Constructors[0]?.name || '') }"
          @click="goDriver(standing.Driver.code)"
          @keydown="onDriverCardKey($event, standing.Driver.code)"
        >
          <div class="driver-card-bar" />
          <div class="driver-card-pos">P{{ standing.position }}</div>
          <div class="driver-card-photo-wrap">
            <img
              v-if="driverImages[standing.Driver.code]"
              class="driver-card-photo"
              :src="driverImages[standing.Driver.code] || undefined"
              :alt="standing.Driver.familyName"
            />
            <div v-else class="driver-card-photo-placeholder">
              {{ standing.Driver.code }}
            </div>
          </div>
          <div class="driver-card-info">
            <span class="driver-card-code">{{ standing.Driver.code }}</span>
            <span class="driver-card-name">{{ standing.Driver.familyName }}</span>
            <span class="driver-card-team" :style="{ color: 'var(--team-color)' }">
              {{ standing.Constructors[0]?.name }}
            </span>
          </div>
          <div class="driver-card-pts">
            <span class="driver-card-pts-value stat-number">{{ standing.points }}</span>
            <span class="driver-card-pts-label">PTS</span>
          </div>
          <div class="driver-card-hover-stats">
            <div class="hover-stat">
              <span class="hover-stat-value">{{ getDriverWins(standing) }}</span>
              <span class="hover-stat-label">Wins</span>
            </div>
            <div class="hover-stat">
              <span class="hover-stat-value">{{ getDriverPodiums(standing) }}</span>
              <span class="hover-stat-label">Podiums</span>
            </div>
            <div class="hover-stat">
              <span class="hover-stat-value">→</span>
              <span class="hover-stat-label">Full profile</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Head-to-Head Comparison -->
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Head-to-Head</h2>
        </div>
        <div class="glass-card glass-card--static h2h-card">
          <div class="h2h-selectors">
            <div class="selector-group">
              <label class="selector-label">Driver 1</label>
              <select v-model="selectedDriver1" class="driver-select">
                <option value="">Select driver</option>
                <option
                  v-for="s in seasonStore.driverStandings"
                  :key="s.Driver.driverId"
                  :value="s.Driver.driverId"
                >
                  {{ s.Driver.code }} - {{ s.Driver.givenName }} {{ s.Driver.familyName }}
                </option>
              </select>
            </div>
            <div class="vs-label">VS</div>
            <div class="selector-group">
              <label class="selector-label">Driver 2</label>
              <select v-model="selectedDriver2" class="driver-select">
                <option value="">Select driver</option>
                <option
                  v-for="s in seasonStore.driverStandings"
                  :key="s.Driver.driverId"
                  :value="s.Driver.driverId"
                >
                  {{ s.Driver.code }} - {{ s.Driver.givenName }} {{ s.Driver.familyName }}
                </option>
              </select>
            </div>
          </div>

          <div class="h2h-comparison" v-if="driver1Standing && driver2Standing">
            <RadarChart :drivers="radarDrivers" />
            <div class="h2h-stats">
              <div class="stat-compare" v-for="stat in compareStats" :key="stat.label">
                <div class="stat-bar-label">{{ stat.label }}</div>
                <div class="stat-bars">
                  <div class="stat-bar-row">
                    <span class="driver-code-tag" :style="{ color: driver1Color }">{{ driver1Standing.Driver.code }}</span>
                    <div class="bar-track">
                      <div class="bar-fill" :style="{ width: `${stat.pct1}%`, background: driver1Color }"></div>
                    </div>
                    <span class="stat-val font-data">{{ stat.val1 }}</span>
                  </div>
                  <div class="stat-bar-row">
                    <span class="driver-code-tag" :style="{ color: driver2Color }">{{ driver2Standing.Driver.code }}</span>
                    <div class="bar-track">
                      <div class="bar-fill" :style="{ width: `${stat.pct2}%`, background: driver2Color }"></div>
                    </div>
                    <span class="stat-val font-data">{{ stat.val2 }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            Select two drivers to compare their season statistics.
          </div>
        </div>
      </section>

      <!-- Championship Points Chart -->
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Points Distribution</h2>
        </div>
        <div class="glass-card glass-card--static">
          <div class="points-chart-wrapper">
            <Bar v-if="pointsChartData" :data="pointsChartData" :options="pointsChartOptions" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend
} from 'chart.js'
import { useSeasonStore } from '@/stores/seasonStore'
import { getTeamColor } from '@/constants/teams'
import type { ErgastDriverStanding } from '@/api/ergast'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import RadarChart from '@/components/charts/RadarChart.vue'
import { getAllDriverImages } from '@/api/wikipedia'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const seasonStore = useSeasonStore()
const router = useRouter()

function goDriver(code: string) {
  router.push(`/drivers/${encodeURIComponent(code)}`)
}

function onDriverCardKey(e: KeyboardEvent, code: string) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    goDriver(code)
  }
}

function getDriverWins(s: ErgastDriverStanding) {
  return parseInt(s.wins, 10) || 0
}

/** Ergast standings omit podium count; show placeholder in UI. */
function getDriverPodiums(_s: ErgastDriverStanding) {
  return '—'
}

/** Wikipedia thumbnail URLs keyed by driver code (3-letter). */
const driverImages = ref<Record<string, string | null>>({})

const selectedDriver1 = ref('')
const selectedDriver2 = ref('')

const driver1Standing = computed(() =>
  seasonStore.driverStandings.find(s => s.Driver.driverId === selectedDriver1.value)
)
const driver2Standing = computed(() =>
  seasonStore.driverStandings.find(s => s.Driver.driverId === selectedDriver2.value)
)

const driver1Color = computed(() => getTeamColor(driver1Standing.value?.Constructors[0]?.name || ''))
const driver2Color = computed(() => getTeamColor(driver2Standing.value?.Constructors[0]?.name || ''))

const totalPoints = computed(() => {
  const standings = seasonStore.driverStandings
  if (!standings.length) return 1
  return Math.max(...standings.map(s => parseFloat(s.points)), 1)
})

const totalWins = computed(() => Math.max(...seasonStore.driverStandings.map(s => parseInt(s.wins)), 1))

function normalize(val: number, max: number): number {
  return Math.round((val / max) * 100)
}

const compareStats = computed(() => {
  if (!driver1Standing.value || !driver2Standing.value) return []
  const d1 = driver1Standing.value
  const d2 = driver2Standing.value
  const pts = totalPoints.value

  return [
    {
      label: 'Championship Points',
      val1: d1.points,
      val2: d2.points,
      pct1: normalize(parseFloat(d1.points), pts),
      pct2: normalize(parseFloat(d2.points), pts),
    },
    {
      label: 'Wins',
      val1: d1.wins,
      val2: d2.wins,
      pct1: normalize(parseInt(d1.wins), totalWins.value),
      pct2: normalize(parseInt(d2.wins), totalWins.value),
    },
    {
      label: 'Standing Position',
      val1: `P${d1.position}`,
      val2: `P${d2.position}`,
      pct1: normalize(21 - parseInt(d1.position), 20),
      pct2: normalize(21 - parseInt(d2.position), 20),
    },
  ]
})

const radarDrivers = computed(() => {
  if (!driver1Standing.value || !driver2Standing.value) return []

  const makeScores = (standing: typeof driver1Standing.value) => {
    if (!standing) return [0, 0, 0, 0, 0]
    const pos = parseInt(standing.position)
    const wins = parseInt(standing.wins)
    const pts = parseFloat(standing.points)
    return [
      normalize(100 - pos, 100),       // Quali proxy
      normalize(100 - pos, 100),       // Race pace proxy
      normalize(wins, totalWins.value), // Wins
      normalize(pts, totalPoints.value),// Points
      normalize(10 - Math.min(pos - 1, 10), 10), // Consistency
    ]
  }

  return [
    {
      code: driver1Standing.value?.Driver.code || '',
      color: driver1Color.value,
      scores: makeScores(driver1Standing.value),
    },
    {
      code: driver2Standing.value?.Driver.code || '',
      color: driver2Color.value,
      scores: makeScores(driver2Standing.value),
    },
  ]
})

const pointsChartData = computed(() => {
  const top10 = seasonStore.driverStandings.slice(0, 10)
  if (!top10.length) return null
  return {
    labels: top10.map(s => s.Driver.code),
    datasets: [{
      data: top10.map(s => parseFloat(s.points)),
      backgroundColor: top10.map(s => getTeamColor(s.Constructors[0]?.name || '') + 'cc'),
      borderColor: top10.map(s => getTeamColor(s.Constructors[0]?.name || '')),
      borderWidth: 1,
      borderRadius: 4,
    }]
  }
})

const pointsChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111',
      borderColor: '#333',
      borderWidth: 1,
      callbacks: {
        label: (ctx: { raw: unknown }) => ` ${ctx.raw} pts`
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#888', font: { family: 'DM Mono', size: 11 } }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { size: 10 } }
    }
  }
}

watch(
  () => seasonStore.selectedSeason,
  async () => {
    await seasonStore.loadCurrentSeason()
  },
  { immediate: true }
)

watch(
  () => seasonStore.driverStandings,
  async (standings) => {
    if (!standings.length) return
    const codes = standings.map(s => s.Driver.code)
    driverImages.value = await getAllDriverImages(codes)
  },
  { immediate: true }
)
</script>

<style scoped>
.drivers-view {
  padding-bottom: 4rem;
}


.page-header {
  padding: 2.5rem 0 2rem;
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 900;
  letter-spacing: -0.02em;
}

.page-sub {
  font-size: 0.875rem;
  color: #555;
}

.loading-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

/* Driver Cards */
.drivers-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.driver-card {
  position: relative;
  padding: 0;
  overflow: hidden;
  border-radius: 16px;
  min-height: 260px;
  display: flex;
  flex-direction: column;
}

.driver-card-bar {
  height: 3px;
  background: var(--team-color);
  width: 100%;
  flex-shrink: 0;
}

.driver-card-pos {
  position: absolute;
  top: 16px;
  left: 16px;
  font-size: 11px;
  font-weight: 800;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 1px;
  z-index: 2;
}

.driver-card-photo-wrap {
  height: 160px;
  overflow: hidden;
  position: relative;
  background: rgba(255, 255, 255, 0.02);
}

.driver-card-photo-wrap::before {
  content: '';
  position: absolute;
  bottom: -20px;
  right: -20px;
  width: 120px;
  height: 200px;
  background: var(--team-color);
  opacity: 0.06;
  transform: rotate(-15deg);
  pointer-events: none;
}

.driver-card-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  position: relative;
  z-index: 1;
}

.driver-card-photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 900;
  color: var(--team-color);
  opacity: 0.4;
  font-family: 'DM Mono', monospace;
  position: relative;
  z-index: 1;
}

.driver-card-info {
  padding: 14px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.driver-card-code {
  font-size: 11px;
  font-weight: 700;
  color: #555;
  font-family: 'DM Mono', monospace;
  letter-spacing: 1px;
}

.driver-card-name {
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  font-family: 'Titillium Web', sans-serif;
}

.driver-card-team {
  font-size: 12px;
  font-weight: 600;
}

.driver-card-pts {
  padding: 0 16px 16px;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.driver-card-pts-value {
  font-size: 28px;
}

.driver-card-pts-label {
  font-size: 12px;
  color: #555;
  text-transform: uppercase;
}

.driver-card-hover-stats {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(8px);
  padding: 16px;
  display: flex;
  justify-content: space-around;
  transform: translateY(100%);
  transition: var(--transition-smooth);
  border-top: 1px solid var(--glass-border);
  z-index: 3;
}

.driver-card:hover .driver-card-hover-stats {
  transform: translateY(0);
}

.hover-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.hover-stat-value {
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  font-family: 'DM Mono', monospace;
}

.hover-stat-label {
  font-size: 10px;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Section */
.section {
  margin-top: 3rem;
}

.section-header {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 1.375rem;
  font-weight: 700;
}

/* H2H */
.h2h-card {
  padding: 1.5rem;
}

.h2h-selectors {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.selector-group {
  flex: 1;
  min-width: 200px;
}

.selector-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #555;
  margin-bottom: 0.5rem;
}

.driver-select {
  width: 100%;
  padding: 0.625rem 0.875rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #fff;
  font-family: 'DM Mono', monospace;
  font-size: 0.875rem;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
}

.driver-select:focus {
  border-color: rgba(255,255,255,0.2);
}

.driver-select option {
  background: #1a1a1a;
}

.vs-label {
  font-size: 1.25rem;
  font-weight: 900;
  color: #333;
  letter-spacing: 0.1em;
  padding-top: 1.5rem;
}

.h2h-comparison {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 2rem;
  align-items: start;
}

/* Stat bars */
.h2h-stats {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stat-compare {}

.stat-bar-label {
  font-size: 0.7rem;
  color: #555;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

.stat-bars {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-bar-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.driver-code-tag {
  font-size: 0.75rem;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  min-width: 32px;
  letter-spacing: 0.04em;
}

.bar-track {
  flex: 1;
  height: 8px;
  background: rgba(255,255,255,0.06);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease;
}

.stat-val {
  font-size: 0.8rem;
  color: #aaa;
  min-width: 48px;
  text-align: right;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #555;
  font-size: 0.875rem;
}

/* Points chart */
.points-chart-wrapper {
  height: 300px;
  padding: 1.5rem;
}

@media (max-width: 1100px) {
  .drivers-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 900px) {
  .h2h-comparison {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .drivers-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .driver-card {
    min-height: 200px;
  }

  .driver-card-photo-wrap {
    height: 120px;
  }

  .driver-card-name {
    font-size: 15px;
  }

  .driver-card-pts-value {
    font-size: 22px;
  }

  @media (hover: none) {
    .driver-card-hover-stats {
      transform: translateY(0);
      background: rgba(0, 0, 0, 0.7);
    }
  }
}

@media (max-width: 480px) {
  .drivers-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
}

@media (min-width: 1280px) {
  .drivers-grid {
    grid-template-columns: repeat(5, 1fr);
    gap: 20px;
  }

  .driver-card {
    min-height: 300px;
  }

  .driver-card-photo-wrap {
    height: 200px;
  }
}

@media (min-width: 1600px) {
  .drivers-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}
</style>
