<!--
  LapSummaryCard.vue — headline lap comparison before detailed charts.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Lap } from '@/api/openf1'

type TelemetrySample = {
  speed?: number | null
  brake?: boolean | null
  throttle?: number | null
  n_gear?: number | null
  distance_m?: number
}

const props = defineProps<{
  dataA: TelemetrySample[]
  dataB: TelemetrySample[]
  lapDataA: Lap | null
  lapDataB: Lap | null
  driverA: { name_acronym: string; team_name: string }
  driverB: { name_acronym: string; team_name: string }
  lapNumber: number
}>()

function formatLapTime(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '—'
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  return `${m}:${s.toFixed(3).padStart(6, '0')}`
}

const lapTimeDelta = computed(() => {
  const a = props.lapDataA?.lap_duration
  const b = props.lapDataB?.lap_duration
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null
  return a - b
})

const fasterDriver = computed(() => {
  const d = lapTimeDelta.value
  if (d == null) return null
  return d < 0 ? props.driverA : props.driverB
})

const s1Delta = computed(() => {
  const a = props.lapDataA?.duration_sector_1
  const b = props.lapDataB?.duration_sector_1
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null
  return a - b
})

const s2Delta = computed(() => {
  const a = props.lapDataA?.duration_sector_2
  const b = props.lapDataB?.duration_sector_2
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null
  return a - b
})

const s3Delta = computed(() => {
  const a = props.lapDataA?.duration_sector_3
  const b = props.lapDataB?.duration_sector_3
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null
  return a - b
})

const sectorChips = computed(() => [
  { label: 'S1' as const, delta: s1Delta.value },
  { label: 'S2' as const, delta: s2Delta.value },
  { label: 'S3' as const, delta: s3Delta.value },
])

const verdict = computed(() => {
  const ld = lapTimeDelta.value
  const fd = fasterDriver.value
  if (ld == null || fd == null) return null
  const deltas = [
    { sector: 'S1' as const, delta: s1Delta.value ?? 0 },
    { sector: 'S2' as const, delta: s2Delta.value ?? 0 },
    { sector: 'S3' as const, delta: s3Delta.value ?? 0 },
  ]
  const biggest = deltas.reduce((a, b) => (Math.abs(a.delta) > Math.abs(b.delta) ? a : b))
  const gainer =
    biggest.delta < 0 ? props.driverA.name_acronym : props.driverB.name_acronym
  const gap = Math.abs(ld).toFixed(3)
  const sectorGap = Math.abs(biggest.delta).toFixed(3)
  return `${fd.name_acronym} was ${gap}s faster overall. ${gainer} gained ${sectorGap}s in ${biggest.sector}`
})
</script>

<template>
  <div class="lap-summary glass-card glass-card--static">
    <div class="lap-summary-head">
      <span class="lap-summary-kicker">Lap {{ lapNumber }}</span>
      <h3 class="lap-summary-title">Lap pace summary</h3>
    </div>

    <div v-if="verdict" class="summary-verdict">
      <span class="verdict-icon">🏁</span>
      <span class="verdict-text">{{ verdict }}</span>
    </div>

    <div class="sector-row">
      <div
        v-for="chip in sectorChips"
        :key="chip.label"
        class="sector-chip"
        :class="{
          'sector-chip--a': chip.delta !== null && chip.delta < 0,
          'sector-chip--b': chip.delta !== null && chip.delta > 0,
          'sector-chip--even': chip.delta === 0,
        }"
      >
        <span class="sector-label">{{ chip.label }}</span>
        <span class="sector-winner">
          {{
            chip.delta === null
              ? '—'
              : chip.delta < 0
                ? driverA.name_acronym
                : chip.delta > 0
                  ? driverB.name_acronym
                  : 'Even'
          }}
        </span>
        <span v-if="chip.delta !== null && chip.delta !== 0" class="sector-gap">
          {{ Math.abs(chip.delta).toFixed(3) }}s
        </span>
      </div>
    </div>

    <div class="laptime-row">
      <div class="laptime-block laptime-block--a">
        <span class="laptime-driver">{{ driverA.name_acronym }}</span>
        <span class="laptime-value">{{ formatLapTime(lapDataA?.lap_duration ?? null) }}</span>
      </div>
      <div v-if="lapTimeDelta !== null" class="laptime-delta">
        {{ lapTimeDelta > 0 ? '+' : '' }}{{ lapTimeDelta.toFixed(3) }}s
      </div>
      <div class="laptime-block laptime-block--b">
        <span class="laptime-driver">{{ driverB.name_acronym }}</span>
        <span class="laptime-value">{{ formatLapTime(lapDataB?.lap_duration ?? null) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lap-summary {
  padding: 28px;
  margin-bottom: 20px;
}

.lap-summary-head {
  margin-bottom: 0.75rem;
}

.lap-summary-kicker {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #888;
  text-transform: uppercase;
}

.lap-summary-title {
  margin: 0.25rem 0 0;
  font-size: 1.1rem;
  font-weight: 800;
  color: #fff;
}

.summary-verdict {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  background: rgba(232, 0, 45, 0.06);
  border: 1px solid rgba(232, 0, 45, 0.15);
  border-radius: 12px;
  margin-bottom: 24px;
}

.verdict-icon {
  flex-shrink: 0;
  font-size: 20px;
}

.verdict-text {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  line-height: 1.5;
}

.sector-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 24px;
}

.sector-chip {
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sector-chip--a {
  border-color: rgba(54, 113, 198, 0.4);
  background: rgba(54, 113, 198, 0.06);
}

.sector-chip--b {
  border-color: rgba(232, 0, 45, 0.4);
  background: rgba(232, 0, 45, 0.06);
}

.sector-chip--even {
  opacity: 0.75;
}

.sector-label {
  font-size: 11px;
  font-weight: 700;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.sector-winner {
  font-size: 20px;
  font-weight: 900;
  color: #fff;
  font-family: 'DM Mono', monospace;
}

.sector-gap {
  font-size: 13px;
  color: #888;
  font-family: 'DM Mono', monospace;
}

.laptime-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
  padding-top: 20px;
  border-top: 1px solid var(--glass-border);
}

.laptime-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.laptime-block--a {
  align-items: flex-start;
}

.laptime-block--b {
  align-items: flex-end;
}

.laptime-driver {
  font-size: 12px;
  font-weight: 700;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.laptime-value {
  font-size: 28px;
  font-weight: 800;
  color: #fff;
  font-family: 'DM Mono', monospace;
}

.laptime-delta {
  font-size: 20px;
  font-weight: 800;
  font-family: 'DM Mono', monospace;
  color: #e8002d;
  text-align: center;
}

@media (max-width: 560px) {
  .sector-row {
    grid-template-columns: 1fr;
  }

  .laptime-row {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .laptime-block--a,
  .laptime-block--b {
    align-items: center;
  }
}
</style>
