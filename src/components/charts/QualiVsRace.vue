<!--
  QualiVsRace.vue

  Scatter plot comparing each driver's fastest qualifying lap
  against their median clean race lap.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Scatter } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { ErgastRaceResult } from '@/api/ergast'
import type { Lap, Session } from '@/api/openf1'
import { getTeamColor } from '@/constants/teams'

ChartJS.register(LinearScale, PointElement, Tooltip, Legend)

const props = defineProps<{
  /**
   * Race results used to map driver codes and team colors.
   *
   * Data source: Ergast race results.
   */
  results: ErgastRaceResult[]
  /**
   * Race laps keyed by driver permanent number.
   *
   * Data source: OpenF1 `/laps` for race session.
   */
  raceLapsByDriver: Record<number, Lap[]>
  /**
   * Qualifying session metadata.
   *
   * Data source: OpenF1 `/sessions` filtered to `session_type=Qualifying`.
   */
  qualifyingSession: Session | null
  /**
   * Qualifying laps keyed by driver number.
   *
   * Data source: OpenF1 `/laps` for qualifying session.
   */
  qualiLapsByDriver: Record<number, Lap[]>
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
 * Filters laps to "clean" race laps and returns their durations.
 *
 * Data source: OpenF1 `/laps`.
 *
 * Notes:
 * - We follow the existing Pace analysis logic: remove pit-out laps and outliers > median + 2s.
 */
function cleanRaceLapsDurations(laps: Lap[]): number[] {
  const valid = laps
    .filter(l => l.lap_duration != null && l.lap_duration > 0 && !l.is_pit_out_lap)
    .map(l => l.lap_duration as number)
  if (valid.length === 0) return []
  const med = median(valid)
  return valid.filter(t => t <= med + 2)
}

/**
 * Computes the fastest qualifying lap time for a driver (in seconds).
 *
 * Data source: OpenF1 `/laps` for qualifying session.
 *
 * Returns: null when no valid laps are available.
 */
function fastestLap(laps: Lap[]): number | null {
  let best = Infinity
  for (const l of laps) {
    const d = l.lap_duration
    if (d == null || d <= 0) continue
    if (d < best) best = d
  }
  return best === Infinity ? null : best
}

const points = computed(() => {
  const out: Array<{
    code: string
    team: string
    color: string
    x: number
    y: number
  }> = []

  for (const r of props.results) {
    const driverNum = parseInt(r.Driver.permanentNumber)
    const raceLaps = props.raceLapsByDriver[driverNum] || []
    const qualiLaps = props.qualiLapsByDriver[driverNum] || []

    const clean = cleanRaceLapsDurations(raceLaps)
    if (clean.length < 5) continue

    const raceMedian = median(clean)
    const qualiFastest = fastestLap(qualiLaps)
    if (qualiFastest == null) continue

    out.push({
      code: r.Driver.code,
      team: r.Constructor.name,
      color: getTeamColor(r.Constructor.name),
      x: qualiFastest,
      y: raceMedian,
    })
  }

  return out
})

const chartData = computed(() => {
  if (points.value.length === 0) return null

  // Build a dashed diagonal reference line y=x across the data domain.
  const xs = points.value.map(p => p.x)
  const ys = points.value.map(p => p.y)
  const min = Math.min(...xs, ...ys)
  const max = Math.max(...xs, ...ys)

  return {
    datasets: [
      {
        label: 'Drivers',
        data: points.value.map(p => ({ x: p.x, y: p.y, _code: p.code, _color: p.color })),
        backgroundColor: points.value.map(p => p.color),
        borderColor: points.value.map(p => p.color),
        pointRadius: 5,
        pointHoverRadius: 7,
      },
      {
        // Keep this as a scatter dataset and draw it as a line via `showLine`
        // so the entire chart remains a single typed "scatter" chart.
        label: 'y = x',
        data: [
          { x: min, y: min },
          { x: max, y: max },
        ],
        borderColor: 'rgba(255,255,255,0.30)',
        borderWidth: 1.5,
        borderDash: [6, 6],
        pointRadius: 0,
        showLine: true,
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
          const p = ctx.raw as { x?: number; y?: number; _code?: string }
          if (p?.x == null || p?.y == null) return '-'
          return `${p._code ?? ''} quali ${p.x.toFixed(3)}s · race ${p.y.toFixed(3)}s`
        },
      },
    },
  },
  scales: {
    x: {
      type: 'linear' as const,
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { family: 'DM Mono', size: 10 }, maxTicksLimit: 8 },
      title: { display: true, text: 'Qualifying pace (fastest lap, s)', color: '#555', font: { size: 11 } },
    },
    y: {
      type: 'linear' as const,
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { family: 'DM Mono', size: 10 }, maxTicksLimit: 8 },
      title: { display: true, text: 'Race pace (median clean lap, s)', color: '#555', font: { size: 11 } },
    },
  },
}))
</script>

<template>
  <div class="chart-wrapper">
    <Scatter v-if="chartData" :data="chartData" :options="chartOptions" />
    <div v-else class="no-data">
      <div v-if="!qualifyingSession">No qualifying session found for this round.</div>
      <div v-else>Qualifying laps not loaded yet.</div>
    </div>
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
  text-align: center;
  padding: 1rem;
}
</style>

