<template>
  <div class="chart-wrapper">
    <Line v-if="chartData" :data="chartData" :options="chartOptions" />
    <div v-else class="no-data">No gap data available</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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
  Filler,
} from 'chart.js'
import type { IntervalData } from '@/types/openf1'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

/**
 * GapEvolutionChart
 *
 * Visualises the evolution of the gap to leader throughout the race.
 * Expects `intervals` from OpenF1 (see GET /intervals). The raw data
 * is sampled frequently; we aggregate it to one value per lap to keep
 * the chart responsive in the browser.
 */
const props = defineProps<{
  intervals: IntervalData[]
  scLaps?: number[]
}>()

const chartData = computed(() => {
  if (!props.intervals || props.intervals.length === 0) return null

  // Group samples by lap_number if present, otherwise by rounded minute index
  const byLap: Record<number, number[]> = {}
  for (const s of props.intervals) {
    const lap = s.lap_number ?? Math.floor(new Date(s.date).getTime() / (1000 * 60))
    // Parse gap_to_leader: can be '+5.234' or '1 LAP'
    let gapSecs: number | null = null
    if (typeof s.gap_to_leader === 'string') {
      if (/lap/i.test(s.gap_to_leader)) {
        gapSecs = 9999
      } else {
        const num = Number(s.gap_to_leader.replace('+', ''))
        gapSecs = isNaN(num) ? null : num
      }
    } else if (typeof s.gap_to_leader === 'number') gapSecs = s.gap_to_leader

    if (gapSecs == null) continue
    if (!byLap[lap]) byLap[lap] = []
    byLap[lap].push(gapSecs)
  }

  const lapNums = Object.keys(byLap).map(n => parseInt(n)).sort((a, b) => a - b)
  if (lapNums.length === 0) return null

  const labels = lapNums.map(l => String(l))
  // For each lap, choose the median gap (robust to outliers)
  const datasets = [
    {
      label: 'Gap to leader (s)',
      data: lapNums.map(l => {
        const vals = byLap[l].slice().sort((a, b) => a - b)
        const mid = Math.floor(vals.length / 2)
        return vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
      }),
      borderColor: '#EAB308',
      backgroundColor: '#EAB30822',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
      spanGaps: true,
    },
  ]

  return { labels, datasets }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { color: '#aaa', boxWidth: 12, padding: 8, font: { size: 11 } },
    },
    tooltip: {
      backgroundColor: '#111',
      titleColor: '#fff',
      bodyColor: '#ccc',
      callbacks: {
        label: (ctx: { dataset: { label?: string }; raw: unknown }) => {
          const v = ctx.raw as number
          if (v >= 9999) return `${ctx.dataset.label}: 1 LAP+`
          return `${ctx.dataset.label}: ${v.toFixed(3)}s`
        }
      }
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { size: 10 }, maxTicksLimit: 8 },
      title: { display: true, text: 'Lap', color: '#555', font: { size: 11 } },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { size: 10 } },
      title: { display: true, text: 'Gap to leader (s)', color: '#555', font: { size: 11 } },
    },
  },
}))
</script>

<style scoped>
.chart-wrapper { height: 220px; position: relative }
.no-data { display:flex; align-items:center; justify-content:center; height:100%; color:#555 }
</style>
