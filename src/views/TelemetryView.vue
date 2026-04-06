<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LapSummaryCard from '@/components/telemetry/LapSummaryCard.vue'
import SpeedTrace from '@/components/telemetry/SpeedTrace.vue'
import ThrottleTrace from '@/components/telemetry/ThrottleTrace.vue'
import BrakeTrace from '@/components/telemetry/BrakeTrace.vue'
import GearTrace from '@/components/telemetry/GearTrace.vue'
import TelemetryStats from '@/components/telemetry/TelemetryStats.vue'
import { useRaceStore } from '@/stores/raceStore'
import { useSeasonStore } from '@/stores/seasonStore'
import { getTeamColor } from '@/constants/teams'
import { getSeasonRaces } from '@/api/ergast'
import type { ErgastRace } from '@/api/ergast'
import type { Lap } from '@/api/openf1'
import { getRaceAvailability } from '@/utils/raceAvailability'

function useTelemetryParams() {
  const route = useRoute()
  const season = computed(() => parseInt(String(route.params.season ?? 0), 10))
  const round = computed(() => parseInt(String(route.params.round ?? 0), 10))
  return { season, round }
}

const { season, round } = useTelemetryParams()
const router = useRouter()
const seasonStore = useSeasonStore()
const store = useRaceStore()

const isLoadingRace = ref(false)
const raceLoadError = ref<string | null>(null)
const isLoadingLaps = ref(false)
const isLoadingTelemetry = ref(false)
const telemetryError = ref<string | null>(null)
const loadProgress = ref(0)

const raceConfirmed = ref(false)
const driversConfirmed = ref(false)
const lapConfirmed = ref(false)

const telemetrySchedule = ref<ErgastRace[]>([])

const selectedRound = ref<number | null>(round.value || null)
const driverA = ref<number | null>(null)
const driverB = ref<number | null>(null)
const selectedLap = ref<number | null>(null)

watch(
  () => round.value,
  r => {
    if (r) selectedRound.value = r
  }
)

watch(
  () => season.value,
  s => {
    if (s) seasonStore.syncSelectedSeasonOnly(s)
  },
  { immediate: true }
)

const results = computed(() => store.results)

const completedRaces = computed(() =>
  telemetrySchedule.value
    .filter(race => getRaceAvailability(race.date, season.value) === 'available')
    .sort((a, b) => Number(b.round) - Number(a.round))
)

const upcomingRaces = computed(() =>
  telemetrySchedule.value
    .filter(race => getRaceAvailability(race.date, season.value) === 'upcoming')
    .sort((a, b) => Number(a.round) - Number(b.round))
)

const isUpcomingRace = computed(() =>
  selectedRound.value != null
    ? upcomingRaces.value.some(r => Number(r.round) === selectedRound.value)
    : false
)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const nextRaceDate = computed(() => {
  const next = upcomingRaces.value[0]
  return next ? formatDate(next.date) : ''
})

const availableDrivers = computed(() => store.drivers)

const driversByNumber = computed(() => {
  return store.drivers.map(d => {
    const fromResult = results.value.find(r => r.Driver.code === d.name_acronym)
    const team = d.team_name || fromResult?.Constructor.name || 'Unknown Team'
    const code = d.name_acronym || fromResult?.Driver.code || `#${d.driver_number}`
    const resultName = `${fromResult?.Driver.givenName ?? ''} ${fromResult?.Driver.familyName ?? ''}`.trim()
    const name = d.full_name || resultName || `#${d.driver_number}`
    return {
      num: d.driver_number,
      code,
      name: name || `#${d.driver_number}`,
      team,
      color: getTeamColor(team),
    }
  })
})

/**
 * Fastest lap among the two selected drivers only: requires laps loaded.
 */
const fastestLapNumber = computed(() => {
  let best: { lap: number; time: number } | null = null
  for (const num of [driverA.value, driverB.value].filter((n): n is number => n != null)) {
    const lapsList = store.laps[num]
    for (const l of lapsList || []) {
      if (!l.lap_duration || l.lap_duration <= 0) continue
      if (!best || l.lap_duration < best.time) best = { lap: l.lap_number, time: l.lap_duration }
    }
  }
  return best?.lap ?? 1
})

const totalLaps = computed(() =>
  store.results.length > 0 ? Math.max(...store.results.map(r => Number(r.laps ?? 0))) : 78
)

const raceName = computed(() => store.currentSession?.circuit_short_name || `Round ${round.value}`)

const dataA = computed(() => {
  if (driverA.value == null || selectedLap.value == null) return []
  const key = `${driverA.value}-${selectedLap.value}`
  return store.lapTelemetry[key] ?? []
})

const dataB = computed(() => {
  if (driverB.value == null || selectedLap.value == null) return []
  const key = `${driverB.value}-${selectedLap.value}`
  return store.lapTelemetry[key] ?? []
})

const driverAInfo = computed(() => driversByNumber.value.find(d => d.num === driverA.value) || null)
const driverBInfo = computed(() => driversByNumber.value.find(d => d.num === driverB.value) || null)

const lapDataA = computed((): Lap | null => {
  if (driverA.value == null || selectedLap.value == null) return null
  return store.laps[driverA.value]?.find(l => l.lap_number === selectedLap.value) ?? null
})

const lapDataB = computed((): Lap | null => {
  if (driverB.value == null || selectedLap.value == null) return null
  return store.laps[driverB.value]?.find(l => l.lap_number === selectedLap.value) ?? null
})

const currentStep = computed(() => {
  if (!raceConfirmed.value) return 1
  if (!driversConfirmed.value) return 2
  if (isLoadingTelemetry.value) return 4
  if (!lapConfirmed.value) return 3
  return 5
})

async function ensureTelemetrySchedule(seasonNum: number) {
  if (seasonNum === seasonStore.selectedSeason) {
    if (!seasonStore.schedule.length) {
      await seasonStore.loadCurrentSeason()
    }
    telemetrySchedule.value = seasonStore.schedule
    return
  }
  const data = (await getSeasonRaces(seasonNum)) as {
    MRData?: { RaceTable?: { Races?: ErgastRace[] } }
  }
  telemetrySchedule.value = data?.MRData?.RaceTable?.Races ?? []
}

/**
 * Route / season change: load schedule for dropdown only. No OpenF1 race load.
 */
watch(
  () => [season.value, round.value] as const,
  async ([s, r]) => {
    if (!s || !r) return
    await ensureTelemetrySchedule(s)
    selectedRound.value = r
    raceConfirmed.value = false
    driversConfirmed.value = false
    lapConfirmed.value = false
    driverA.value = null
    driverB.value = null
    selectedLap.value = null
    raceLoadError.value = null
    telemetryError.value = null
    store.reset()
  },
  { immediate: true }
)

/**
 * User confirms race: only then we load OpenF1 race + driver list.
 */
async function onRaceConfirmed() {
  if (selectedRound.value == null) return

  telemetryError.value = null
  raceLoadError.value = null
  driverA.value = null
  driverB.value = null
  selectedLap.value = null
  driversConfirmed.value = false
  lapConfirmed.value = false
  store.reset()

  isLoadingRace.value = true
  try {
    await store.loadRace(season.value, selectedRound.value)
    if (!store.currentSession?.session_key) throw new Error('Missing session')
    await router.push(`/telemetry/${season.value}/${selectedRound.value}`)
    raceConfirmed.value = true
  } catch {
    raceLoadError.value = 'Could not load race data. Try another race.'
  } finally {
    isLoadingRace.value = false
  }
}

/**
 * Load laps for both drivers, then default lap to fastest among them.
 */
async function onDriversConfirmed() {
  if (!driverA.value || !driverB.value) return
  if (driverA.value === driverB.value) return

  const sk = store.currentSession?.session_key
  if (!sk) return

  isLoadingLaps.value = true
  telemetryError.value = null
  lapConfirmed.value = false

  try {
    await store.loadLapsForDriver(sk, driverA.value)
    await store.loadLapsForDriver(sk, driverB.value)

    const lapsA = store.laps[driverA.value]
    const lapsB = store.laps[driverB.value]
    if (!lapsA?.length || !lapsB?.length) {
      telemetryError.value = 'No lap data available for one or both drivers.'
      return
    }

    selectedLap.value = fastestLapNumber.value
    driversConfirmed.value = true
  } catch {
    telemetryError.value = 'Could not load lap data for these drivers.'
  } finally {
    isLoadingLaps.value = false
  }
}

/**
 * Fetch car telemetry for the selected lap: only user-triggered path.
 */
async function onLapConfirmed() {
  if (!selectedLap.value || !driverA.value || !driverB.value) return

  const sk = store.currentSession?.session_key
  if (!sk) return

  const lapsA = store.laps[driverA.value]
  const lapsB = store.laps[driverB.value]
  if (!lapsA?.length || !lapsB?.length) {
    console.warn('[TelemetryView] Laps not ready yet for drivers', driverA.value, driverB.value)
    telemetryError.value = 'Lap data not loaded. Use “Load lap data” first.'
    return
  }

  isLoadingTelemetry.value = true
  telemetryError.value = null
  lapConfirmed.value = false
  loadProgress.value = 0

  try {
    loadProgress.value = 20
    await store.loadTelemetryForLap(sk, driverA.value, selectedLap.value)
    loadProgress.value = 60
    await store.loadTelemetryForLap(sk, driverB.value, selectedLap.value)
    loadProgress.value = 100
    lapConfirmed.value = true
  } catch (e) {
    telemetryError.value = 'Could not load telemetry. Try a different lap.'
    console.error('[TelemetryView] telemetry load failed:', e)
  } finally {
    isLoadingTelemetry.value = false
  }
}

function onDriverAChange() {
  if (driverA.value === driverB.value) {
    const next = availableDrivers.value.find(d => d.driver_number !== driverA.value)
    driverB.value = next?.driver_number ?? null
  }
  telemetryError.value = null
}

function onLapChange() {
  lapConfirmed.value = false
  telemetryError.value = null
}
</script>

<template>
  <div class="telemetry-view">
    <div v-if="isLoadingRace" class="telemetry-progress" />

    <div class="container py-10">
      <div class="page-header">
        <h1 class="page-title">Telemetry Deep Dive</h1>
        <p class="page-subtitle">Compare any two drivers across any lap</p>
      </div>

      <!-- Progress indicator -->
      <div class="step-indicator">
        <div
          v-for="step in 3"
          :key="step"
          class="step-dot"
          :class="{
            'step-dot--complete': currentStep > step,
            'step-dot--active': currentStep === step,
          }"
        >
          <span class="step-number">{{ step }}</span>
          <span class="step-label">{{ ['Confirm Race', 'Select Drivers', 'Generate Telemetry'][step - 1] }}</span>
        </div>
      </div>

      <!-- STEP 1 -->
      <div class="selector-section" :class="{ 'selector-section--inactive': currentStep > 1 }">
        <label class="selector-label">
          <span class="step-badge">1</span>
          Choose a Race
        </label>
        <p class="selector-hint">Pick a completed Grand Prix, then confirm to load drivers</p>
        <select v-model.number="selectedRound" class="selector-dropdown selector-dropdown--wide" :disabled="isLoadingRace">
          <option :value="null" disabled>- Select a Grand Prix -</option>
          <optgroup :label="`${season} Season`">
            <option v-for="race in completedRaces" :key="race.round" :value="parseInt(race.round, 10)">
              Round {{ race.round }} | {{ race.raceName }}
            </option>
          </optgroup>
          <optgroup v-if="upcomingRaces.length" label="Upcoming: not available">
            <option
              v-for="race in upcomingRaces"
              :key="race.round"
              :value="parseInt(race.round, 10)"
              disabled
            >
              Round {{ race.round }} | {{ race.raceName }} ({{ formatDate(race.date) }})
            </option>
          </optgroup>
        </select>

        <div v-if="raceLoadError" class="notice notice--error">{{ raceLoadError }}</div>

        <div v-if="isUpcomingRace" class="notice notice--upcoming">
          This race has not happened yet: no data available{{ nextRaceDate ? ` until ${nextRaceDate}` : '' }}.
        </div>

        <button
          type="button"
          class="btn-primary"
          :disabled="selectedRound == null || isLoadingRace || isUpcomingRace"
          @click="onRaceConfirmed"
        >
          {{ isLoadingRace ? 'Loading…' : 'Confirm race' }}
        </button>
      </div>

      <!-- STEP 2 -->
      <Transition name="fade-slide">
        <div v-if="raceConfirmed" class="selector-section" :class="{ 'selector-section--inactive': currentStep > 2 }">
          <label class="selector-label">
            <span class="step-badge">2</span>
            Choose Two Drivers
          </label>
          <p class="selector-hint">Select both drivers, then load lap timing data</p>

          <div class="driver-selector-row">
            <div class="driver-selector-group">
              <span class="driver-selector-tag driver-selector-tag--a">Driver A</span>
              <select v-model.number="driverA" class="selector-dropdown" @change="onDriverAChange">
                <option :value="null" disabled>- Driver A -</option>
                <option
                  v-for="driver in availableDrivers"
                  :key="driver.driver_number"
                  :value="driver.driver_number"
                >
                  {{ driver.name_acronym }} | {{ driver.team_name }}
                </option>
              </select>
            </div>

            <span class="vs-label">VS</span>

            <div class="driver-selector-group">
              <span class="driver-selector-tag driver-selector-tag--b">Driver B</span>
              <select v-model.number="driverB" class="selector-dropdown">
                <option :value="null" disabled>- Driver B -</option>
                <option
                  v-for="driver in availableDrivers"
                  :key="driver.driver_number"
                  :value="driver.driver_number"
                  :disabled="driver.driver_number === driverA"
                >
                  {{ driver.name_acronym }} | {{ driver.team_name }}
                  {{ driver.driver_number === driverA ? ' (already selected)' : '' }}
                </option>
              </select>
            </div>
          </div>

          <button
            type="button"
            class="btn-primary"
            :disabled="!driverA || !driverB || driverA === driverB || isLoadingLaps"
            @click="onDriversConfirmed"
          >
            {{ isLoadingLaps ? 'Loading laps…' : 'Load lap data' }}
          </button>
        </div>
      </Transition>

      <!-- STEP 3 -->
      <Transition name="fade-slide">
        <div v-if="driversConfirmed" class="selector-section">
          <label class="selector-label">
            <span class="step-badge">3</span>
            Lap &amp; Telemetry
          </label>
          <p class="selector-hint">
            Default is the fastest lap between your two drivers. Race length: {{ totalLaps }} laps.
          </p>
          <div class="lap-selector-row">
            <input
              v-model.number="selectedLap"
              type="number"
              :min="1"
              :max="totalLaps"
              class="lap-input"
              @change="onLapChange"
            />
            <span class="lap-of">of {{ totalLaps }}</span>
            <button type="button" class="btn-fastest" @click="selectedLap = fastestLapNumber; onLapChange()">
              Fastest lap
            </button>
          </div>

          <button
            type="button"
            class="btn-primary mt-4"
            :disabled="!selectedLap || isLoadingTelemetry"
            @click="onLapConfirmed"
          >
            {{ isLoadingTelemetry ? 'Loading telemetry…' : 'Generate telemetry' }}
          </button>
        </div>
      </Transition>

      <Transition name="fade">
        <div v-if="currentStep === 4" class="telemetry-loading">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" :style="{ width: `${loadProgress}%` }" />
          </div>
          <p class="loading-label">Loading telemetry for lap {{ selectedLap }}…</p>
        </div>
      </Transition>

      <div v-if="telemetryError" class="telemetry-error">
        {{ telemetryError }}
      </div>

      <Transition name="fade">
        <div v-if="lapConfirmed && dataA.length > 0 && dataB.length > 0 && driverAInfo && driverBInfo" class="charts-section">
          <LapSummaryCard
            v-if="selectedLap != null"
            :data-a="dataA"
            :data-b="dataB"
            :lap-data-a="lapDataA"
            :lap-data-b="lapDataB"
            :driver-a="{ name_acronym: driverAInfo.code, team_name: driverAInfo.team }"
            :driver-b="{ name_acronym: driverBInfo.code, team_name: driverBInfo.team }"
            :lap-number="selectedLap"
          />
          <SpeedTrace
            :driverA="{ code: driverAInfo.code, color: driverAInfo.color }"
            :driverB="{ code: driverBInfo.code, color: driverBInfo.color }"
            :dataA="dataA"
            :dataB="dataB"
          />
          <ThrottleTrace
            :driverA="{ code: driverAInfo.code, color: driverAInfo.color }"
            :driverB="{ code: driverBInfo.code, color: driverBInfo.color }"
            :dataA="dataA"
            :dataB="dataB"
          />
          <BrakeTrace
            :driverA="{ code: driverAInfo.code, color: driverAInfo.color }"
            :driverB="{ code: driverBInfo.code, color: driverBInfo.color }"
            :dataA="dataA"
            :dataB="dataB"
          />
          <GearTrace
            :driverA="{ code: driverAInfo.code, color: driverAInfo.color }"
            :driverB="{ code: driverBInfo.code, color: driverBInfo.color }"
            :dataA="dataA"
            :dataB="dataB"
          />
          <TelemetryStats
            :data-a="dataA"
            :data-b="dataB"
            :driver-a="{ name_acronym: driverAInfo.code, team_name: driverAInfo.team }"
            :driver-b="{ name_acronym: driverBInfo.code, team_name: driverBInfo.team }"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.telemetry-view {
  position: relative;
}

.telemetry-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  width: 100%;
  background: linear-gradient(90deg, transparent, #e8002d 40%, #e8002d 60%, transparent);
  background-size: 200% 100%;
  animation: telemetry-progress-shimmer 1.2s ease-in-out infinite;
  z-index: 9999;
  box-shadow: 0 0 8px rgba(232, 0, 45, 0.5);
}

@keyframes telemetry-progress-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.page-header {
  margin-bottom: 28px;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #fff;
  margin: 0 0 4px;
}

.page-subtitle {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
}

.step-indicator {
  display: flex;
  gap: 0;
  margin-bottom: 32px;
}

.step-dot {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  padding: 12px 16px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  opacity: 0.4;
  transition:
    opacity 0.3s,
    border-color 0.3s;
}

.step-dot--active {
  opacity: 1;
  border-bottom-color: #e8002d;
}

.step-dot--complete {
  opacity: 0.7;
  border-bottom-color: #00c853;
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.step-dot--active .step-number {
  background: #e8002d;
}

.step-dot--complete .step-number {
  background: #00c853;
}

.step-label {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.selector-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
  transition: opacity 0.3s;
}

.selector-section--inactive {
  opacity: 0.6;
}

.selector-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 6px;
}

.selector-hint {
  font-size: 13px;
  color: #666;
  margin-bottom: 16px;
}

.step-badge {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #e8002d;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}

.selector-dropdown {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 12px 16px;
  color: #fff;
  font-size: 15px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 16px center;
}

.selector-dropdown:focus {
  outline: none;
  border-color: #e8002d;
}

.selector-dropdown--wide {
  margin-bottom: 12px;
}

.btn-primary {
  margin-top: 12px;
  padding: 12px 24px;
  background: #e8002d;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mt-4 {
  margin-top: 1rem;
}

.driver-selector-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.vs-label {
  font-size: 14px;
  font-weight: 800;
  color: #e8002d;
  letter-spacing: 2px;
}

.driver-selector-group {
  display: flex;
  flex-direction: column;
}

.driver-selector-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  align-self: flex-start;
}

.driver-selector-tag--a {
  background: rgba(54, 113, 198, 0.3);
  color: #3671c6;
}

.driver-selector-tag--b {
  background: rgba(232, 0, 45, 0.3);
  color: #e8002d;
}

.lap-selector-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.lap-input {
  width: 100px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 12px 16px;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  text-align: center;
}

.lap-input:focus {
  outline: none;
  border-color: #e8002d;
}

.lap-of {
  font-size: 14px;
  color: #666;
}

.btn-fastest {
  padding: 10px 16px;
  background: rgba(255, 214, 0, 0.1);
  border: 1px solid rgba(255, 214, 0, 0.3);
  border-radius: 8px;
  color: #ffd600;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.notice--error {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(232, 0, 45, 0.08);
  border: 1px solid rgba(232, 0, 45, 0.2);
  border-radius: 8px;
  font-size: 14px;
  color: #ff6b6b;
}

.notice--upcoming {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(255, 214, 0, 0.08);
  border: 1px solid rgba(255, 214, 0, 0.2);
  border-radius: 8px;
  font-size: 14px;
  color: #ffd600;
}

.telemetry-loading {
  padding: 32px;
  text-align: center;
}

.progress-bar-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-bar-fill {
  height: 100%;
  background: #e8002d;
  border-radius: 2px;
  transition: width 0.4s ease;
}

.loading-label {
  font-size: 14px;
  color: #888;
}

.charts-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 8px;
}

.telemetry-error {
  padding: 16px 20px;
  background: rgba(232, 0, 45, 0.08);
  border: 1px solid rgba(232, 0, 45, 0.2);
  border-radius: 8px;
  color: #e8002d;
  font-size: 14px;
  margin-bottom: 16px;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.3s,
    transform 0.3s;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
