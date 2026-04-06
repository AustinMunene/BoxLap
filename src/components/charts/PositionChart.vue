<template>
  <div class="chart-wrapper">
    <Line v-if="chartData" :data="chartData" :options="chartOptions" />
    <div v-else class="no-data">No position data available</div>
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
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface DriverPositions {
  code: string
  color: string
  positions: Array<{ lap: number; position: number }>
}

const props = defineProps<{
  drivers: DriverPositions[]
}>()

const chartData = computed(() => {
  const active = props.drivers.filter(d => d.positions.length > 0)
  if (active.length === 0) return null

  const maxLap = Math.max(...active.flatMap(d => d.positions.map(p => p.lap)))
  const labels = Array.from({ length: maxLap }, (_, i) => String(i + 1))

  const datasets = active.map(driver => {
    const posMap: Record<number, number> = {}
    for (const p of driver.positions) posMap[p.lap] = p.position

    return {
      label: driver.code,
      data: labels.map(l => posMap[parseInt(l)] ?? null),
      borderColor: driver.color,
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.2,
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
      position: 'top' as const,
      labels: {
        color: '#aaa',
        boxWidth: 12,
        padding: 8,
        font: { family: 'DM Mono', size: 11 },
      },
    },
    tooltip: {
      backgroundColor: '#111',
      borderColor: '#333',
      borderWidth: 1,
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { size: 10 }, maxTicksLimit: 8 },
      title: { display: true, text: 'Lap', color: '#555' }
    },
    y: {
      reverse: true,
      min: 1,
      max: 20,
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { family: 'DM Mono', size: 10 }, stepSize: 1 },
      title: { display: true, text: 'Position', color: '#555' }
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
