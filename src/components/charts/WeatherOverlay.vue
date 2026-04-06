<!--
  WeatherOverlay.vue
  Standalone temperature chart showing track temperature throughout the session.
  Displayed below the lap time chart so users can visually correlate
  track conditions with pace changes without axis conflicts.
  
  Props:
  - weather: array of WeatherData samples from OpenF1
  
  Each sample includes track_temperature, air_temperature, humidity, etc.
  We plot the track temperature as an area chart since that's most relevant
  to tyre grip and lap time correlation.
-->
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
import type { TooltipItem } from 'chart.js'
import type { WeatherData } from '@/types/openf1'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const props = defineProps<{
  weather: WeatherData[]
}>()

const chartData = computed(() => {
  if (!props.weather || props.weather.length === 0) return null

  // Sample weather data by time (aggregate to ~30 minute buckets or one per lap)
  // We have high-frequency samples; downsample to keep chart responsive
  const byTime: Record<string, WeatherData> = {}
  for (const sample of props.weather) {
    const time = sample.date.slice(11, 16) // Extract HH:MM from ISO timestamp
    // Keep only the latest sample for each minute
    const existing = byTime[time]
    if (!existing || new Date(sample.date) > new Date(existing.date)) {
      byTime[time] = sample
    }
  }

  const times = Object.keys(byTime).sort()
  if (times.length === 0) return null

  const labels = times
  const trackTemps = times.map(t => {
    const sample = byTime[t]
    return sample.track_temperature ?? null
  })
  const airTemps = times.map(t => {
    const sample = byTime[t]
    return sample.air_temperature ?? null
  })

  const datasets = []

  // Track temperature (primary, filled area)
  if (trackTemps.some(v => v != null)) {
    datasets.push({
      label: 'Track Temperature (°C)',
      data: trackTemps,
      borderColor: '#FF6B35',
      backgroundColor: '#FF6B3522',
      borderWidth: 2.5,
      pointRadius: 1,
      pointHoverRadius: 5,
      tension: 0.3,
      fill: true,
      spanGaps: true,
    })
  }

  // Air temperature (secondary, thin line)
  if (airTemps.some(v => v != null)) {
    datasets.push({
      label: 'Air Temperature (°C)',
      data: airTemps,
      borderColor: '#4A90E2',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
      spanGaps: true,
    })
  }

  return { labels, datasets }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: {
      labels: { color: '#aaa', font: { family: 'DM Mono', size: 11 }, padding: 16 },
      position: 'top' as const,
    },
    tooltip: {
      backgroundColor: '#111',
      borderColor: '#333',
      borderWidth: 1,
      titleColor: '#fff',
      bodyColor: '#ccc',
      callbacks: {
        label: (ctx: TooltipItem<'line'>) => {
          const v = ctx.raw as number | null
          if (v == null) return `${ctx.dataset.label}: -`
          return `${ctx.dataset.label}: ${v.toFixed(1)}°C`
        }
      }
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { size: 10 } },
      title: { display: true, text: 'Session Time (HH:MM)', color: '#555', font: { size: 11 } }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)' },
      ticks: { color: '#666', font: { size: 10 } },
      title: { display: true, text: 'Temperature (°C)', color: '#555', font: { size: 11 } }
    }
  }
}))
</script>

<template>
  <div class="chart-wrapper">
    <Line v-if="chartData" :data="chartData" :options="chartOptions" />
    <div v-else class="no-data">No weather data available</div>
  </div>
</template>

<style scoped>
.chart-wrapper {
  height: 200px;
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
