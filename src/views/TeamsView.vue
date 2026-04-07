<template>
  <div class="teams-view">
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">Teams</h1>
        <span class="page-sub">{{ seasonStore.selectedSeason }} Constructor Championship</span>
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
          class="team-accordion glass-card glass-card--interactive"
          role="link"
          tabindex="0"
          :style="{ '--team-color': getTeamColor(standing.Constructor.name) }"
          @click="goTeam(standing.Constructor.name)"
          @keydown="onTeamCardKey($event, standing.Constructor.name)"
        >
          <div class="team-acc-left">
            <div class="team-acc-bar" />
            <span class="team-acc-pos">P{{ standing.position }}</span>
          </div>

          <div class="team-acc-identity">
            <img
              v-if="teamImages[standing.Constructor.name]"
              class="team-acc-logo"
              :src="teamImages[standing.Constructor.name] || undefined"
              :alt="standing.Constructor.name"
            />
            <div v-else class="team-acc-logo-placeholder">
              {{ standing.Constructor.name.slice(0, 3).toUpperCase() }}
            </div>
            <div>
              <div class="team-acc-name">{{ standing.Constructor.name }}</div>
              <div class="team-acc-nationality">{{ standing.Constructor.nationality }}</div>
            </div>
          </div>

          <div class="team-acc-right">
            <div class="team-acc-pts">
              <span class="stat-number" style="font-size: 36px">{{ standing.points }}</span>
              <span class="team-acc-pts-suffix">PTS</span>
            </div>

            <div
              class="team-driver-contrib"
              v-if="getTeamDriverContributions(standing.Constructor.name, parseFloat(standing.points)).length"
            >
              <div
                v-for="d in getTeamDriverContributions(standing.Constructor.name, parseFloat(standing.points))"
                :key="d.code"
                class="contrib-row"
              >
                <span class="contrib-code">{{ d.code }}</span>
                <div class="contrib-bar-track">
                  <div
                    class="contrib-bar-fill"
                    :style="{
                      width: `${d.percentage}%`,
                      background: 'var(--team-color)',
                    }"
                  />
                </div>
                <span class="contrib-pts">{{ d.points }}</span>
                <span class="contrib-pct">{{ d.percentage }}%</span>
              </div>
            </div>
          </div>

          <div class="team-acc-arrow" aria-hidden="true">→</div>
        </div>
      </div>

      <!-- Constructor Points Bar Chart -->
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Points Comparison</h2>
        </div>
        <div class="glass-card glass-card--static chart-card">
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
        <div class="glass-card glass-card--static">
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
        <div class="glass-card glass-card--static chart-card-lg" v-if="seasonStore.schedule.length">
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
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend
} from 'chart.js'
import { useSeasonStore } from '@/stores/seasonStore'
import { getTeamColor, getCircuitFlag } from '@/constants/teams'
interface DriverContribution {
  code: string
  name: string
  points: number
  percentage: number
}
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import { getAllTeamImages } from '@/api/wikipedia'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const seasonStore = useSeasonStore()
const router = useRouter()

function goTeam(name: string) {
  router.push(`/teams/${encodeURIComponent(name)}`)
}

function onTeamCardKey(e: KeyboardEvent, name: string) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    goTeam(name)
  }
}

const teamImages = ref<Record<string, string | null>>({})

const pastRaces = computed(() =>
  seasonStore.schedule.filter(r => new Date(r.date) < new Date())
)

/**
 * Both drivers' points contributions for a constructor (driver standings cross-ref).
 * Sorted by points descending.
 */
function getTeamDriverContributions(
  constructorName: string,
  totalPoints: number
): DriverContribution[] {
  const teamDrivers = seasonStore.driverStandings.filter(d =>
    d.Constructors.some(c => c.name === constructorName)
  )

  return teamDrivers
    .map(d => {
      const pts = parseFloat(d.points) || 0
      return {
        code: d.Driver.code,
        name: d.Driver.familyName,
        points: Math.round(pts),
        percentage:
          totalPoints > 0 ? Math.round((pts / totalPoints) * 100) : 0,
      }
    })
    .sort((a, b) => b.points - a.points)
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
      // Chart.js expects numeric values, not formatted strings.
      data: teamAvgs.map(t => Number(t.avg.toFixed(1))),
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

watch(
  () => seasonStore.selectedSeason,
  async () => {
    await seasonStore.loadCurrentSeason()
  },
  { immediate: true }
)

watch(
  () => seasonStore.constructorStandings,
  async (standings) => {
    if (!standings.length) return
    const names = standings.map(t => t.Constructor.name)
    teamImages.value = await getAllTeamImages(names)
  },
  { immediate: true }
)
</script>

<style scoped>
.teams-view {
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

.loading-state {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

/* Team accordion */
.teams-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.team-accordion {
  display: grid;
  grid-template-columns: 60px minmax(200px, 280px) 1fr 40px;
  align-items: center;
  gap: 24px;
  padding: 20px 24px;
  cursor: pointer;
  border-radius: 14px;
}

.team-acc-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.team-acc-bar {
  width: 4px;
  height: 48px;
  background: var(--team-color);
  border-radius: 2px;
  flex-shrink: 0;
}

.team-acc-pos {
  font-size: 22px;
  font-weight: 900;
  color: var(--team-color);
  font-family: 'DM Mono', monospace;
}

.team-acc-identity {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.team-acc-logo {
  width: 52px;
  height: 52px;
  object-fit: contain;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 4px;
}

.team-acc-logo-placeholder {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  color: var(--team-color);
  font-family: 'DM Mono', monospace;
}

.team-acc-name {
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  font-family: 'Titillium Web', sans-serif;
}

.team-acc-nationality {
  font-size: 12px;
  color: #555;
  margin-top: 2px;
}

.team-acc-right {
  display: flex;
  align-items: center;
  gap: 32px;
  min-width: 0;
}

.team-acc-pts {
  display: flex;
  align-items: baseline;
  flex-shrink: 0;
}

.team-acc-pts-suffix {
  font-size: 13px;
  color: #555;
  margin-left: 6px;
}

.team-driver-contrib {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.contrib-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.contrib-code {
  font-size: 11px;
  font-weight: 700;
  color: #666;
  font-family: 'DM Mono', monospace;
  width: 36px;
  flex-shrink: 0;
}

.contrib-bar-track {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
}

.contrib-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.8;
}

.contrib-pts {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  font-family: 'DM Mono', monospace;
  width: 36px;
  text-align: right;
  flex-shrink: 0;
}

.contrib-pct {
  font-size: 11px;
  color: #555;
  width: 36px;
  flex-shrink: 0;
}

.team-acc-arrow {
  font-size: 18px;
  color: #333;
  transition: var(--transition-smooth);
}

.team-accordion:hover .team-acc-arrow {
  color: #fff;
  transform: translateX(4px);
}

@media (max-width: 1024px) {
  .team-accordion {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .team-acc-arrow {
    display: none;
  }

  .team-acc-right {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
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

@media (max-width: 768px) {
  .team-accordion {
    grid-template-columns: 48px 1fr auto 32px;
    gap: 12px;
    padding: 16px var(--page-padding, 16px);
  }

  .team-acc-nationality {
    display: none;
  }

  .team-acc-name {
    font-size: 15px;
  }

  .team-acc-right {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .team-acc-pts {
    margin-bottom: 0;
  }

  .contrib-bar-track {
    width: 100%;
    min-width: 100px;
  }

  .contrib-row {
    gap: 6px;
  }

  .contrib-pts,
  .contrib-pct {
    font-size: 11px;
  }
}

@media (min-width: 1280px) {
  .team-accordion {
    grid-template-columns: 80px 320px 1fr 40px;
    gap: 32px;
    padding: 24px 32px;
  }

  .team-acc-name {
    font-size: 20px;
  }

  .team-acc-logo {
    width: 64px;
    height: 64px;
  }

  .contrib-bar-track {
    min-width: 200px;
  }
}
</style>
