<template>
  <div class="driver-profile">
    <div class="container">
      <router-link to="/drivers" class="back-link">← Drivers</router-link>

      <div
        v-if="standing"
        class="driver-profile-hero"
        :style="{
          '--team-color': teamColor,
        }"
        :data-number="standing.Driver.permanentNumber || standing.position"
      >
        <img
          v-if="headshot"
          class="driver-hero-photo"
          :src="headshot"
          :alt="driverCode"
        />
        <div v-else class="driver-hero-photo driver-hero-photo--fallback font-data">{{ driverCode }}</div>
        <div class="driver-hero-copy">
          <span class="season-pill font-data">{{ seasonStore.selectedSeason }}</span>
          <div class="driver-hero-number">{{ standing.Driver.permanentNumber }}</div>
          <h1 class="driver-hero-name">
            {{ standing.Driver.givenName }} {{ standing.Driver.familyName }}
          </h1>
          <p class="meta-line">
            <span :style="{ color: teamColor }">{{ standing.Constructors[0]?.name }}</span>
          </p>
          <div class="season-stats-row">
            <div class="season-stat-chip">
              <span class="season-stat-value">P{{ standing.position }}</span>
              <span class="season-stat-label">Standing</span>
            </div>
            <div class="season-stat-chip">
              <span class="season-stat-value">{{ standing.points }}</span>
              <span class="season-stat-label">Points</span>
            </div>
            <div class="season-stat-chip">
              <span class="season-stat-value">{{ standing.wins }}</span>
              <span class="season-stat-label">Wins</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="driver-profile-hero driver-profile-hero--minimal">
        <div class="driver-hero-copy">
          <span class="season-pill font-data">{{ seasonStore.selectedSeason }}</span>
          <h1 class="driver-hero-name">{{ driverCode }}</h1>
          <p class="meta-line muted">No championship entry for this season.</p>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <SkeletonBlock height="200px" rounded />
        <SkeletonBlock height="320px" rounded />
      </div>

      <div v-else-if="error" class="error-banner glass-card">{{ error }}</div>

      <template v-else>
        <section v-if="teammateStanding && h2h" class="section">
          <h2 class="section-title">vs teammate</h2>
          <div class="glass-card glass-card--static h2h-card">
            <div class="h2h-row">
              <span class="font-data code" :style="{ color: teamColor }">{{ driverCode }}</span>
              <span class="h2h-mid font-data">{{ h2h.selfWins }}–{{ h2h.mateWins }}</span>
              <span class="font-data code" :style="{ color: getTeamColor(teammateStanding.Constructors[0]?.name || '') }">
                {{ teammateStanding.Driver.code }}
              </span>
            </div>
            <p class="h2h-note">Head-to-head on races where both drivers classified (finished).</p>
          </div>
        </section>

        <section class="section">
          <h2 class="section-title">Race results</h2>
          <div class="glass-card glass-card--static table-wrap">
            <table class="results-table">
              <thead>
                <tr>
                  <th>Rnd</th>
                  <th>Grand Prix</th>
                  <th>Pos</th>
                  <th>Pts</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in resultRows"
                  :key="row.round"
                  class="results-row"
                  :class="resultRowClass(row)"
                >
                  <td class="font-data">{{ row.round }}</td>
                  <td>
                    <router-link
                      v-if="row.canLink"
                      :to="`/race/${seasonStore.selectedSeason}/${row.round}`"
                      class="gp-link"
                    >
                      {{ row.raceName }}
                    </router-link>
                    <span v-else>{{ row.raceName }}</span>
                  </td>
                  <td class="font-data">{{ row.position }}</td>
                  <td class="font-data">{{ row.points }}</td>
                  <td class="status-cell">{{ row.status }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="!resultRows.length" class="empty">No race results for this season.</div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSeasonStore } from '@/stores/seasonStore'
import { getDriverResults, type ErgastRaceResult, type ErgastRace } from '@/api/ergast'
import { getTeamColor } from '@/constants/teams'
import { getWikipediaImage, DRIVER_WIKI_NAMES } from '@/api/wikipedia'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import { getRaceAvailability } from '@/utils/raceAvailability'

const props = defineProps<{
  code: string
}>()

const route = useRoute()
const seasonStore = useSeasonStore()

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
const headshot = ref<string | null>(null)
const driverResultsPayload = ref<{
  MRData?: { RaceTable?: { Races?: Array<ErgastRace & { Results?: ErgastRaceResult[] }> } }
} | null>(null)

const driverCode = computed(() => props.code.trim().toUpperCase())

const standing = computed(() =>
  seasonStore.driverStandings.find(
    s => s.Driver.code.toUpperCase() === driverCode.value
  )
)

const teamColor = computed(() => getTeamColor(standing.value?.Constructors[0]?.name || ''))

const teammateStanding = computed(() => {
  const s = standing.value
  if (!s) return null
  const cid = s.Constructors[0]?.constructorId
  if (!cid) return null
  return (
    seasonStore.driverStandings.find(
      d => d.Driver.driverId !== s.Driver.driverId && d.Constructors[0]?.constructorId === cid
    ) ?? null
  )
})

const resultRows = computed(() => {
  const races = driverResultsPayload.value?.MRData?.RaceTable?.Races ?? []
  const did = standing.value?.Driver.driverId
  const season = seasonStore.selectedSeason
  const rows: Array<{
    round: string
    raceName: string
    position: string
    points: string
    status: string
    canLink: boolean
  }> = []

  for (const race of races as ErgastRace[]) {
    const row = race.Results?.find(r => r.Driver.driverId === did)
    if (!row) continue
    const avail = getRaceAvailability(race.date, season)
    rows.push({
      round: race.round,
      raceName: race.raceName.replace(' Grand Prix', ' GP'),
      position: row.positionText || row.position,
      points: row.points,
      status: row.status,
      canLink: avail === 'available' || avail === 'today',
    })
  }
  return rows
})

const h2h = computed(() => {
  const self = standing.value
  const mate = teammateStanding.value
  const races = driverResultsPayload.value?.MRData?.RaceTable?.Races ?? []
  if (!self || !mate) return null

  let selfWins = 0
  let mateWins = 0

  for (const race of races) {
    const a = race.Results?.find(r => r.Driver.driverId === self.Driver.driverId)
    const b = race.Results?.find(r => r.Driver.driverId === mate.Driver.driverId)
    if (!a || !b) continue
    if (a.status !== 'Finished' || b.status !== 'Finished') continue
    const pa = parseInt(a.position, 10)
    const pb = parseInt(b.position, 10)
    if (!Number.isFinite(pa) || !Number.isFinite(pb)) continue
    if (pa < pb) selfWins++
    else if (pb < pa) mateWins++
  }

  if (selfWins === 0 && mateWins === 0) return null
  return { selfWins, mateWins }
})

async function loadDriver() {
  loading.value = true
  error.value = ''
  try {
    if (!seasonStore.driverStandings.length) {
      await seasonStore.loadCurrentSeason()
    }
    const sid = standing.value?.Driver.driverId
    if (!sid) {
      driverResultsPayload.value = null
      return
    }
    driverResultsPayload.value = (await getDriverResults(
      seasonStore.selectedSeason,
      sid
    )) as typeof driverResultsPayload.value

    const wiki = DRIVER_WIKI_NAMES[driverCode.value]
    headshot.value = wiki ? await getWikipediaImage(wiki) : null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load driver'
    driverResultsPayload.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => [driverCode.value, seasonStore.selectedSeason] as const,
  () => {
    void loadDriver()
  },
  { immediate: true }
)

function resultRowClass(row: { position: string; status: string }) {
  if (row.status !== 'Finished') return 'results-row--dnf'
  const p = parseInt(row.position, 10)
  if (p === 1) return 'results-row--win'
  if (p === 2 || p === 3) return 'results-row--podium'
  return ''
}
</script>

<style scoped>
.driver-profile {
  padding-bottom: 4rem;
}

.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.5rem;
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

.driver-profile-hero {
  position: relative;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 48px;
  align-items: end;
  padding-bottom: 48px;
  margin-bottom: 48px;
  border-bottom: 1px solid var(--glass-border);
  overflow: hidden;
}

.driver-profile-hero--minimal {
  grid-template-columns: 1fr;
  align-items: start;
}

.driver-profile-hero::before {
  content: attr(data-number);
  position: absolute;
  right: 0;
  top: -20px;
  font-size: 220px;
  font-weight: 900;
  color: var(--team-color, #888);
  opacity: 0.04;
  line-height: 1;
  font-family: 'DM Mono', monospace;
  pointer-events: none;
  user-select: none;
}

.driver-hero-photo {
  width: 280px;
  height: 320px;
  object-fit: cover;
  object-position: top;
  border-radius: 16px;
  border: 1px solid var(--glass-border);
}

.driver-hero-photo--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.04);
  color: #888;
}

.driver-hero-copy {
  position: relative;
  z-index: 1;
}

.season-pill {
  display: inline-block;
  font-size: 0.7rem;
  color: #666;
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
}

.driver-hero-number {
  font-size: 80px;
  font-weight: 900;
  color: var(--team-color, #888);
  opacity: 0.8;
  font-family: 'DM Mono', monospace;
  line-height: 1;
  margin-bottom: 8px;
}

.driver-hero-name {
  font-size: 48px;
  font-weight: 900;
  color: #fff;
  font-family: 'Titillium Web', sans-serif;
  line-height: 1.1;
  margin-bottom: 12px;
}

.meta-line {
  font-size: 0.9rem;
  color: #aaa;
  margin: 0;
}

.meta-line.muted {
  color: #666;
}

.season-stats-row {
  display: flex;
  gap: 24px;
  margin: 32px 0 0;
  flex-wrap: wrap;
}

.season-stat-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 28px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  min-width: 100px;
  gap: 4px;
  transition: var(--transition-smooth);
}

.season-stat-chip:hover {
  background: var(--glass-bg-hover);
  transform: translateY(-2px);
}

.season-stat-value {
  font-size: 32px;
  font-weight: 800;
  color: #fff;
  font-family: 'DM Mono', monospace;
}

.season-stat-label {
  font-size: 11px;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 1px;
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
  margin-bottom: 1rem;
  letter-spacing: -0.01em;
}

.h2h-card {
  padding: 1.25rem 1.5rem;
}

.h2h-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
}

.h2h-mid {
  font-size: 1.5rem;
  font-weight: 700;
  color: #eee;
}

.code {
  font-weight: 700;
}

.h2h-note {
  margin: 0.75rem 0 0;
  font-size: 0.8rem;
  color: #666;
  text-align: center;
}

.table-wrap {
  overflow-x: auto;
  padding: 0;
}

.results-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 6px;
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

.results-row {
  background: var(--glass-bg);
  transition: var(--transition-smooth);
}

.results-row:hover {
  background: var(--glass-bg-hover);
}

.results-row td {
  padding: 12px 16px;
  font-size: 14px;
  color: #ccc;
}

.results-row td:first-child {
  border-radius: 10px 0 0 10px;
}

.results-row td:last-child {
  border-radius: 0 10px 10px 0;
}

.results-row--win {
  border-left: 3px solid #ffd700;
}

.results-row--podium {
  border-left: 3px solid #888;
}

.results-row--dnf td {
  opacity: 0.5;
}

.gp-link {
  color: #e8002d;
  text-decoration: none;
  font-weight: 600;
}

.gp-link:hover {
  text-decoration: underline;
}

.status-cell {
  color: #888;
  font-size: 0.8rem;
}

.empty {
  padding: 2rem;
  text-align: center;
  color: #666;
}

@media (max-width: 768px) {
  .driver-profile-hero {
    grid-template-columns: 1fr;
    align-items: start;
    gap: 20px;
    padding-bottom: 28px;
  }

  .driver-hero-photo {
    width: 100%;
    max-width: none;
    height: 240px;
    object-position: top center;
  }

  .driver-profile-hero::before {
    font-size: 120px;
    opacity: 0.03;
  }

  .driver-hero-number {
    font-size: 52px;
  }

  .driver-hero-name {
    font-size: 32px;
  }

  .season-stats-row {
    gap: 8px;
    flex-wrap: wrap;
  }

  .season-stat-chip {
    flex: 1;
    min-width: calc(33% - 8px);
    padding: 14px 12px;
  }

  .season-stat-value {
    font-size: 24px;
  }

  .results-table th:nth-child(1),
  .results-table td:nth-child(1),
  .results-table th:nth-child(6),
  .results-table td:nth-child(6) {
    display: none;
  }

  .results-row td {
    padding: 10px 10px;
    font-size: 13px;
  }
}
</style>
