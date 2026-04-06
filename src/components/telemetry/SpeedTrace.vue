<!--
  SpeedTrace.vue

  Speed trace chart for two drivers on the same lap.
  X axis: distance into lap (metres)
  Y axis: speed (km/h)
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { TooltipItem } from 'chart.js'

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend)

type TelemetryPoint = {
  distance_m: number
  speed: number | null
}

const props = defineProps<{
  driverA: { code: string; color: string }
  driverB: { code: string; color: string }
  dataA: TelemetryPoint[]
  dataB: TelemetryPoint[]
}>()

const chartData = computed(() => {
  const has = (props.dataA?.length ?? 0) > 0 || (props.dataB?.length ?? 0) > 0
  if (!has) return null

  return {
    datasets: [
      {
        label: props.driverA.code,
        data: (props.dataA || []).map(p => ({ x: p.distance_m, y: p.speed })),
        borderColor: props.driverA.color,
        backgroundColor: props.driverA.color + '22',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
        spanGaps: true,
      },
      {
        label: props.driverB.code,
        data: (props.dataB || []).map(p => ({ x: p.distance_m, y: p.speed })),
        borderColor: props.driverB.color,
        backgroundColor: props.driverB.color + '22',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
        spanGaps: true,
      },
    ],
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'nearest' as const, intersect: false },
  plugins: {
    legend: { labels: { color: '#aaa', font: { family: 'DM Mono', size: 11 } } },
    tooltip: {
      backgroundColor: '#111',
      borderColor: '#333',
      borderWidth: 1,
      titleColor: '#fff',
      bodyColor: '#ccc',
      callbacks: {
        title: (items: TooltipItem<'line'>[]) => `At ${Math.round(items[0]?.parsed.x ?? 0)}m`,
        label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
          const v = ctx.parsed.y
          return `${ctx.dataset.label}: ${v == null ? '-' : `${Math.round(v)} km/h`}`
        },
      },
    },
  },
  scales: {
    x: {
      type: 'linear' as const,
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { family: 'DM Mono', size: 10 } },
      title: { display: true, text: 'Distance into lap (m)', color: '#555', font: { size: 11 } },
    },
    y: {
      type: 'linear' as const,
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { family: 'DM Mono', size: 10 } },
      title: { display: true, text: 'Speed (km/h)', color: '#555', font: { size: 11 } },
    },
  },
}))
</script>

<template>
  <div class="chart-wrapper">
    <Line v-if="chartData" :data="chartData" :options="chartOptions" />
    <div v-else class="no-data">Select drivers and lap to view speed trace</div>
  </div>
</template>

<style scoped>
.chart-wrapper {
  height: 260px;
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

