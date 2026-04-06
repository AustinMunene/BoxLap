<template>
  <div class="chart-scroll-wrap strategy-timeline-wrap">
  <div class="strategy-timeline">
    <div v-for="driver in driverStints" :key="driver.code" class="driver-row">
      <div class="driver-label">
        <span class="code">{{ driver.code }}</span>
      </div>
      <div class="stints-track">
        <div
          v-for="(stint, i) in driver.stints"
          :key="i"
          class="stint-block"
          :style="{
            left: `${(stint.lap_start / totalLaps) * 100}%`,
            width: `${((stint.lap_end - stint.lap_start + 1) / totalLaps) * 100}%`,
            background: getTyreColor(stint.compound).bg,
            color: getTyreColor(stint.compound).text,
          }"
          :title="`${stint.compound}: Laps ${stint.lap_start}–${stint.lap_end}`"
        >
          <span class="compound-label">{{ getTyreColor(stint.compound).label }}</span>
        </div>

        <!-- Pit stop markers -->
        <div
          v-for="pit in driver.pits"
          :key="pit.lap_number"
          class="pit-marker"
          :style="{ left: `${(pit.lap_number / totalLaps) * 100}%` }"
          :title="`Pit: ${pit.pit_duration?.toFixed(2)}s`"
        >
          <span class="pit-duration">{{ pit.pit_duration?.toFixed(1) }}s</span>
        </div>
      </div>
    </div>

    <!-- Lap axis -->
    <div class="lap-axis">
      <div class="driver-label"></div>
      <div class="axis-track">
        <span
          v-for="n in axisLabels"
          :key="n"
          class="axis-label"
          :style="{ left: `${(n / totalLaps) * 100}%` }"
        >{{ n }}</span>
      </div>
    </div>
  </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getTyreColor } from '@/constants/teams'
import type { Stint, PitStop } from '@/api/openf1'
import type { ErgastRaceResult } from '@/api/ergast'

const props = defineProps<{
  results: ErgastRaceResult[]
  stints: Stint[]
  pits: PitStop[]
}>()

const totalLaps = computed(() => {
  const maxLap = Math.max(...props.stints.map(s => s.lap_end || 0), 60)
  return maxLap
})

const axisLabels = computed(() => {
  const total = totalLaps.value
  const step = total <= 40 ? 5 : total <= 60 ? 10 : 15
  const labels = []
  for (let i = step; i <= total; i += step) labels.push(i)
  return labels
})

const driverStints = computed(() => {
  return props.results.slice(0, 20).map(r => {
    const driverNum = parseInt(r.Driver.permanentNumber)
    const dStints = props.stints.filter(s => s.driver_number === driverNum)
    const dPits = props.pits.filter(p => p.driver_number === driverNum)
    return {
      code: r.Driver.code,
      driverNumber: driverNum,
      stints: dStints,
      pits: dPits,
    }
  }).filter(d => d.stints.length > 0)
})
</script>

<style scoped>
.strategy-timeline {
  width: 100%;
  font-size: 0.8rem;
}

.driver-row {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  height: 28px;
}

.driver-label {
  width: 48px;
  flex-shrink: 0;
  font-family: 'DM Mono', monospace;
  font-weight: 700;
  color: #888;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
}

.stints-track {
  flex: 1;
  height: 24px;
  position: relative;
  background: rgba(255,255,255,0.04);
  border-radius: 4px;
  overflow: visible;
}

.stint-block {
  position: absolute;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  cursor: default;
  transition: opacity 0.15s;
  border: 1px solid rgba(0,0,0,0.2);
}

.stint-block:hover {
  opacity: 0.85;
  z-index: 10;
}

.pit-marker {
  position: absolute;
  top: -8px;
  width: 2px;
  height: calc(100% + 14px);
  background: rgba(255,255,255,0.6);
  z-index: 5;
}

.pit-duration {
  position: absolute;
  top: -20px;
  left: 3px;
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  color: #aaa;
  white-space: nowrap;
}

.lap-axis {
  display: flex;
  margin-top: 0.25rem;
}

.axis-track {
  flex: 1;
  position: relative;
  height: 16px;
}

.axis-label {
  position: absolute;
  font-size: 0.65rem;
  color: #555;
  font-family: 'DM Mono', monospace;
  transform: translateX(-50%);
}

.compound-label {
  font-size: 0.65rem;
}
</style>
