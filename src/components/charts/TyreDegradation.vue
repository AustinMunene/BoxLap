<!--
  TyreDegradation.vue

  Shows how each driver's lap times evolved over the life of each tyre stint.
  X axis: tyre age in laps (lap 1 on a tyre, lap 2, lap 3, etc.)
  Y axis: lap time in seconds
  One line per driver per stint, colored by tyre compound.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { Lap, Stint } from '@/api/openf1'
import type { ErgastRaceResult } from '@/api/ergast'
import { getTyreColor } from '@/constants/teams'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const props = defineProps<{
  /**
   * Race results (Ergast) used for driver ordering and codes.
   *
   * Data source: Ergast race results.
   */
  results: ErgastRaceResult[]
  /**
   * Laps keyed by driver permanent number.
   *
   * Data source: OpenF1 `/laps`.
   */
  lapsByDriver: Record<number, Lap[]>
  /**
   * Stint list for the session.
   *
   * Data source: OpenF1 `/stints`.
   */
  stints: Stint[]
}>()

/**
 * Computes the median of a numeric array.
 *
 * Returns: 0 when array is empty, otherwise median value.
 */
function median(vals: number[]): number {
  if (vals.length === 0) return 0
  const sorted = [...vals].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Converts lap time (seconds) into a friendly tooltip string.
 *
 * Returns: `M:SS.mmm` string.
 */
function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`
}

/**
 * Returns the set of driver codes we will render by default.
 *
 * Why: plotting all 20 drivers with 2–3 stints each can exceed the 500-point
 * guideline for responsive charts. We start with top 10 finishers (most relevant),
 * and allow fans to toggle visibility by driver.
 */
const defaultDriverCodes = computed(() => props.results.slice(0, 10).map(r => r.Driver.code))

const hiddenDrivers = ref<Set<string>>(new Set())

/**
 * Toggles visibility for all stints belonging to a driver.
 *
 * Returns: void.
 */
function toggleDriver(code: string) {
  const next = new Set(hiddenDrivers.value)
  if (next.has(code)) next.delete(code)
  else next.add(code)
  hiddenDrivers.value = next
}

const driverToggles = computed(() =>
  props.results.slice(0, 10).map(r => ({
    code: r.Driver.code,
    driverNumber: parseInt(r.Driver.permanentNumber),
  }))
)

type DatasetPoint = { x: number; y: number }

const datasets = computed(() => {
  if (!props.stints || props.stints.length === 0) return []

  const out: Array<{
    label: string
    data: DatasetPoint[]
    borderColor: string
    backgroundColor: string
    borderWidth: number
    pointRadius: number
    tension: number
    spanGaps: boolean
    hidden: boolean
  }> = []

  // Precompute per-driver "median lap time" used for the outlier filter (median + 3s).
  // Data source: OpenF1 `/laps`.
  const driverMedian: Record<number, number> = {}
  for (const r of props.results) {
    const num = parseInt(r.Driver.permanentNumber)
    const laps = props.lapsByDriver[num] || []
    const valid = laps
      .filter(l => l.lap_duration != null && l.lap_duration > 0 && !l.is_pit_out_lap)
      .map(l => l.lap_duration as number)
    driverMedian[num] = median(valid)
  }

  // Build a fast lookup map from driver -> laps by lap_number for O(1) access.
  const lapsByLapNumber: Record<number, Record<number, Lap>> = {}
  for (const r of props.results) {
    const num = parseInt(r.Driver.permanentNumber)
    const laps = props.lapsByDriver[num] || []
    const map: Record<number, Lap> = {}
    for (const lap of laps) map[lap.lap_number] = lap
    lapsByLapNumber[num] = map
  }

  for (const r of props.results.slice(0, 10)) {
    const driverNum = parseInt(r.Driver.permanentNumber)
    const code = r.Driver.code
    const med = driverMedian[driverNum] || 0

    const driverStints = (props.stints || [])
      .filter(s => s.driver_number === driverNum)
      .sort((a, b) => a.stint_number - b.stint_number)

    for (const s of driverStints) {
      const stintLen = s.lap_end - s.lap_start + 1
      if (stintLen < 3) continue // short stints don't show a trend

      const compound = String(s.compound || '').toUpperCase()
      const tyreAgeStart = s.tyre_age_at_start ?? 0
      const compoundColor = getTyreColor(compound).bg

      const pts: DatasetPoint[] = []
      for (let lapNum = s.lap_start; lapNum <= s.lap_end; lapNum++) {
        const lap = lapsByLapNumber[driverNum]?.[lapNum]
        if (!lap) continue

        // Exclude pit in lap: the last lap of a stint is typically the pit in lap (artificially slow).
        if (lapNum === s.lap_end) continue

        // Exclude pit out laps (OpenF1 marks these explicitly).
        if (lap.is_pit_out_lap) continue

        const dur = lap.lap_duration
        if (dur == null || dur <= 0) continue

        // Exclude slow outliers relative to the driver's typical pace.
        // This catches SC/VSC laps and incident laps without needing race control inputs here.
        if (med > 0 && dur > med + 3) continue

        // Non-obvious transform:
        // Tyre age is derived using tyre_age_at_start + (lap_number - stint_start_lap).
        // This aligns different strategies on a shared "life on tyre" axis.
        const tyreAge = tyreAgeStart + (lapNum - s.lap_start) + 1
        pts.push({ x: tyreAge, y: dur })
      }

      if (pts.length < 3) continue

      out.push({
        label: `${code} · ${compound} · Stint ${s.stint_number}`,
        data: pts,
        borderColor: compoundColor,
        backgroundColor: compoundColor + '22',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
        spanGaps: true,
        hidden: hiddenDrivers.value.has(code) || !defaultDriverCodes.value.includes(code),
      })
    }
  }

  return out
})

const chartData = computed(() => {
  if (datasets.value.length === 0) return null
  return {
    // For scatter-like x/y points, CategoryScale isn't needed, but vue-chartjs expects labels.
    // We keep an empty label set and rely on the linear x-scale.
    labels: [] as string[],
    datasets: datasets.value,
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'nearest' as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111',
      borderColor: '#333',
      borderWidth: 1,
      titleColor: '#fff',
      bodyColor: '#ccc',
      callbacks: {
        label: (ctx: { dataset: { label?: string }; raw: unknown }) => {
          const p = ctx.raw as { x?: number; y?: number }
          const x = p?.x
          const y = p?.y
          if (!x || !y) return `${ctx.dataset.label}: -`
          return `${ctx.dataset.label}: tyre lap ${x} · ${formatLapTime(y)}`
        },
      },
    },
  },
  scales: {
    x: {
      type: 'linear' as const,
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { family: 'DM Mono', size: 10 } },
      title: { display: true, text: 'Tyre age (laps on this tyre)', color: '#555', font: { size: 11 } },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { family: 'DM Mono', size: 10 } },
      title: { display: true, text: 'Lap time (s)', color: '#555', font: { size: 11 } },
    },
  },
}))
</script>

<template>
  <div>
    <div class="driver-toggles">
      <button
        v-for="d in driverToggles"
        :key="d.code"
        class="driver-toggle"
        :class="{ active: !hiddenDrivers.has(d.code) }"
        @click="toggleDriver(d.code)"
      >
        {{ d.code }}
      </button>
    </div>

    <div class="chart-wrapper">
      <Line v-if="chartData" :data="chartData" :options="chartOptions" />
      <div v-else class="no-data">No stint + lap data loaded</div>
    </div>
  </div>
</template>

<style scoped>
.driver-toggles {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.driver-toggle {
  padding: 0.2rem 0.625rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  color: #666;
  cursor: pointer;
  transition: all 0.15s;
  letter-spacing: 0.04em;
}

.driver-toggle.active {
  border-color: rgba(232, 0, 45, 0.7);
  color: #fff;
  background: rgba(232, 0, 45, 0.12);
}

.chart-wrapper {
  height: 360px;
  position: relative;
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #555;
  font-size: 0.875rem;
}
</style>

