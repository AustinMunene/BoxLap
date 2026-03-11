<template>
  <div class="chart-wrapper">
    <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
    <div v-else class="no-data">No pace data available</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface PaceEntry {
  code: string
  pace: number
  color: string
}

const props = defineProps<{
  drivers: PaceEntry[]
}>()

const sorted = computed(() => [...props.drivers].sort((a, b) => a.pace - b.pace))

const chartData = computed(() => {
  if (sorted.value.length === 0) return null
  const min = Math.min(...sorted.value.map(d => d.pace))

  return {
    labels: sorted.value.map(d => d.code),
    datasets: [{
      label: 'Avg Clean Pace (s)',
      data: sorted.value.map(d => d.pace),
      backgroundColor: sorted.value.map(d => d.color + 'cc'),
      borderColor: sorted.value.map(d => d.color),
      borderWidth: 1,
      borderRadius: 4,
      minBarLength: 4,
    }]
  }
})

const chartOptions = computed(() => {
  const min = sorted.value.length > 0 ? Math.min(...sorted.value.map(d => d.pace)) * 0.998 : 0
  const max = sorted.value.length > 0 ? Math.max(...sorted.value.map(d => d.pace)) * 1.001 : 100

  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111',
        borderColor: '#333',
        borderWidth: 1,
        callbacks: {
          label: (ctx: { raw: unknown }) => {
            const v = ctx.raw as number
            const mins = Math.floor(v / 60)
            const secs = (v % 60).toFixed(3)
            return ` ${mins > 0 ? mins + ':' : ''}${String(Math.floor(v % 60)).padStart(2,'0')}.${secs.split('.')[1]}`
          }
        }
      }
    },
    scales: {
      x: {
        min,
        max,
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#666',
          font: { family: 'DM Mono', size: 10 },
          callback: (val: unknown) => {
            const v = val as number
            return `${(v % 60).toFixed(1)}s`
          }
        }
      },
      y: {
        grid: { display: false },
        ticks: {
          color: '#aaa',
          font: { family: 'DM Mono', size: 11 }
        }
      }
    }
  }
})
</script>

<style scoped>
.chart-wrapper {
  height: 400px;
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
