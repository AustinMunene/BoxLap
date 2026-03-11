<template>
  <div class="home-view">
    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-bg">
        <div class="hero-grid"></div>
      </div>
      <div class="container">
        <div class="hero-content" v-motion-fade-visible>
          <div class="hero-badge">2025 SEASON</div>
          <h1 class="hero-title">
            Understand F1<br />
            <span class="hero-accent">like never before</span>
          </h1>
          <p class="hero-subtitle">
            Race data, lap times, and strategic insights — made for fans, not just analysts.
          </p>
          <div class="hero-actions">
            <router-link to="/drivers" class="btn-primary">Explore Standings</router-link>
            <router-link to="/predict" class="btn-secondary">Race Predictor</router-link>
          </div>
        </div>

        <!-- Next Race Countdown -->
        <div class="countdown-card glass-card" v-if="seasonStore.nextRace">
          <div class="countdown-header">
            <span class="next-label">NEXT RACE</span>
            <span class="flag">{{ getCircuitFlag(seasonStore.nextRace.Circuit.Location.country) }}</span>
          </div>
          <h2 class="next-race-name">{{ seasonStore.nextRace.raceName }}</h2>
          <p class="next-circuit">
            {{ seasonStore.nextRace.Circuit.circuitName }}, {{ seasonStore.nextRace.Circuit.Location.locality }}
          </p>
          <CountdownTimer v-if="nextRaceDateTime" :targetDate="nextRaceDateTime" />
          <p class="next-date">{{ formatDate(seasonStore.nextRace.date) }}</p>
        </div>
        <div class="countdown-card glass-card skeleton-card" v-else-if="seasonStore.loading">
          <SkeletonBlock height="120px" />
        </div>
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

      <div class="recap-grid">
        <!-- Podium -->
        <div class="glass-card podium-card">
          <h3 class="card-title">Podium</h3>
          <div class="podium">
            <div v-for="pos in [1,2,3]" :key="pos" class="podium-item">
              <span class="podium-pos" :class="`pos-${pos}`">{{ pos }}</span>
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

        <!-- Quick Stats -->
        <div class="glass-card stats-card">
          <h3 class="card-title">Race Highlights</h3>
          <div class="stats-list">
            <div class="stat-item" v-if="fastestLap">
              <span class="stat-icon">⚡</span>
              <div>
                <div class="stat-label">Fastest Lap</div>
                <div class="stat-value font-data">{{ fastestLap.Driver.code }} — {{ fastestLap.FastestLap?.Time.time }}</div>
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
      </div>
    </section>

    <!-- Standings Tables -->
    <section class="section container">
      <div class="section-header">
        <h2 class="section-title">Championship Standings</h2>
        <router-link to="/drivers" class="view-all-link">View All →</router-link>
      </div>

      <div v-if="seasonStore.loading" class="standings-grid">
        <div class="glass-card"><SkeletonBlock height="300px" /></div>
        <div class="glass-card"><SkeletonBlock height="300px" /></div>
      </div>

      <div v-else class="standings-grid">
        <!-- Driver Standings -->
        <div class="glass-card standings-card">
          <h3 class="card-title">Drivers</h3>
          <div class="standings-table">
            <div
              v-for="standing in seasonStore.driverStandings.slice(0, 8)"
              :key="standing.Driver.driverId"
              class="standing-row"
            >
              <span class="standing-pos font-data">{{ standing.position }}</span>
              <div
                class="team-strip"
                :style="{ background: getTeamColor(standing.Constructors[0]?.name || '') }"
              ></div>
              <div class="standing-driver">
                <span class="driver-code font-data">{{ standing.Driver.code }}</span>
                <span class="driver-name-small">{{ standing.Driver.familyName }}</span>
              </div>
              <span class="standing-points font-data">{{ standing.points }} pts</span>
            </div>
          </div>
        </div>

        <!-- Constructor Standings -->
        <div class="glass-card standings-card">
          <h3 class="card-title">Constructors</h3>
          <div class="standings-table">
            <div
              v-for="standing in seasonStore.constructorStandings.slice(0, 8)"
              :key="standing.Constructor.constructorId"
              class="standing-row"
            >
              <span class="standing-pos font-data">{{ standing.position }}</span>
              <div
                class="team-strip"
                :style="{ background: getTeamColor(standing.Constructor.name) }"
              ></div>
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
        <span class="section-sub">{{ seasonStore.currentYear }}</span>
      </div>
      <div v-if="seasonStore.loading">
        <SkeletonBlock height="200px" />
      </div>
      <div v-else class="schedule-grid">
        <router-link
          v-for="race in seasonStore.schedule"
          :key="race.round"
          :to="`/race/${race.season}/${race.round}`"
          class="schedule-item glass-card"
          :class="{ past: isPast(race.date), upcoming: !isPast(race.date) }"
        >
          <div class="schedule-round font-data">R{{ race.round }}</div>
          <div class="schedule-flag">{{ getCircuitFlag(race.Circuit.Location.country) }}</div>
          <div class="schedule-info">
            <div class="schedule-name">{{ race.raceName.replace(' Grand Prix', ' GP') }}</div>
            <div class="schedule-date">{{ formatDate(race.date) }}</div>
          </div>
          <div class="schedule-arrow">→</div>
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSeasonStore } from '@/stores/seasonStore'
import { getTeamColor, getCircuitFlag } from '@/constants/teams'
import CountdownTimer from '@/components/ui/CountdownTimer.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'

const seasonStore = useSeasonStore()

onMounted(() => {
  seasonStore.loadCurrentSeason()
})

const lastRace = computed(() => seasonStore.lastRaceResults)

const nextRaceDateTime = computed(() => {
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

function isPast(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}
</script>

<style scoped>
.home-view {
  padding-bottom: 4rem;
}

/* Hero */
.hero {
  position: relative;
  padding: 5rem 0 3rem;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(232, 0, 45, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(232, 0, 45, 0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: linear-gradient(to bottom, transparent, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.6) 70%, transparent);
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.hero .container {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 3rem;
  align-items: center;
  position: relative;
  z-index: 1;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border: 1px solid rgba(232, 0, 45, 0.4);
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #E8002D;
  margin-bottom: 1.25rem;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin-bottom: 1rem;
  color: #fff;
}

.hero-accent {
  color: #E8002D;
}

.hero-subtitle {
  font-size: 1.1rem;
  color: #888;
  margin-bottom: 2rem;
  max-width: 480px;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-primary {
  padding: 0.75rem 1.75rem;
  background: #E8002D;
  color: #fff;
  font-weight: 700;
  border-radius: 8px;
  text-decoration: none;
  font-size: 0.875rem;
  letter-spacing: 0.04em;
  transition: opacity 0.15s, transform 0.15s;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-secondary {
  padding: 0.75rem 1.75rem;
  background: rgba(255,255,255,0.06);
  color: #fff;
  font-weight: 700;
  border-radius: 8px;
  text-decoration: none;
  font-size: 0.875rem;
  border: 1px solid rgba(255,255,255,0.12);
  transition: background 0.15s;
}

.btn-secondary:hover {
  background: rgba(255,255,255,0.1);
}

/* Countdown */
.countdown-card {
  padding: 1.5rem;
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

/* Recap */
.recap-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.podium-card, .stats-card {
  padding: 1.5rem;
}

.card-title {
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
  gap: 0.875rem;
}

.podium-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.podium-pos {
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
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
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

.team-strip {
  width: 3px;
  height: 22px;
  border-radius: 2px;
  flex-shrink: 0;
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
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s;
}

.schedule-item:hover {
  transform: translateY(-2px);
}

.schedule-item.past {
  opacity: 0.5;
}

.schedule-round {
  font-size: 0.7rem;
  color: #555;
  font-weight: 700;
  letter-spacing: 0.06em;
  min-width: 24px;
}

.schedule-flag {
  font-size: 1.25rem;
}

.schedule-info {
  flex: 1;
  min-width: 0;
}

.schedule-name {
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.schedule-date {
  font-size: 0.7rem;
  color: #555;
  font-family: 'DM Mono', monospace;
}

.schedule-arrow {
  color: #555;
  font-size: 0.875rem;
  transition: color 0.15s;
}

.schedule-item:hover .schedule-arrow {
  color: #E8002D;
}

.skeleton-card {
  padding: 1.5rem;
}

@media (max-width: 900px) {
  .hero .container {
    grid-template-columns: 1fr;
  }

  .countdown-card {
    max-width: 100%;
  }

  .hero-title {
    font-size: 2.5rem;
  }

  .recap-grid,
  .standings-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .hero-title {
    font-size: 2rem;
  }

  .schedule-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
