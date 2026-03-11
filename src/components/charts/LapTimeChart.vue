<template>
  <div class="chart-wrapper">
    <Line v-if="chartData" :data="chartData" :options="chartOptions" />
    <div v-else class="no-data">No lap time data available</div>
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
import type { Lap } from '@/api/openf1'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

interface DriverLapData {
  code: string
  color: string
  laps: Lap[]
}

const props = defineProps<{
  drivers: DriverLapData[]
  scLaps?: number[]
}>()

const chartData = computed(() => {
  const activeDrivers = props.drivers.filter(d => d.laps && d.laps.length > 0)
  if (activeDrivers.length === 0) return null

  const maxLap = Math.max(...activeDrivers.flatMap(d => d.laps.map(l => l.lap_number)))
  const labels = Array.from({ length: maxLap }, (_, i) => String(i + 1))

  const datasets = activeDrivers.map(driver => {
    const lapMap: Record<number, number | null> = {}
    for (const lap of driver.laps) {
      if (lap.lap_duration && lap.lap_duration > 0 && !lap.is_pit_out_lap) {
        lapMap[lap.lap_number] = lap.lap_duration
      }
    }
    const data = labels.map(l => lapMap[parseInt(l)] ?? null)

    return {
      label: driver.code,
      data,
      borderColor: driver.color,
      backgroundColor: driver.color + '20',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.3,
      spanGaps: true,
    }
  })

  return { labels, datasets }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      labels: { color: '#aaa', font: { family: 'DM Mono', size: 11 }, padding: 16 }
    },
    tooltip: {
      backgroundColor: '#111',
      borderColor: '#333',
      borderWidth: 1,
      titleColor: '#fff',
      bodyColor: '#ccc',
      callbacks: {
        label: (ctx: { dataset: { label?: string }; raw: unknown }) => {
          const v = ctx.raw
          if (v == null) return `${ctx.dataset.label}: —`
          const s = v as number
          const mins = Math.floor(s / 60)
          const secs = (s % 60).toFixed(3)
          return `${ctx.dataset.label}: ${mins > 0 ? mins + ':' : ''}${String(Math.floor(s % 60)).padStart(2,'0')}.${secs.split('.')[1]}`
        }
      }
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { size: 10 } },
      title: { display: true, text: 'Lap', color: '#555', font: { size: 11 } }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: {
        color: '#666',
        font: { family: 'DM Mono', size: 10 },
        callback: (val: unknown) => {
          const v = val as number
          const mins = Math.floor(v / 60)
          const secs = (v % 60).toFixed(1)
          return mins > 0 ? `${mins}:${String(Math.floor(v % 60)).padStart(2,'0')}.${secs.split('.')[1]}` : secs
        }
      },
      title: { display: true, text: 'Lap Time (s)', color: '#555', font: { size: 11 } }
    }
  }
}))
</script>

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
