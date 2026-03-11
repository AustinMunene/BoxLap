<template>
  <div class="teams-view">
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">Teams</h1>
        <span class="page-sub">{{ seasonStore.currentYear }} Constructor Championship</span>
      </div>

      <!-- Loading -->
      <div v-if="seasonStore.loading" class="loading-state">
        <SkeletonBlock v-for="n in 5" :key="n" height="100px" rounded />
      </div>

      <!-- Team Cards -->
      <div v-else class="teams-list">
        <div
          v-for="standing in seasonStore.constructorStandings"
          :key="standing.Constructor.constructorId"
          class="team-card glass-card"
          :style="{ '--team-color': getTeamColor(standing.Constructor.name) }"
        >
          <div class="card-color-bar"></div>
          <div class="card-body">
            <div class="team-main">
              <div class="team-position font-data">P{{ standing.position }}</div>
              <div class="team-name-block">
                <div class="team-name" :style="{ color: getTeamColor(standing.Constructor.name) }">
                  {{ standing.Constructor.name }}
                </div>
                <div class="team-nationality">{{ standing.Constructor.nationality }}</div>
              </div>
            </div>
            <div class="team-stats">
              <div class="stat">
                <div class="stat-val font-data">{{ standing.points }}</div>
                <div class="stat-label">Points</div>
              </div>
              <div class="stat">
                <div class="stat-val font-data">{{ standing.wins }}</div>
                <div class="stat-label">Wins</div>
              </div>
              <div class="stat">
                <div class="stat-val font-data">
                  {{ getTeamDrivers(standing.Constructor.name).join(' / ') }}
                </div>
                <div class="stat-label">Drivers</div>
              </div>
            </div>
          </div>
          <!-- Points bar -->
          <div class="points-bar">
            <div
              class="points-bar-fill"
              :style="{
                width: `${(parseFloat(standing.points) / maxPoints) * 100}%`,
                background: getTeamColor(standing.Constructor.name)
              }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Constructor Points Bar Chart -->
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Points Comparison</h2>
        </div>
        <div class="glass-card chart-card">
          <div class="chart-wrapper">
            <Bar v-if="constructorChartData" :data="constructorChartData" :options="constructorChartOptions" />
          </div>
        </div>
      </section>

      <!-- Pit Stop Performance -->
      <section class="section" v-if="seasonStore.lastRaceResults">
        <div class="section-header">
          <h2 class="section-title">Pit Crew Performance</h2>
          <span class="section-sub">Last Race</span>
        </div>
        <div class="glass-card">
          <div class="pit-chart-wrapper">
            <Bar v-if="pitChartData" :data="pitChartData" :options="pitChartOptions" />
            <div v-else class="empty-state">No pit data available</div>
          </div>
        </div>
      </section>

      <!-- Race-by-Race Points -->
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Season Story</h2>
          <span class="section-sub">Race results overview</span>
        </div>
        <div class="glass-card chart-card-lg" v-if="seasonStore.schedule.length">
          <div class="race-list">
            <div
              v-for="race in pastRaces"
              :key="race.round"
              class="race-entry"
            >
              <span class="race-round font-data">R{{ race.round }}</span>
              <span class="race-flag">{{ getCircuitFlag(race.Circuit.Location.country) }}</span>
              <span class="race-name">{{ race.raceName.replace(' Grand Prix', ' GP') }}</span>
              <router-link
                :to="`/race/${race.season}/${race.round}`"
                class="race-link"
              >
                View →
              </router-link>
            </div>
            <div v-if="!pastRaces.length" class="empty-state">No races completed yet this season.</div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend
} from 'chart.js'
import { useSeasonStore } from '@/stores/seasonStore'
import { getTeamColor, getCircuitFlag } from '@/constants/teams'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const seasonStore = useSeasonStore()

const maxPoints = computed(() => {
  const pts = seasonStore.constructorStandings.map(s => parseFloat(s.points))
  return Math.max(...pts, 1)
})

const pastRaces = computed(() =>
  seasonStore.schedule.filter(r => new Date(r.date) < new Date())
)

function getTeamDrivers(teamName: string): string[] {
  return seasonStore.driverStandings
    .filter(d => d.Constructors[0]?.name === teamName)
    .map(d => d.Driver.code)
    .slice(0, 2)
}

// Constructor chart
const constructorChartData = computed(() => {
  const standings = seasonStore.constructorStandings
  if (!standings.length) return null
  return {
    labels: standings.map(s => s.Constructor.name.split(' ').pop()),
    datasets: [{
      data: standings.map(s => parseFloat(s.points)),
      backgroundColor: standings.map(s => getTeamColor(s.Constructor.name) + 'cc'),
      borderColor: standings.map(s => getTeamColor(s.Constructor.name)),
      borderWidth: 1,
      borderRadius: 4,
    }]
  }
})

const constructorChartOptions = {
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
      ticks: { color: '#888', font: { family: 'DM Mono', size: 10 } }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { size: 10 } }
    }
  }
}

// Pit stop data from last race
const pitChartData = computed(() => {
  const lastResults = seasonStore.lastRaceResults?.results
  if (!lastResults?.length) return null

  const teamTimes: Record<string, number[]> = {}
  for (const r of lastResults) {
    const team = r.Constructor.name
    // We only have Ergast data here, so we show finishing positions as proxy
    const pos = parseInt(r.position)
    if (!isNaN(pos)) {
      if (!teamTimes[team]) teamTimes[team] = []
      teamTimes[team].push(pos)
    }
  }

  const teamAvgs = Object.entries(teamTimes).map(([team, positions]) => ({
    team,
    avg: positions.reduce((a, b) => a + b, 0) / positions.length,
  })).sort((a, b) => a.avg - b.avg)

  return {
    labels: teamAvgs.map(t => t.team.split(' ').pop()),
    datasets: [{
      label: 'Avg Finishing Position (lower is better)',
      data: teamAvgs.map(t => t.avg.toFixed(1)),
      backgroundColor: teamAvgs.map(t => getTeamColor(t.team) + 'cc'),
      borderColor: teamAvgs.map(t => getTeamColor(t.team)),
      borderWidth: 1,
      borderRadius: 4,
    }]
  }
})

const pitChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111',
      borderColor: '#333',
      borderWidth: 1,
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#888', font: { family: 'DM Mono', size: 10 } }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { size: 10 } }
    }
  }
}

onMounted(() => {
  if (!seasonStore.constructorStandings.length) {
    seasonStore.loadCurrentSeason()
  }
})
</script>

<style scoped>
.teams-view {
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

.loading-state {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

/* Team Cards */
.teams-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.team-card {
  overflow: hidden;
}

.card-color-bar {
  height: 3px;
  background: var(--team-color);
}

.card-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.team-main {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.team-position {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--team-color);
  min-width: 40px;
}

.team-name {
  font-size: 1.125rem;
  font-weight: 700;
}

.team-nationality {
  font-size: 0.8rem;
  color: #555;
  margin-top: 0.1rem;
}

.team-stats {
  display: flex;
  gap: 2.5rem;
}

.stat {
  text-align: center;
}

.stat-val {
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
}

.stat-label {
  font-size: 0.65rem;
  color: #555;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-top: 0.2rem;
}

.points-bar {
  height: 3px;
  background: rgba(255,255,255,0.04);
}

.points-bar-fill {
  height: 100%;
  opacity: 0.4;
  transition: width 0.8s ease;
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

.section-sub {
  font-size: 0.875rem;
  color: #555;
}

.chart-card {
  padding: 1.5rem;
}

.chart-wrapper, .pit-chart-wrapper {
  height: 300px;
}

.chart-card-lg {
  padding: 1.5rem;
}

/* Race list */
.race-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.race-entry {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.race-round {
  font-size: 0.7rem;
  color: #555;
  min-width: 30px;
}

.race-flag {
  font-size: 1.1rem;
}

.race-name {
  flex: 1;
  font-size: 0.875rem;
}

.race-link {
  font-size: 0.8rem;
  color: #E8002D;
  text-decoration: none;
  font-weight: 600;
  transition: opacity 0.15s;
}

.race-link:hover { opacity: 0.75; }

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #555;
  font-size: 0.875rem;
}
</style>
