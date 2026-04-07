<template>
  <div class="team-profile">
    <div class="container">
      <router-link to="/teams" class="back-link">← Teams</router-link>

      <div
        v-if="standing"
        class="team-profile-hero"
        :style="{ '--team-color': getTeamColor(teamName) }"
        :data-team="teamName"
      >
        <div class="team-logo-large glass-card glass-card--static">
          <img
            v-if="teamImage"
            class="logo"
            :src="teamImage"
            :alt="teamName"
          />
          <div v-else class="logo-fallback font-data">{{ initials }}</div>
        </div>
        <div>
          <span class="season-pill font-data">{{ seasonStore.selectedSeason }}</span>
          <h1 class="team-hero-title">{{ teamName }}</h1>
          <p class="meta-line">
            <span class="font-data">P{{ standing.position }}</span>
            <span class="dot">·</span>
            <span class="font-data">{{ standing.points }} pts</span>
            <span class="dot">·</span>
            <span class="font-data">{{ standing.wins }} wins</span>
          </p>
        </div>
      </div>
      <div v-else class="team-profile-hero team-profile-hero--minimal">
        <p class="meta-line muted">No constructor entry for this season.</p>
      </div>

      <div v-if="loading" class="loading">
        <SkeletonBlock height="180px" rounded />
        <SkeletonBlock height="280px" rounded />
      </div>
      <div v-else-if="error" class="error-banner glass-card">{{ error }}</div>

      <template v-else-if="standing">
        <section v-if="driverContributions.length" class="contribution-section">
          <h2 class="section-title">Points Contribution</h2>
          <p class="section-sub">
            How {{ teamName }}'s {{ totalPointsDisplay }} constructor points break down by driver
          </p>

          <div class="contribution-cards">
            <div
              v-for="driver in driverContributions"
              :key="driver.code"
              class="contribution-card glass-card glass-card--interactive"
              :style="{ '--driver-color': teamColorCss }"
              role="link"
              tabindex="0"
              @click="router.push(`/drivers/${driver.code}`)"
              @keydown.enter="router.push(`/drivers/${driver.code}`)"
            >
              <div class="contribution-header">
                <span class="contribution-name">{{ driver.name }}</span>
                <span class="contribution-code">{{ driver.code }}</span>
              </div>

              <div class="contribution-pts-row">
                <span class="contribution-pts-value stat-number">{{ driver.points }}</span>
                <span class="contribution-pts-label">PTS</span>
              </div>

              <div class="contribution-pct-bar">
                <div
                  class="contribution-pct-fill"
                  :style="{ width: `${driver.percentage}%` }"
                />
              </div>

              <div class="contribution-footer">
                <span class="contribution-pct-text">{{ driver.percentage }}% of team points</span>
                <span class="contribution-link">View profile →</span>
              </div>
            </div>
          </div>

          <div v-if="driverContributions.length >= 2" class="contribution-split-bar">
            <div
              class="split-fill split-fill--a"
              :style="{
                width: `${driverContributions[0]?.percentage ?? 50}%`,
                background: teamColorCss,
              }"
            />
            <div
              class="split-fill split-fill--b"
              :style="{
                width: `${driverContributions[1]?.percentage ?? 50}%`,
                background: teamColorMuted,
              }"
            />
          </div>
          <div v-if="driverContributions.length >= 2" class="split-labels">
            <span>{{ driverContributions[0]?.code }} {{ driverContributions[0]?.percentage }}%</span>
            <span>{{ driverContributions[1]?.code }} {{ driverContributions[1]?.percentage }}%</span>
          </div>
        </section>

        <section class="section">
          <h2 class="section-title">Drivers</h2>
          <div class="drivers-row">
            <router-link
              v-for="d in teamDrivers"
              :key="d.Driver.driverId"
              :to="`/drivers/${d.Driver.code}`"
              class="driver-chip glass-card glass-card--interactive"
              :style="{ '--c': getTeamColor(teamName) }"
            >
              <span class="font-data">{{ d.Driver.code }}</span>
              <span>{{ d.Driver.familyName }}</span>
            </router-link>
          </div>
        </section>

        <section class="section">
          <h2 class="section-title">Points progression</h2>
          <p class="section-kicker">Cumulative constructor points after each race.</p>
          <div class="glass-card glass-card--static table-wrap">
            <table class="results-table">
              <thead>
                <tr>
                  <th>Rnd</th>
                  <th>Event</th>
                  <th>Race pts</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in progressionRows" :key="row.round">
                  <td class="font-data">{{ row.round }}</td>
                  <td>{{ row.raceName }}</td>
                  <td class="font-data">{{ row.racePts }}</td>
                  <td class="font-data">{{ row.cumulative }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="!progressionRows.length" class="empty">No race data for this season.</div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSeasonStore } from '@/stores/seasonStore'
import { getConstructorResults, type ErgastRace, type ErgastRaceResult } from '@/api/ergast'
import { getTeamColor } from '@/constants/teams'
import { getAllTeamImages } from '@/api/wikipedia'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'

const props = defineProps<{
  name: string
}>()

const route = useRoute()
const seasonStore = useSeasonStore()
const router = useRouter()

/** If the route ever includes `:season`, align the navbar before `watch` immediate runs. */
{
  const raw = route.params.season
  if (raw != null && String(raw) !== '') {
    const urlSeason = Number(Array.isArray(raw) ? raw[0] : raw)
    if (Number.isFinite(urlSeason) && urlSeason !== seasonStore.selectedSeason) {
      seasonStore.syncSelectedSeasonOnly(urlSeason)
    }
  }
}
const loading = ref(false)
const error = ref('')
const teamImage = ref<string | null>(null)
const constructorPayload = ref<{
  MRData?: { RaceTable?: { Races?: Array<ErgastRace & { Results?: ErgastRaceResult[] }> } }
} | null>(null)

const teamName = computed(() => decodeURIComponent(props.name || '').trim())

const standing = computed(() =>
  seasonStore.constructorStandings.find(
    s => s.Constructor.name === teamName.value
  )
)

const initials = computed(() => {
  const parts = teamName.value.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return teamName.value.slice(0, 2).toUpperCase()
})

const teamDrivers = computed(() =>
  seasonStore.driverStandings.filter(d => d.Constructors[0]?.name === teamName.value)
)

const totalPointsDisplay = computed(() =>
  Math.round(parseFloat(standing.value?.points || '0') || 0)
)

const teamColorCss = computed(() => getTeamColor(teamName.value))
const teamColorMuted = computed(() => `${getTeamColor(teamName.value)}66`)

interface DriverContributionRow {
  code: string
  name: string
  points: number
  percentage: number
}

const driverContributions = computed((): DriverContributionRow[] => {
  const st = standing.value
  if (!st) return []
  const total = parseFloat(st.points) || 0
  if (total <= 0) return []
  const name = teamName.value
  return seasonStore.driverStandings
    .filter(d => d.Constructors.some(c => c.name === name))
    .map(d => {
      const pts = parseFloat(d.points) || 0
      return {
        code: d.Driver.code,
        name: d.Driver.familyName,
        points: Math.round(pts),
        percentage: Math.round((pts / total) * 100),
      }
    })
    .sort((a, b) => b.points - a.points)
})

const progressionRows = computed(() => {
  const cid = standing.value?.Constructor.constructorId
  const races = constructorPayload.value?.MRData?.RaceTable?.Races ?? []
  if (!cid) return []

  let cumulative = 0
  const rows: Array<{ round: string; raceName: string; racePts: string; cumulative: string }> = []

  for (const race of races as ErgastRace[]) {
    const teamPts =
      race.Results?.filter(r => r.Constructor.constructorId === cid)
        .reduce((sum, r) => sum + parseFloat(r.points || '0'), 0) ?? 0
    cumulative += teamPts
    rows.push({
      round: race.round,
      raceName: race.raceName.replace(' Grand Prix', ' GP'),
      racePts: teamPts.toFixed(teamPts % 1 === 0 ? 0 : 1),
      cumulative: cumulative.toFixed(cumulative % 1 === 0 ? 0 : 1),
    })
  }
  return rows
})

async function loadTeam() {
  loading.value = true
  error.value = ''
  try {
    if (!seasonStore.constructorStandings.length) {
      await seasonStore.loadCurrentSeason()
    }
    const st = standing.value
    if (!st) {
      constructorPayload.value = null
      teamImage.value = null
      return
    }
    const imgs = await getAllTeamImages([teamName.value])
    teamImage.value = imgs[teamName.value] ?? null

    constructorPayload.value = (await getConstructorResults(
      seasonStore.selectedSeason,
      st.Constructor.constructorId
    )) as typeof constructorPayload.value
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load team'
    constructorPayload.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => [teamName.value, seasonStore.selectedSeason] as const,
  () => {
    void loadTeam()
  },
  { immediate: true }
)
</script>

<style scoped>
.team-profile {
  padding-bottom: 4rem;
}


.back-link {
  display: inline-block;
  color: #666;
  text-decoration: none;
  font-size: 0.875rem;
  margin-bottom: 1.25rem;
}

.back-link:hover {
  color: #fff;
}

.team-profile-hero {
  position: relative;
  padding: 48px 0 40px;
  margin-bottom: 48px;
  border-bottom: 1px solid var(--glass-border);
  display: grid;
  grid-template-columns: 160px 1fr;
  align-items: center;
  gap: 40px;
  overflow: hidden;
}

.team-profile-hero--minimal {
  grid-template-columns: 1fr;
  padding: 24px 0;
}

.team-profile-hero::before {
  content: attr(data-team);
  position: absolute;
  right: -20px;
  top: 0;
  font-size: clamp(48px, 12vw, 100px);
  font-weight: 900;
  color: var(--team-color);
  opacity: 0.06;
  white-space: nowrap;
  pointer-events: none;
  font-family: 'Titillium Web', sans-serif;
  max-width: 100%;
  overflow: hidden;
}

.team-logo-large {
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  position: relative;
  z-index: 1;
}

.team-logo-large .logo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.logo-fallback {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--team-color, #888);
}

.season-pill {
  display: block;
  font-size: 0.7rem;
  color: #666;
  letter-spacing: 0.08em;
  margin-bottom: 0.35rem;
}

.team-hero-title {
  font-size: 1.75rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  margin: 0 0 0.35rem;
  position: relative;
  z-index: 1;
}

.meta-line {
  font-size: 0.9rem;
  color: #aaa;
  margin: 0;
}

.meta-line.muted {
  color: #666;
}

.dot {
  margin: 0 0.35rem;
  color: #444;
}

.loading {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.error-banner {
  padding: 1rem 1.25rem;
  color: #fca5a5;
}

.section {
  margin-top: 2.5rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.section-kicker {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  color: #666;
}

.drivers-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.driver-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.9rem;
  text-decoration: none;
  color: #eee;
  border-left: 3px solid var(--c);
  transition: transform 0.15s, box-shadow 0.15s;
}

.driver-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.contribution-section {
  margin: 40px 0;
}

.section-sub {
  font-size: 0.9rem;
  color: #666;
  margin: 0 0 0.5rem;
}

.contribution-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 20px 0;
}

.contribution-card {
  padding: 24px;
  cursor: pointer;
  border-top: 3px solid var(--driver-color);
}

.contribution-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}

.contribution-name {
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  font-family: 'Titillium Web', sans-serif;
}

.contribution-code {
  font-size: 12px;
  font-weight: 700;
  color: #555;
  font-family: 'DM Mono', monospace;
}

.contribution-pts-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 16px;
}

.contribution-pts-value {
  font-size: 52px;
}

.contribution-pts-label {
  font-size: 14px;
  color: #555;
}

.contribution-pct-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}

.contribution-pct-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--driver-color);
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
}

.contribution-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.contribution-pct-text {
  font-size: 13px;
  color: #555;
}

.contribution-link {
  font-size: 13px;
  color: #444;
  transition: color 0.2s;
}

.contribution-card:hover .contribution-link {
  color: #fff;
}

.contribution-split-bar {
  display: flex;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  gap: 2px;
  margin-top: 8px;
}

.split-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
}

.split-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 700;
  color: #555;
  font-family: 'DM Mono', monospace;
}

@media (max-width: 768px) {
  .team-profile-hero {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 28px 0 28px;
  }

  .team-logo-large {
    width: 100px;
    height: 100px;
  }

  .team-profile-hero::before {
    display: none;
  }

  .contribution-cards {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .contribution-pts-value {
    font-size: 36px;
  }

  .table-wrap {
    overflow-x: auto;
  }
}

.table-wrap {
  overflow-x: auto;
  padding: 0;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.results-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #555;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.results-table td {
  padding: 0.65rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.empty {
  padding: 2rem;
  text-align: center;
  color: #666;
}
</style>
