<!--
  ConsistencyChart.vue

  Box plot showing the distribution of each driver's clean lap times.
  This visually reveals who was consistent vs who had large swings.

  Data source: OpenF1 `/laps`
  Clean lap filtering: same as existing pace analysis (remove pit-out laps; remove slow outliers).

  Chart.js does not ship a native boxplot, so we use the boxplot controller/plugin.
  Dependency: `@sgratzl/chartjs-chart-boxplot`
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Chart as ChartJS, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { BoxPlotController, BoxAndWiskers } from '@sgratzl/chartjs-chart-boxplot'
import { Chart } from 'vue-chartjs'
import type { Lap } from '@/api/openf1'
import type { ErgastRaceResult } from '@/api/ergast'
import { getTeamColor } from '@/constants/teams'

ChartJS.register(CategoryScale, LinearScale, Tooltip, Legend, BoxPlotController, BoxAndWiskers)

const props = defineProps<{
  /**
   * Race results used to map driver codes and team colors.
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
}>()

/**
 * Computes the median of a numeric array.
 */
function median(vals: number[]): number {
  if (vals.length === 0) return 0
  const sorted = [...vals].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Filters laps to a clean set of lap durations.
 *
 * Data source: OpenF1 `/laps`.
 *
 * Why: raw lap time includes pit-out and slow incident laps.
 * We remove pit-out laps and trim slow laps above (median + 2s), matching existing pace logic.
 */
function cleanLapDurations(laps: Lap[]): number[] {
  const valid = laps
    .filter(l => l.lap_duration != null && l.lap_duration > 0 && !l.is_pit_out_lap)
    .map(l => l.lap_duration as number)
  if (valid.length === 0) return []
  const med = median(valid)
  return valid.filter(t => t <= med + 2)
}

/**
 * Computes quartiles needed for a boxplot and returns the plugin's expected shape.
 *
 * Returns: `{min, q1, median, q3, max, outliers}`.
 */
function boxStats(vals: number[]) {
  const sorted = [...vals].sort((a, b) => a - b)
  if (sorted.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0, outliers: [] as number[] }
  }

  const q = (p: number) => {
    const idx = (sorted.length - 1) * p
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    if (lo === hi) return sorted[lo]
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
  }

  const q1 = q(0.25)
  const med = q(0.5)
  const q3 = q(0.75)
  const iqr = q3 - q1

  // Outlier rule: outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR]
  const lowFence = q1 - 1.5 * iqr
  const highFence = q3 + 1.5 * iqr

  const inliers = sorted.filter(v => v >= lowFence && v <= highFence)
  const outliers = sorted.filter(v => v < lowFence || v > highFence)

  return {
    min: inliers[0] ?? sorted[0],
    q1,
    median: med,
    q3,
    max: inliers[inliers.length - 1] ?? sorted[sorted.length - 1],
    outliers,
  }
}

const series = computed(() => {
  const out: Array<{
    code: string
    team: string
    median: number
    color: string
    stats: ReturnType<typeof boxStats>
  }> = []

  for (const r of props.results) {
    const driverNum = parseInt(r.Driver.permanentNumber)
    const laps = props.lapsByDriver[driverNum] || []
    const clean = cleanLapDurations(laps)
    if (clean.length < 5) continue

    const stats = boxStats(clean)
    out.push({
      code: r.Driver.code,
      team: r.Constructor.name,
      median: stats.median,
      color: getTeamColor(r.Constructor.name),
      stats,
    })
  }

  // Sort drivers by median lap time (fastest on the left).
  out.sort((a, b) => a.median - b.median)
  return out
})

const chartData = computed(() => {
  if (series.value.length === 0) return null

  return {
    labels: series.value.map(s => s.code),
    datasets: [
      {
        label: 'Lap time distribution (s)',
        data: series.value.map(s => s.stats),
        backgroundColor: series.value.map(s => s.color + '99'), // 60% opacity-ish
        borderColor: series.value.map(s => s.color),
        borderWidth: 1.5,
        outlierColor: 'rgba(255,255,255,0.50)',
        padding: 8,
        itemRadius: 2,
      },
    ],
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
      labels: { boxWidth: 12, padding: 8, font: { size: 11 } },
    },
    tooltip: {
      backgroundColor: '#111',
      borderColor: '#333',
      borderWidth: 1,
      titleColor: '#fff',
      bodyColor: '#ccc',
      callbacks: {
        label: (ctx: { raw: unknown }) => {
          const s = ctx.raw as { min: number; q1: number; median: number; q3: number; max: number }
          if (!s) return '-'
          return `median ${s.median.toFixed(3)}s (IQR ${s.q1.toFixed(3)}–${s.q3.toFixed(3)})`
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        color: '#aaa',
        font: { family: 'DM Mono', size: 10 },
        maxTicksLimit: 8,
      },
      title: { display: true, text: 'Driver', color: '#555', font: { size: 11 } },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { family: 'DM Mono', size: 10 }, maxTicksLimit: 8 },
      title: { display: true, text: 'Lap time (s)', color: '#555', font: { size: 11 } },
    },
  },
}))
</script>

<template>
  <div class="chart-wrapper">
    <Chart v-if="chartData" type="boxplot" :data="chartData" :options="chartOptions" />
    <div v-else class="no-data">No lap data loaded</div>
  </div>
</template>

<style scoped>
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

