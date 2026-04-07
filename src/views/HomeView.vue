<template>
  <div class="home-view">
    <section class="hero-section">
      <div class="hero-glow" aria-hidden="true" />
      <div class="container hero-inner">
        <div class="hero-left" v-motion-fade-visible>
          <div class="season-badge">{{ seasonStore.selectedSeason }} Season</div>
          <h1 class="hero-title">
            Understand F1<br />
            <span class="hero-title--accent">like never before</span>
          </h1>
          <p class="hero-subtitle">
            Race data, lap times, and strategic insights<br />made for fans, not just analysts.
          </p>

          <div class="leader-chip" v-if="championshipLeader">
            <span class="leader-label">Championship Leader</span>
            <span class="leader-name" :style="{ color: leaderTeamColor }">
              {{ championshipLeader.Driver.code }}
            </span>
            <span class="leader-pts">{{ championshipLeader.points }} pts</span>
          </div>

          <div class="hero-actions">
            <router-link to="/drivers" class="btn-primary">Explore Standings</router-link>
            <router-link :to="telemetryLink" class="btn-secondary">Telemetry Deep Dive</router-link>
          </div>
        </div>

        <div class="hero-right">
          <div class="glass-card next-session-card" v-if="seasonStore.nextRace">
            <div class="countdown-header">
              <span class="next-label">{{ activeSession ? 'NEXT SESSION' : 'NEXT RACE' }}</span>
              <span class="flag">{{ getCircuitFlag(seasonStore.nextRace.Circuit.Location.country) }}</span>
            </div>
            <h2 class="next-race-name">{{ seasonStore.nextRace.raceName }}</h2>
            <p class="next-circuit">
              {{ seasonStore.nextRace.Circuit.circuitName }}, {{ seasonStore.nextRace.Circuit.Location.locality }}
            </p>

            <CountdownTimer v-if="nextSessionDateTime" :targetDate="nextSessionDateTime" />

            <div v-if="weekendSessions.length" class="session-list">
              <div
                v-for="session in weekendSessionsSorted"
                :key="session.session_key"
                class="session-row"
                :class="sessionStatus(session)"
              >
                <div class="session-day font-data">
                  {{ formatSessionDay(session.date_start) }}
                </div>
                <div class="session-name">
                  {{ session.session_name }}
                </div>
                <div class="session-time font-data">
                  {{ formatSessionTime(session.date_start) }}
                  <span v-if="isToday(session.date_start)" class="session-today">today</span>
                </div>
              </div>
            </div>

            <p class="next-date" v-else>{{ formatDate(seasonStore.nextRace.date) }}</p>
          </div>
          <div class="glass-card next-session-card skeleton-card" v-else-if="seasonStore.loading">
            <div class="home-loader-wrap">
              <StartLightsLoader label="Loading season data" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Season in numbers -->
    <section class="season-numbers-strip container" v-if="!seasonStore.loading && seasonStats.length">
      <div
        class="number-chip glass-card glass-card--static"
        v-for="stat in seasonStats"
        :key="stat.label"
      >
        <span class="number-chip-icon">{{ stat.icon }}</span>
        <span class="number-chip-value stat-number">{{ stat.value }}</span>
        <span class="number-chip-label">{{ stat.label }}</span>
      </div>
    </section>

    <!-- Last Race Recap -->
    <section class="section container" v-if="lastRace">
      <div class="section-header">
        <h2 class="section-title">Last Race</h2>
        <span class="section-sub">{{ lastRace.race.raceName }}</span>
        <router-link
          v-if="lastRace.race.season && lastRace.race.round"
          :to="`/race/${lastRace.race.season}/${lastRace.race.round}`"
          class="view-all-link"
        >
          Full Analysis →
        </router-link>
      </div>

      <div
        class="recap-grid last-race-grid"
        :class="{
          'last-race-grid--has-snapshot': isLargeScreen && seasonStore.driverStandings.length > 0,
        }"
      >
        <!-- Podium -->
        <div class="glass-card glass-card--static podium-wrap" v-if="lastRace">
          <h3 class="card-title">Podium</h3>
          <router-link
            v-for="pos in [1, 2, 3]"
            :key="pos"
            :to="`/race/${lastRace.race.season}/${lastRace.race.round}`"
            class="podium-card"
          >
            <span class="podium-position" :class="`podium-position--${pos}`">{{ pos }}</span>
            <div v-if="getResult(pos)" class="podium-body">
              <div class="podium-name">{{ getResult(pos)?.Driver.givenName }} {{ getResult(pos)?.Driver.familyName }}</div>
              <div class="podium-team" :style="{ color: getTeamColor(getResult(pos)?.Constructor.name || '') }">
                {{ getResult(pos)?.Constructor.name }}
              </div>
              <div class="podium-time font-data">{{ getResult(pos)?.Time?.time || getResult(pos)?.status }}</div>
            </div>
          </router-link>
        </div>

        <!-- Quick Stats -->
        <div class="glass-card glass-card--static stats-card">
          <h3 class="card-title">Race Highlights</h3>
          <div class="stats-list">
            <div class="stat-item" v-if="fastestLap">
              <span class="stat-icon">⚡</span>
              <div>
                <div class="stat-label">Fastest Lap</div>
                <div class="stat-value font-data">{{ fastestLap.Driver.code }} - {{ fastestLap.FastestLap?.Time.time }}</div>
              </div>
            </div>
            <div class="stat-item" v-if="biggestMoverResult">
              <span class="stat-icon">🚀</span>
              <div>
                <div class="stat-label">Biggest Mover</div>
                <div class="stat-value">
                  {{ biggestMoverResult.Driver.code }} +{{ biggestMoverResult.delta }} pos
                </div>
              </div>
            </div>
            <div class="stat-item">
              <span class="stat-icon">🏎️</span>
              <div>
                <div class="stat-label">Race Winner</div>
                <div class="stat-value">{{ getResult(1)?.Driver.givenName }} {{ getResult(1)?.Driver.familyName }}</div>
              </div>
            </div>
            <div class="stat-item">
              <span class="stat-icon">🏁</span>
              <div>
                <div class="stat-label">Race</div>
                <div class="stat-value">
                  {{ lastRace.race.Circuit.Location.locality }}, {{ formatDate(lastRace.race.date) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="isLargeScreen && seasonStore.driverStandings.length"
          class="championship-snapshot glass-card glass-card--static"
        >
          <h4 class="snapshot-title">Championship after race</h4>
          <div
            v-for="(entry, i) in seasonStore.driverStandings.slice(0, 5)"
            :key="entry.Driver.driverId"
            class="snapshot-row"
          >
            <span class="snapshot-pos">{{ i + 1 }}</span>
            <div
              class="snapshot-dot"
              :style="{ background: getTeamColor(entry.Constructors[0]?.name || '') }"
            />
            <span class="snapshot-code">{{ entry.Driver.code }}</span>
            <span class="snapshot-pts">{{ entry.points }}</span>
          </div>
          <router-link to="/drivers" class="snapshot-more"> Full standings → </router-link>
        </div>
      </div>
    </section>

    <!-- Standings Tables -->
    <section class="section container">
      <div class="section-header">
        <h2 class="section-title">Championship Standings</h2>
        <router-link to="/drivers" class="view-all-link">View All →</router-link>
      </div>

      <div v-if="seasonStore.loading" class="standings-grid">
        <div class="glass-card home-loader-card">
          <StartLightsLoader label="Loading season data" />
        </div>
      </div>

      <div v-else class="standings-grid">
        <!-- Driver Standings -->
        <div class="glass-card glass-card--static standings-card">
          <h3 class="card-title">Drivers</h3>
          <div class="standings-table">
            <div
              v-for="standing in seasonStore.driverStandings.slice(0, 8)"
              :key="standing.Driver.driverId"
              class="standing-row"
            >
              <div
                class="standing-team-strip"
                :style="{ background: getTeamColor(standing.Constructors[0]?.name || '') }"
              />
              <span class="standing-pos font-data">{{ standing.position }}</span>
              <div class="standing-driver">
                <span class="driver-code font-data">{{ standing.Driver.code }}</span>
                <span class="driver-name-small">{{ standing.Driver.familyName }}</span>
              </div>
              <span class="standing-points font-data">{{ standing.points }} pts</span>
            </div>
          </div>
        </div>

        <!-- Constructor Standings -->
        <div class="glass-card glass-card--static standings-card">
          <h3 class="card-title">Constructors</h3>
          <div class="standings-table">
            <div
              v-for="standing in seasonStore.constructorStandings.slice(0, 8)"
              :key="standing.Constructor.constructorId"
              class="standing-row"
            >
              <div
                class="standing-team-strip"
                :style="{ background: getTeamColor(standing.Constructor.name) }"
              />
              <span class="standing-pos font-data">{{ standing.position }}</span>
              <div class="standing-driver">
                <span class="constructor-name" :style="{ color: getTeamColor(standing.Constructor.name) }">
                  {{ standing.Constructor.name }}
                </span>
              </div>
              <span class="standing-points font-data">{{ standing.points }} pts</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Season Schedule -->
    <section class="section container">
      <div class="section-header">
        <h2 class="section-title">Season Schedule</h2>
        <span class="section-sub">{{ seasonStore.selectedSeason }}</span>
      </div>
      <div v-if="seasonStore.loading" class="home-loader-wrap home-loader-wrap--schedule">
        <StartLightsLoader label="Loading season data" />
      </div>
      <div v-else class="schedule-grid">
        <div
          v-for="race in seasonStore.schedule"
          :key="race.round"
          class="schedule-card glass-card"
          :class="{
            'schedule-card--completed': getRaceAvailability(race.date, seasonStore.selectedSeason) === 'available',
            'schedule-card--today': getRaceAvailability(race.date, seasonStore.selectedSeason) === 'today',
            'schedule-card--upcoming': getRaceAvailability(race.date, seasonStore.selectedSeason) === 'upcoming',
            'schedule-card--next': race.round === seasonStore.nextRace?.round,
          }"
          @click="
            getRaceAvailability(race.date, seasonStore.selectedSeason) === 'available'
              ? router.push(`/race/${race.season}/${race.round}`)
              : null
          "
        >
          <span class="race-round font-data">R{{ race.round }}</span>
          <span class="race-flag">{{ getCircuitFlag(race.Circuit.Location.country) }}</span>
          <span class="race-name">{{ race.raceName.replace(' Grand Prix', ' GP') }}</span>
          <span class="race-date">{{ formatDate(race.date) }}</span>
          <span
            v-if="getRaceAvailability(race.date, seasonStore.selectedSeason) === 'today'"
            class="race-status race-status--live"
            >● LIVE</span
          >
          <span v-if="race.round === seasonStore.nextRace?.round" class="race-status race-status--next">NEXT</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSeasonStore } from '@/stores/seasonStore'
import { getTeamColor, getCircuitFlag } from '@/constants/teams'
import CountdownTimer from '@/components/ui/CountdownTimer.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import StartLightsLoader from '@/components/ui/StartLightsLoader.vue'
import { getUpcomingWeekendSessions } from '@/api/openf1'
import type { Session } from '@/api/openf1'
import { getAllRaceResultsForSeason } from '@/api/ergast'
import type { ErgastRaceResult } from '@/api/ergast'
import { getRaceAvailability } from '@/utils/raceAvailability'

const router = useRouter()
const seasonStore = useSeasonStore()
const weekendSessions = ref<Session[]>([])

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)

/**
 * Syncs `windowWidth` with the browser viewport for responsive layout breakpoints.
 *
 * Data source: `window.innerWidth` (browser only).
 *
 * Returns: void. Used so the last-race grid can show a third column at ≥1280px without extra API calls.
 */
function onWindowResize() {
  windowWidth.value = window.innerWidth
}

const isLargeScreen = computed(() => windowWidth.value >= 1280)

const allSeasonRacesPayload = ref<{
  MRData?: { RaceTable?: { Races: Array<{ round: string; Results?: ErgastRaceResult[] }> } }
} | null>(null)

watch(
  () => seasonStore.selectedSeason,
  async y => {
    try {
      allSeasonRacesPayload.value = (await getAllRaceResultsForSeason(y)) as typeof allSeasonRacesPayload.value
    } catch {
      allSeasonRacesPayload.value = null
    }
  },
  { immediate: true }
)

/**
 * Ergast race time string "M:SS.sss" or "SSS.sss" → seconds.
 */
function raceTimeToSeconds(t: string | undefined): number | null {
  if (!t) return null
  const clean = t.trim()
  const parts = clean.split(':')
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10)
    const secs = parseFloat(parts[1])
    if (Number.isFinite(mins) && Number.isFinite(secs)) return mins * 60 + secs
  }
  const n = parseFloat(clean)
  return Number.isFinite(n) ? n : null
}

const completedRaces = computed(() =>
  seasonStore.schedule.filter(r => getRaceAvailability(r.date, seasonStore.selectedSeason) === 'available')
)

const seasonStats = computed(() => {
  const races = allSeasonRacesPayload.value?.MRData?.RaceTable?.Races || []
  const completedRounds = new Set(completedRaces.value.map(r => String(r.round)))

  const winners = new Set<string>()
  let bestGap: number | null = null
  let bestMover = 0

  for (const raceEntry of races) {
    if (!completedRounds.has(String(raceEntry.round))) continue
    const res = raceEntry.Results
    if (!res?.length) continue

    const p1 = res.find(r => r.position === '1')
    if (p1) winners.add(p1.Driver.code)

    const r1 = res.find(r => r.position === '1')
    const r2 = res.find(r => r.position === '2')
    const t1 = raceTimeToSeconds(r1?.Time?.time)
    const t2 = raceTimeToSeconds(r2?.Time?.time)
    if (t1 != null && t2 != null) {
      const gap = Math.abs(t2 - t1)
      if (bestGap == null || gap < bestGap) bestGap = gap
    }

    for (const row of res) {
      if (row.status !== 'Finished') continue
      const g = parseInt(row.grid, 10)
      const p = parseInt(row.position, 10)
      if (!Number.isFinite(g) || !Number.isFinite(p) || g <= 0) continue
      const mov = g - p
      if (mov > bestMover) bestMover = mov
    }
  }

  return [
    { icon: '🏁', value: completedRaces.value.length, label: 'Races complete' },
    { icon: '🏎️', value: winners.size, label: 'Different winners' },
    {
      icon: '⚡',
      value: bestGap != null ? `${bestGap.toFixed(3)}s` : '—',
      label: 'Closest finish',
    },
    { icon: '📈', value: bestMover > 0 ? `+${bestMover}` : '—', label: 'Most positions gained' },
  ]
})

const championshipLeader = computed(() => seasonStore.driverStandings[0] ?? null)

const leaderTeamColor = computed(() =>
  getTeamColor(championshipLeader.value?.Constructors[0]?.name || '')
)

onMounted(async () => {
  window.addEventListener('resize', onWindowResize, { passive: true })
  weekendSessions.value = await getUpcomingWeekendSessions()
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
})

const lastRace = computed(() => seasonStore.lastRaceResults)

/**
 * Computes a safe Telemetry route for the most recent race.
 *
 * Data source: SeasonStore schedule + last race results (Ergast).
 *
 * Why: TelemetryView requires `:season/:round`. We prefer sending fans to the latest race
 * instead of hardcoding a placeholder route in multiple places.
 *
 * Returns: Vue Router path like `/telemetry/2025/3`.
 */
const telemetryLink = computed(() => {
  const round = seasonStore.lastRaceResults?.race?.round ?? '1'
  return `/telemetry/${seasonStore.selectedSeason}/${round}`
})

const weekendSessionsSorted = computed(() =>
  [...weekendSessions.value].sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
  )
)

const activeSession = computed<Session | null>(() => {
  const list = weekendSessionsSorted.value
  if (!list.length) return null
  const now = Date.now()
  const upcoming = list.find(s => new Date(s.date_start).getTime() >= now)
  return upcoming ?? list[list.length - 1]
})

const nextSessionDateTime = computed(() => {
  if (activeSession.value) return activeSession.value.date_start
  const nr = seasonStore.nextRace
  if (!nr) return null
  return nr.time ? `${nr.date}T${nr.time}` : `${nr.date}T12:00:00Z`
})

function getResult(position: number) {
  return lastRace.value?.results.find(r => parseInt(r.position) === position)
}

const fastestLap = computed(() => {
  if (!lastRace.value) return null
  return lastRace.value.results.find(r => r.FastestLap?.rank === '1')
})

const biggestMoverResult = computed(() => {
  if (!lastRace.value) return null
  let best: (typeof lastRace.value.results[0] & { delta: number }) | null = null
  for (const r of lastRace.value.results) {
    const grid = parseInt(r.grid)
    const finish = parseInt(r.position)
    if (isNaN(grid) || isNaN(finish) || grid === 0) continue
    const delta = grid - finish
    if (!best || delta > best.delta) best = { ...r, delta }
  }
  return best && best.delta > 0 ? best : null
})

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

function formatSessionDay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
  })
}

function formatSessionTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function sessionStatus(session: Session): 'past' | 'next' | 'upcoming' {
  const now = Date.now()
  const start = new Date(session.date_start).getTime()
  const end = new Date(session.date_end).getTime()
  const active = activeSession.value

  if (end < now) return 'past'
  if (active && session.session_key === active.session_key) return 'next'
  return 'upcoming'
}
</script>

<style scoped>
.home-view {
  padding-bottom: 4rem;
}

/* Hero */
.hero-section {
  position: relative;
  padding: 80px 0 48px;
  overflow: hidden;
}

.hero-glow {
  position: absolute;
  top: -100px;
  left: -200px;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(232, 0, 45, 0.08) 0%, transparent 70%);
  pointer-events: none;
}

.hero-inner {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 48px;
  align-items: center;
  position: relative;
  z-index: 1;
}

.season-badge {
  display: inline-block;
  background: rgba(232, 0, 45, 0.12);
  border: 1px solid rgba(232, 0, 45, 0.25);
  color: #e8002d;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  padding: 6px 14px;
  border-radius: 20px;
  margin-bottom: 24px;
}

.hero-title {
  font-size: clamp(40px, 5vw, 64px);
  font-weight: 900;
  line-height: 1.05;
  color: #fff;
  margin-bottom: 16px;
  font-family: 'Titillium Web', sans-serif;
}

.hero-title--accent {
  color: #e8002d;
  display: block;
}

.hero-subtitle {
  font-size: 17px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 28px;
  max-width: 520px;
}

.leader-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 10px 16px;
  margin-bottom: 28px;
  font-size: 14px;
}

.leader-label {
  color: #d4d4d4;
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.leader-name {
  font-weight: 800;
  font-family: 'DM Mono', monospace;
}

.leader-pts {
  color: #888;
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-primary {
  padding: 14px 28px;
  background: #e8002d;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition-smooth);
  font-family: 'Titillium Web', sans-serif;
  text-decoration: none;
  display: inline-block;
}

.btn-primary:hover {
  background: #ff1a3d;
  box-shadow: var(--glow-red-strong);
  transform: translateY(-2px);
}

.btn-secondary {
  padding: 14px 28px;
  background: transparent;
  color: #fff;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition-smooth);
  font-family: 'Titillium Web', sans-serif;
  text-decoration: none;
  display: inline-block;
}

.btn-secondary:hover {
  background: var(--glass-bg);
  border-color: var(--glass-border-hover);
  transform: translateY(-2px);
}

.next-session-card {
  padding: 28px;
  min-width: 280px;
  max-width: 320px;
}

.countdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.next-label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #E8002D;
}

.flag {
  font-size: 1.25rem;
}

.next-race-name {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.next-circuit {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 1rem;
}

.next-date {
  font-size: 0.75rem;
  color: #555;
  margin-top: 0.75rem;
  font-family: 'DM Mono', monospace;
}

.session-list {
  margin-top: 1rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.session-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #666;
}

.session-row.past {
  opacity: 0.4;
}

.session-row.next {
  color: #fff;
}

.session-row.next .session-name {
  font-weight: 700;
}

.session-day {
  width: 60px;
  color: #555;
}

.session-name {
  flex: 1;
  margin: 0 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-time {
  text-align: right;
}

.session-today {
  margin-left: 0.35rem;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #E8002D;
}

/* Sections */
.section {
  margin-top: 3rem;
}

.section-header {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.section-title {
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.section-sub {
  font-size: 0.875rem;
  color: #555;
}

.view-all-link {
  margin-left: auto;
  font-size: 0.875rem;
  color: #E8002D;
  text-decoration: none;
  font-weight: 600;
  transition: opacity 0.15s;
}

.view-all-link:hover { opacity: 0.75; }

/* Season numbers strip */
.season-numbers-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 40px auto 0;
}

.number-chip {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.number-chip-icon {
  font-size: 22px;
}

.number-chip-value {
  font-size: 28px;
}

.number-chip-label {
  font-size: 12px;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Recap */
.recap-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.championship-snapshot {
  padding: 20px;
}

.snapshot-title {
  font-size: 11px;
  font-weight: 700;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 16px;
}

.snapshot-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.snapshot-pos {
  font-size: 12px;
  color: #444;
  width: 16px;
  font-family: 'DM Mono', monospace;
}

.snapshot-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.snapshot-code {
  font-size: 13px;
  font-weight: 700;
  color: #ccc;
  font-family: 'DM Mono', monospace;
  flex: 1;
}

.snapshot-pts {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  font-family: 'DM Mono', monospace;
}

.snapshot-more {
  display: block;
  margin-top: 14px;
  font-size: 12px;
  color: #e8002d;
  text-decoration: none;
  font-weight: 700;
}

.podium-wrap,
.stats-card {
  padding: 20px 24px;
}

.card-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #555;
  margin-bottom: 1rem;
}

.podium-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  margin-bottom: 8px;
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  text-decoration: none;
  color: inherit;
  transition: var(--transition-smooth);
  cursor: pointer;
}

.podium-card:last-child {
  margin-bottom: 0;
}

.podium-card:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  transform: translateX(4px);
}

.podium-position {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 14px;
  flex-shrink: 0;
}

.podium-position--1 {
  background: #ffd700;
  color: #000;
}

.podium-position--2 {
  background: #c0c0c0;
  color: #000;
}

.podium-position--3 {
  background: #cd7f32;
  color: #000;
}

.podium-body {
  flex: 1;
  min-width: 0;
}

.podium-name {
  font-size: 0.9rem;
  font-weight: 600;
}

.podium-team {
  font-size: 0.75rem;
  margin-top: 0.1rem;
}

.podium-time {
  font-size: 0.75rem;
  color: #666;
}

.stats-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.stat-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.stat-icon {
  font-size: 1.1rem;
  line-height: 1;
  margin-top: 0.1rem;
}

.stat-label {
  font-size: 0.7rem;
  color: #555;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 0.2rem;
}

.stat-value {
  font-size: 0.875rem;
  color: #ccc;
  font-weight: 600;
}

/* Standings */
.standings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.standings-card {
  padding: 1.5rem;
}

.standings-table {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.standing-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px 10px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.standing-team-strip {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
}

.standing-row:last-child {
  border-bottom: none;
}

.standing-pos {
  width: 20px;
  text-align: center;
  font-size: 0.75rem;
  color: #555;
}

.standing-driver {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.driver-code {
  font-weight: 700;
  font-size: 0.875rem;
  color: #fff;
  letter-spacing: 0.04em;
}

.driver-name-small {
  font-size: 0.8rem;
  color: #666;
}

.constructor-name {
  font-size: 0.875rem;
  font-weight: 600;
}

.standing-points {
  font-size: 0.8rem;
  color: #FFC906;
  font-weight: 600;
}

/* Schedule */
.schedule-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

.schedule-card {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  grid-template-rows: auto auto;
  align-items: center;
  gap: 0.25rem 0.5rem;
  padding: 16px;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  transition: var(--transition-smooth);
}

.schedule-card--completed {
  cursor: pointer;
  opacity: 0.65;
}

.schedule-card--completed:hover {
  opacity: 1;
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-hover);
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}

.schedule-card--completed::after {
  content: '✓';
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 11px;
  color: #333;
  font-weight: 700;
}

.schedule-card--next {
  border-color: rgba(232, 0, 45, 0.4) !important;
  opacity: 1;
  background: rgba(232, 0, 45, 0.05);
  box-shadow: var(--glow-red);
  animation: pulse-border 2s ease-in-out infinite;
}

.schedule-card--next::after {
  content: none;
}

.schedule-card--upcoming {
  opacity: 0.3;
  cursor: default;
  pointer-events: none;
}

.schedule-card--today {
  opacity: 1;
  border-color: rgba(0, 200, 83, 0.35);
}

@keyframes pulse-border {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(232, 0, 45, 0);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(232, 0, 45, 0.15);
  }
}

.race-round {
  font-size: 10px;
  font-weight: 700;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 1px;
  grid-column: 1;
}

.race-flag {
  font-size: 1.25rem;
  grid-column: 2;
}

.race-name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  display: block;
  margin-bottom: 4px;
  grid-column: 3 / -1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.race-date {
  font-size: 11px;
  color: #555;
  font-family: 'DM Mono', monospace;
  grid-column: 1 / 4;
}

.race-status {
  grid-column: 4;
  grid-row: 1 / span 2;
  justify-self: end;
  align-self: start;
}

.race-status--live {
  color: #00c853;
  font-size: 10px;
  font-weight: 800;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.race-status--next {
  color: #e8002d;
  font-size: 10px;
  font-weight: 800;
}

.skeleton-card {
  padding: 1.5rem;
}

.home-loader-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 120px;
  padding: 1rem 0;
}

.home-loader-wrap--schedule {
  min-height: 200px;
}

.home-loader-card {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 280px;
  padding: 2rem;
}

@media (max-width: 900px) {
  .hero-inner {
    grid-template-columns: 1fr;
  }

  .next-session-card {
    max-width: 100%;
  }

  .recap-grid,
  .standings-grid {
    grid-template-columns: 1fr;
  }

  .season-numbers-strip {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .hero-section {
    gap: 24px;
    padding: 40px 0 32px;
  }

  .hero-title {
    font-size: 36px;
  }

  .hero-subtitle {
    font-size: 15px;
  }

  .hero-actions {
    flex-direction: column;
  }

  .hero-actions .btn-primary,
  .hero-actions .btn-secondary {
    width: 100%;
    justify-content: center;
  }

  .next-session-card {
    width: 100%;
  }

  .season-numbers-strip {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .standings-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .schedule-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .schedule-card {
    padding: 12px;
  }

  .schedule-card .race-name {
    font-size: 12px;
  }

  .recap-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

@media (max-width: 640px) {
  .hero-title {
    font-size: 2rem;
  }

  .schedule-grid {
    grid-template-columns: 1fr 1fr;
  }

  .season-numbers-strip {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1280px) {
  .hero-section {
    padding: 100px 0 80px;
  }

  .hero-inner {
    grid-template-columns: 1fr 480px;
    gap: 80px;
  }

  .hero-title {
    font-size: 72px;
  }

  .hero-subtitle {
    font-size: 18px;
    max-width: 520px;
  }

  .season-numbers-strip {
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin: 60px 0;
  }

  .number-chip {
    padding: 28px 32px;
  }

  .number-chip-value {
    font-size: 40px;
  }

  .last-race-grid--has-snapshot {
    grid-template-columns: 1fr 1fr 340px;
    gap: 20px;
  }

  .schedule-grid {
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
  }
}

@media (max-width: 1279px) {
  .last-race-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (min-width: 1600px) {
  .hero-section {
    padding: 120px 0 100px;
  }

  .hero-inner {
    grid-template-columns: 1fr 520px;
    gap: 120px;
  }

  .hero-title {
    font-size: 84px;
  }

  .next-session-card {
    padding: 36px;
  }

  .schedule-grid {
    grid-template-columns: repeat(8, 1fr);
  }
}
</style>
