<template>
  <div class="chart-wrapper">
    <Radar v-if="chartData" :data="chartData" :options="chartOptions" />
    <div v-else class="no-data">Select two drivers to compare</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Radar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface DriverRadar {
  code: string
  color: string
  scores: number[] // [qualiPace, racePace, pitEfficiency, positionsGained]
}

const props = defineProps<{
  drivers: DriverRadar[]
}>()

const labels = ['Quali Pace', 'Race Pace', 'Pit Efficiency', 'Positions Gained', 'Consistency']

const chartData = computed(() => {
  if (props.drivers.length < 2) return null

  return {
    labels,
    datasets: props.drivers.map(d => ({
      label: d.code,
      data: d.scores,
      borderColor: d.color,
      backgroundColor: d.color + '30',
      borderWidth: 2,
      pointBackgroundColor: d.color,
      pointRadius: 3,
    }))
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#aaa', font: { family: 'DM Mono', size: 11 } }
    },
    tooltip: {
      backgroundColor: '#111',
      borderColor: '#333',
      borderWidth: 1,
    }
  },
  scales: {
    r: {
      min: 0,
      max: 100,
      grid: { color: 'rgba(255,255,255,0.06)' },
      angleLines: { color: 'rgba(255,255,255,0.06)' },
      pointLabels: { color: '#888', font: { size: 11 } },
      ticks: { display: false }
    }
  }
}
</script>

<style scoped>
.chart-wrapper {
  height: 340px;
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
