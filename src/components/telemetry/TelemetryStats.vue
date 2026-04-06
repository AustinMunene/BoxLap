<!--
  TelemetryStats.vue

  Displays key telemetry deltas as structured stat cards.
  No AI API calls: all values computed from the raw telemetry data.
-->
<script setup lang="ts">
import { computed } from 'vue'

type Sample = {
  speed?: number | null
  brake?: boolean | null
  throttle?: number | null
  n_gear?: number | null
  distance_m?: number
}

const props = defineProps<{
  dataA: Sample[]
  dataB: Sample[]
  driverA: { name_acronym: string; team_name: string }
  driverB: { name_acronym: string; team_name: string }
}>()

function maxSpeed(samples: Sample[]): number {
  const vals = samples.map(s => s.speed).filter((v): v is number => v != null && Number.isFinite(v))
  return vals.length > 0 ? Math.max(...vals) : 0
}

const topSpeedA = computed(() => maxSpeed(props.dataA))
const topSpeedB = computed(() => maxSpeed(props.dataB))
const topSpeedDelta = computed(() => topSpeedA.value - topSpeedB.value)
const topSpeedLeader = computed(() =>
  topSpeedDelta.value >= 0 ? props.driverA.name_acronym : props.driverB.name_acronym
)

const gearChangesA = computed(() => {
  let count = 0
  const arr = props.dataA
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].n_gear !== arr[i - 1].n_gear) count++
  }
  return count
})
const gearChangesB = computed(() => {
  let count = 0
  const arr = props.dataB
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].n_gear !== arr[i - 1].n_gear) count++
  }
  return count
})

const fullThrottlePctA = computed(() => {
  const arr = props.dataA
  if (!arr.length) return 0
  const full = arr.filter(s => (s.throttle ?? 0) >= 95).length
  return Math.round((full / arr.length) * 100)
})
const fullThrottlePctB = computed(() => {
  const arr = props.dataB
  if (!arr.length) return 0
  const full = arr.filter(s => (s.throttle ?? 0) >= 95).length
  return Math.round((full / arr.length) * 100)
})

const brakingPctA = computed(() => {
  const arr = props.dataA
  if (!arr.length) return 0
  const braking = arr.filter(s => s.brake).length
  return Math.round((braking / arr.length) * 100)
})
const brakingPctB = computed(() => {
  const arr = props.dataB
  if (!arr.length) return 0
  const braking = arr.filter(s => s.brake).length
  return Math.round((braking / arr.length) * 100)
})

const stats = computed(() => [
  {
    icon: '⚡',
    label: 'Top Speed',
    valueA: `${topSpeedA.value.toFixed(0)} km/h`,
    valueB: `${topSpeedB.value.toFixed(0)} km/h`,
    delta: `${topSpeedLeader.value} +${Math.abs(topSpeedDelta.value).toFixed(1)} km/h`,
    deltaPositive: topSpeedDelta.value >= 0,
    explanation: 'Higher top speed suggests lower drag setup or more power deployment',
  },
  {
    icon: '🔥',
    label: 'Full Throttle %',
    valueA: `${fullThrottlePctA.value}%`,
    valueB: `${fullThrottlePctB.value}%`,
    delta:
      fullThrottlePctA.value >= fullThrottlePctB.value
        ? `${props.driverA.name_acronym} +${fullThrottlePctA.value - fullThrottlePctB.value}%`
        : `${props.driverB.name_acronym} +${fullThrottlePctB.value - fullThrottlePctA.value}%`,
    deltaPositive: fullThrottlePctA.value >= fullThrottlePctB.value,
    explanation: 'More full-throttle time means more time at maximum power',
  },
  {
    icon: '🛑',
    label: 'Braking %',
    valueA: `${brakingPctA.value}%`,
    valueB: `${brakingPctB.value}%`,
    delta:
      brakingPctA.value <= brakingPctB.value
        ? `${props.driverA.name_acronym} braked less`
        : `${props.driverB.name_acronym} braked less`,
    deltaPositive: brakingPctA.value <= brakingPctB.value,
    explanation: 'Less braking time with similar lap time = more efficient through corners',
  },
  {
    icon: '⚙️',
    label: 'Gear Changes',
    valueA: `${gearChangesA.value}`,
    valueB: `${gearChangesB.value}`,
    delta: `Δ ${Math.abs(gearChangesA.value - gearChangesB.value)} changes`,
    deltaPositive: true,
    explanation: 'More gear changes can indicate a more aggressive driving style',
  },
])
</script>

<template>
  <div class="telemetry-stats">
    <h3 class="stats-title">What the data shows</h3>
    <p class="stats-subtitle">Computed directly from telemetry: no AI needed</p>

    <div class="stats-header-row">
      <span />
      <span class="driver-col driver-col--a">{{ driverA.name_acronym }}</span>
      <span class="driver-col driver-col--b">{{ driverB.name_acronym }}</span>
      <span class="delta-col">Edge</span>
    </div>

    <div v-for="stat in stats" :key="stat.label" class="stat-row">
      <div class="stat-label">
        <span class="stat-icon">{{ stat.icon }}</span>
        <div>
          <div class="stat-name">{{ stat.label }}</div>
          <div class="stat-explanation">{{ stat.explanation }}</div>
        </div>
      </div>
      <span class="stat-value">{{ stat.valueA }}</span>
      <span class="stat-value">{{ stat.valueB }}</span>
      <span class="stat-delta" :class="{ 'stat-delta--positive': stat.deltaPositive }">
        {{ stat.delta }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.telemetry-stats {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 24px;
  margin-top: 16px;
}

.stats-title {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}

.stats-subtitle {
  font-size: 13px;
  color: #888;
  margin-bottom: 20px;
}

.stats-header-row {
  display: grid;
  grid-template-columns: 1fr 100px 100px 160px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #888;
}

.driver-col {
  text-align: center;
}

.driver-col--a {
  color: #3671c6;
}

.driver-col--b {
  color: #e8002d;
}

.delta-col {
  text-align: right;
}

.stat-row {
  display: grid;
  grid-template-columns: 1fr 100px 100px 160px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.stat-label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.stat-icon {
  font-size: 18px;
  margin-top: 2px;
}

.stat-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.stat-explanation {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
}

.stat-value {
  font-family: 'DM Mono', monospace;
  font-size: 15px;
  font-weight: 700;
  color: #ddd;
  text-align: center;
}

.stat-delta {
  font-size: 13px;
  font-weight: 600;
  color: #888;
  text-align: right;
}

.stat-delta--positive {
  color: #00c853;
}
</style>
