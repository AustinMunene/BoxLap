<template>
  <div class="drivers-view">
    <div class="container">
      <!-- Header -->
      <div class="page-header">
        <h1 class="page-title">Drivers</h1>
        <span class="page-sub">{{ seasonStore.currentYear }} Championship</span>
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
          class="driver-card glass-card"
          :style="{ '--team-color': getTeamColor(standing.Constructors[0]?.name || '') }"
        >
          <div class="card-team-strip"></div>
          <div class="card-content">
            <div class="card-top">
              <span class="card-pos font-data">P{{ standing.position }}</span>
              <span class="card-pts font-data">{{ standing.points }} pts</span>
            </div>
            <div class="card-driver">
              <div class="driver-num font-data">{{ standing.Driver.permanentNumber }}</div>
              <div class="driver-names">
                <div class="driver-given">{{ standing.Driver.givenName }}</div>
                <div class="driver-family">{{ standing.Driver.familyName }}</div>
              </div>
            </div>
            <div class="card-bottom">
              <span class="team-name" :style="{ color: getTeamColor(standing.Constructors[0]?.name || '') }">
                {{ standing.Constructors[0]?.name }}
              </span>
              <span class="wins-badge" v-if="parseInt(standing.wins) > 0">
                {{ standing.wins }}W
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Head-to-Head Comparison -->
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Head-to-Head</h2>
        </div>
        <div class="glass-card h2h-card">
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
                  {{ s.Driver.code }} — {{ s.Driver.givenName }} {{ s.Driver.familyName }}
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
                  {{ s.Driver.code }} — {{ s.Driver.givenName }} {{ s.Driver.familyName }}
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
        <div class="glass-card">
          <div class="points-chart-wrapper">
            <Bar v-if="pointsChartData" :data="pointsChartData" :options="pointsChartOptions" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend
} from 'chart.js'
import { useSeasonStore } from '@/stores/seasonStore'
import { getTeamColor } from '@/constants/teams'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import RadarChart from '@/components/charts/RadarChart.vue'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const seasonStore = useSeasonStore()

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

onMounted(() => {
  if (!seasonStore.driverStandings.length) {
    seasonStore.loadCurrentSeason()
  }
})
</script>

<style scoped>
.drivers-view {
  padding-bottom: 4rem;
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem;
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
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.875rem;
}

.driver-card {
  display: flex;
  overflow: hidden;
  transition: transform 0.2s;
}

.driver-card:hover {
  transform: translateY(-3px);
}

.card-team-strip {
  width: 4px;
  background: var(--team-color);
  flex-shrink: 0;
}

.card-content {
  padding: 1.125rem 1.125rem 1rem;
  flex: 1;
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.card-pos {
  font-size: 0.7rem;
  font-weight: 700;
  color: #555;
  letter-spacing: 0.08em;
}

.card-pts {
  font-size: 0.75rem;
  color: #FFC906;
  font-weight: 600;
}

.card-driver {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  margin-bottom: 0.875rem;
}

.driver-num {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--team-color);
  line-height: 1;
}

.driver-names {}

.driver-given {
  font-size: 0.75rem;
  color: #888;
}

.driver-family {
  font-size: 1rem;
  font-weight: 700;
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.team-name {
  font-size: 0.75rem;
  font-weight: 600;
}

.wins-badge {
  font-size: 0.65rem;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  background: rgba(232, 0, 45, 0.15);
  border: 1px solid rgba(232, 0, 45, 0.3);
  color: #E8002D;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
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

@media (max-width: 900px) {
  .h2h-comparison {
    grid-template-columns: 1fr;
  }
}
</style>
