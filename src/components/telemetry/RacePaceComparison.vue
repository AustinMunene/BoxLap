<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { ChartOptions } from 'chart.js'
import type { Lap } from '@/api/openf1'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const props = defineProps<{
  lapsA: Lap[]
  lapsB: Lap[]
  driverA: { name_acronym: string; team_name: string; color: string }
  driverB: { name_acronym: string; team_name: string; color: string }
  selectedLap: number | null
}>()

const emit = defineEmits<{
  lapSelected: [lapNumber: number]
}>()

function getCleanLaps(laps: Lap[]): (number | null)[] {
  if (!laps.length) return []

  const times = laps
    .filter(l => l.lap_duration !== null && !l.is_pit_out_lap)
    .map(l => l.lap_duration!)

  const sorted = [...times].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const threshold = median + 2.5

  const maxLap = Math.max(...laps.map(l => l.lap_number))
  const result: (number | null)[] = []

  for (let i = 1; i <= maxLap; i++) {
    const lap = laps.find(l => l.lap_number === i)
    if (!lap || lap.lap_duration === null || lap.is_pit_out_lap) {
      result.push(null)
    } else if (lap.lap_duration > threshold) {
      result.push(null)
    } else {
      result.push(lap.lap_duration)
    }
  }

  return result
}

function getMedianCleanTime(laps: Lap[]): number | null {
  const times = laps
    .filter(l => l.lap_duration !== null && !l.is_pit_out_lap)
    .map(l => l.lap_duration!)
    .sort((a, b) => a - b)

  if (!times.length) return null

  const median = times[Math.floor(times.length / 2)]
  const clean = times.filter(t => t <= median + 2.5)
  if (!clean.length) return null
  return clean[Math.floor(clean.length / 2)]
}

const medianA = computed(() => getMedianCleanTime(props.lapsA))
const medianB = computed(() => getMedianCleanTime(props.lapsB))

const fasterDriver = computed(() => {
  if (!medianA.value || !medianB.value) return props.driverA.name_acronym
  return medianA.value <= medianB.value ? props.driverA.name_acronym : props.driverB.name_acronym
})

const fasterDriverColor = computed(() => {
  if (!medianA.value || !medianB.value) return props.driverA.color
  return medianA.value <= medianB.value ? props.driverA.color : props.driverB.color
})

const avgGapPerLap = computed(() => {
  if (!medianA.value || !medianB.value) return '—'
  return Math.abs(medianA.value - medianB.value).toFixed(3)
})

const lapsAheadStats = computed(() => {
  let aWins = 0
  let bWins = 0
  const mapB = new Map(props.lapsB.map(l => [l.lap_number, l]))
  for (const lapA of props.lapsA) {
    const lapB = mapB.get(lapA.lap_number)
    if (!lapA.lap_duration || !lapB?.lap_duration) continue
    if (lapA.lap_duration < lapB.lap_duration) aWins++
    else if (lapB.lap_duration < lapA.lap_duration) bWins++
  }
  const fasterIsA = fasterDriver.value === props.driverA.name_acronym
  const count = fasterIsA ? aWins : bWins
  const total = aWins + bWins
  return { count, total }
})

const totalLaps = computed(() =>
  props.lapsA.length && props.lapsB.length
    ? Math.max(...props.lapsA.map(l => l.lap_number), ...props.lapsB.map(l => l.lap_number))
    : 0
)

const strongestPhase = computed(() => {
  if (!totalLaps.value) return '—'

  const third = Math.max(1, Math.floor(totalLaps.value / 3))
  const phases = [
    { label: 'Early stint', start: 1, end: third },
    { label: 'Mid race', start: third + 1, end: third * 2 },
    { label: 'Final stint', start: third * 2 + 1, end: totalLaps.value },
  ]

  let biggestGap = 0
  let strongestLabel = '—'

  for (const phase of phases) {
    const lapsInPhaseA = props.lapsA.filter(
      l =>
        l.lap_number >= phase.start &&
        l.lap_number <= phase.end &&
        l.lap_duration !== null &&
        !l.is_pit_out_lap
    )
    const avgA =
      lapsInPhaseA.reduce((s, l) => s + (l.lap_duration ?? 0), 0) / (lapsInPhaseA.length || 1)
    const lapsInPhaseB = props.lapsB.filter(
      l =>
        l.lap_number >= phase.start &&
        l.lap_number <= phase.end &&
        l.lap_duration !== null &&
        !l.is_pit_out_lap
    )
    const avgB =
      lapsInPhaseB.reduce((s, l) => s + (l.lap_duration ?? 0), 0) / (lapsInPhaseB.length || 1)

    const gap = Math.abs(avgA - avgB)
    if (gap > biggestGap) {
      biggestGap = gap
      strongestLabel = phase.label
    }
  }

  return `${fasterDriver.value} in ${strongestLabel}`
})

const verdictText = computed(() => {
  if (!medianA.value || !medianB.value) return 'Loading pace data...'

  const faster = fasterDriver.value
  const slower =
    faster === props.driverA.name_acronym ? props.driverB.name_acronym : props.driverA.name_acronym
  const gap = avgGapPerLap.value
  const phase = strongestPhase.value

  if (gap === '—') return 'Loading pace data...'

  const gapNum = parseFloat(gap)
  if (Number.isNaN(gapNum)) return 'Loading pace data...'

  const phaseShort = phase.replace(/^.*? in /, '')

  if (gapNum < 0.05) {
    return `${faster} and ${slower} were evenly matched on pure pace, separated by just ${gap}s per lap on average. Strategy and execution decided this one.`
  }

  if (gapNum < 0.2) {
    return `${faster} had a consistent pace edge of ${gap}s per lap over ${slower}, strongest in the ${phaseShort}. Over a full race distance that compounds to a significant gap.`
  }

  return `${faster} clearly had the quicker car, ${gap}s per lap faster than ${slower} on average. The ${phaseShort} was where the difference was most visible.`
})

const maxLap = computed(() => {
  const all = [...props.lapsA, ...props.lapsB]
  return all.length ? Math.max(...all.map(l => l.lap_number)) : 0
})

const labels = computed(() => Array.from({ length: maxLap.value }, (_, i) => String(i + 1)))

const chartData = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      label: props.driverA.name_acronym,
      data: getCleanLaps(props.lapsA),
      borderColor: props.driverA.color,
      backgroundColor: `${props.driverA.color}20`,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: props.driverA.color,
      tension: 0.2,
      spanGaps: false,
    },
    {
      label: props.driverB.name_acronym,
      data: getCleanLaps(props.lapsB),
      borderColor: props.driverB.color,
      backgroundColor: `${props.driverB.color}20`,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: props.driverB.color,
      tension: 0.2,
      spanGaps: false,
    },
  ],
}))

function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(3)
  return `${m}:${s.padStart(6, '0')}`
}

const chartOptions = computed(
  (): ChartOptions<'line'> => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    onClick: (_event, elements) => {
      if (elements?.length && elements[0]?.index != null) {
        emit('lapSelected', elements[0].index + 1)
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#888',
          boxWidth: 12,
          padding: 8,
          font: { family: 'DM Mono', size: 11 },
        },
      },
      tooltip: {
        callbacks: {
          title: items => (items.length ? `Lap ${items[0].label}` : ''),
          label: item => {
            const raw = item.raw as number | null
            if (raw === null || raw === undefined) return `${item.dataset.label}: Pit/SC`
            return `${item.dataset.label}: ${formatLapTime(raw)}`
          },
          afterBody: items => {
            if (items.length < 2) return []
            const a = items[0]
            const b = items[1]
            const ra = a.raw as number | null
            const rb = b.raw as number | null
            if (ra == null || rb == null) return []
            const delta = ra - rb
            const faster = delta < 0 ? props.driverA.name_acronym : props.driverB.name_acronym
            return [`Δ ${Math.abs(delta).toFixed(3)}s — ${faster} faster`]
          },
        },
        backgroundColor: 'rgba(0,0,0,0.9)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#888',
        padding: 12,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Lap',
          color: '#555',
          font: { size: 11 },
        },
        ticks: { color: '#555', font: { family: 'DM Mono', size: 10 }, maxTicksLimit: 8 },
        grid: { color: 'rgba(255,255,255,0.04)' },
      },
      y: {
        reverse: true,
        title: {
          display: true,
          text: 'Lap Time',
          color: '#555',
          font: { size: 11 },
        },
        ticks: {
          color: '#555',
          font: { family: 'DM Mono', size: 10 },
          maxTicksLimit: 8,
          callback: (value: string | number) => {
            if (typeof value === 'number') return formatLapTime(value)
            const n = parseFloat(value)
            return Number.isFinite(n) ? formatLapTime(n) : String(value)
          },
        },
        grid: { color: 'rgba(255,255,255,0.04)' },
      },
    },
  })
)
</script>

<template>
  <div class="race-pace-comparison glass-card">
    <div class="rpc-verdict">
      <div class="rpc-verdict-header">
        <span class="rpc-verdict-icon">🏁</span>
        <h3 class="rpc-verdict-title">Race Pace Summary</h3>
      </div>
      <p class="rpc-verdict-text">{{ verdictText }}</p>

      <div class="rpc-stats-row">
        <div class="rpc-stat">
          <span class="rpc-stat-label">Faster Driver</span>
          <span class="rpc-stat-value" :style="{ color: fasterDriverColor }">{{ fasterDriver }}</span>
        </div>
        <div class="rpc-stat">
          <span class="rpc-stat-label">Avg Gap / Lap</span>
          <span class="rpc-stat-value">{{ avgGapPerLap }}s</span>
        </div>
        <div class="rpc-stat">
          <span class="rpc-stat-label">Laps Faster</span>
          <span class="rpc-stat-value">
            {{ fasterDriver }} on {{ lapsAheadStats.count }} / {{ lapsAheadStats.total || '—' }}
          </span>
        </div>
        <div class="rpc-stat">
          <span class="rpc-stat-label">Strongest Phase</span>
          <span class="rpc-stat-value">{{ strongestPhase }}</span>
        </div>
      </div>
    </div>

    <div class="rpc-divider" />

    <div class="rpc-chart-section">
      <p class="rpc-chart-label">
        Lap-by-lap times - gaps show pit stops or safety car periods
      </p>
      <div class="rpc-chart-wrap">
        <Line :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <div class="rpc-divider" />

    <div class="rpc-deepdive-invite">
      <div class="rpc-invite-text">
        <span class="rpc-invite-icon">🔍</span>
        <div>
          <p class="rpc-invite-headline">Want to know exactly where the gap came from?</p>
          <p class="rpc-invite-sub">
            Click any lap on the chart above, or enter a lap number below to see speed, throttle, braking,
            and gear traces side by side.
          </p>
        </div>
      </div>
      <div v-if="selectedLap" class="rpc-selected-lap-badge">Lap {{ selectedLap }} selected ↓</div>
    </div>
  </div>
</template>

<style scoped>
.race-pace-comparison {
  padding: 24px;
  margin-bottom: 20px;
}

.rpc-verdict {
  margin-bottom: 24px;
}

.rpc-verdict-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.rpc-verdict-icon {
  font-size: 20px;
}

.rpc-verdict-title {
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  font-family: 'Titillium Web', sans-serif;
}

.rpc-verdict-text {
  font-size: 16px;
  color: #ccc;
  line-height: 1.6;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.03);
  border-left: 3px solid #e8002d;
  border-radius: 0 8px 8px 0;
}

.rpc-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 900px) {
  .rpc-stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

.rpc-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.rpc-stat-label {
  font-size: 10px;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 700;
}

.rpc-stat-value {
  font-size: 14px;
  font-weight: 800;
  color: #fff;
  font-family: 'DM Mono', monospace;
  line-height: 1.3;
}

.rpc-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 24px 0;
}

.rpc-chart-label {
  font-size: 12px;
  color: #555;
  margin-bottom: 12px;
}

.rpc-chart-wrap {
  height: 220px;
  cursor: crosshair;
}

.rpc-deepdive-invite {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.rpc-invite-text {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 200px;
}

.rpc-invite-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.rpc-invite-headline {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 4px;
}

.rpc-invite-sub {
  font-size: 13px;
  color: #555;
  line-height: 1.5;
  margin: 0;
}

.rpc-selected-lap-badge {
  flex-shrink: 0;
  padding: 8px 16px;
  background: rgba(232, 0, 45, 0.12);
  border: 1px solid rgba(232, 0, 45, 0.3);
  border-radius: 20px;
  color: #e8002d;
  font-size: 13px;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .rpc-stats-row {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .rpc-stat {
    padding: 10px 12px;
  }

  .rpc-stat-value {
    font-size: 14px;
  }

  .rpc-deepdive-invite {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .rpc-chart-wrap {
    height: 180px;
  }
}

@media (min-width: 1280px) {
  .rpc-chart-wrap {
    height: 320px;
  }
}

@media (min-width: 1600px) {
  .rpc-chart-wrap {
    height: 380px;
  }
}
</style>
