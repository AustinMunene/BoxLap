<!--
  BrakeTrace.vue

  Brake trace visualized as filled rectangles.
  Two rows: Driver A (top) and Driver B (bottom).

  Data source: OpenF1 `/car_data` (brake boolean per sample).
-->
<script setup lang="ts">
import { computed } from 'vue'

type TelemetryPoint = { distance_m: number; brake: boolean | null }

const props = defineProps<{
  driverA: { code: string; color: string }
  driverB: { code: string; color: string }
  dataA: TelemetryPoint[]
  dataB: TelemetryPoint[]
}>()

type Segment = { start: number; end: number }

/**
 * Converts brake boolean samples to contiguous distance segments where brake is applied.
 *
 * Why: drawing a rectangle per sample would be noisy and slow; we merge adjacent
 * samples into a small number of rectangles.
 */
function brakeSegments(points: TelemetryPoint[]): Segment[] {
  const sorted = [...(points || [])].filter(p => Number.isFinite(p.distance_m)).sort((a, b) => a.distance_m - b.distance_m)
  const segs: Segment[] = []
  let cur: Segment | null = null

  for (const p of sorted) {
    if (!p.brake) {
      if (cur) {
        segs.push(cur)
        cur = null
      }
      continue
    }

    if (!cur) {
      cur = { start: p.distance_m, end: p.distance_m }
    } else {
      cur.end = p.distance_m
    }
  }

  if (cur) segs.push(cur)
  return segs
}

const segA = computed(() => brakeSegments(props.dataA))
const segB = computed(() => brakeSegments(props.dataB))

const maxDistance = computed(() => {
  const lastA = props.dataA?.[props.dataA.length - 1]?.distance_m ?? 0
  const lastB = props.dataB?.[props.dataB.length - 1]?.distance_m ?? 0
  return Math.max(lastA, lastB, 1)
})

/**
 * Maps a distance value to percentage-based left positioning for CSS.
 */
function leftPct(distance: number) {
  return `${(distance / maxDistance.value) * 100}%`
}

function widthPct(start: number, end: number) {
  return `${((end - start) / maxDistance.value) * 100}%`
}
</script>

<template>
  <div class="brake-wrap">
    <div class="row">
      <div class="label font-data">{{ driverA.code }}</div>
      <div class="lane">
        <div
          v-for="(s, i) in segA"
          :key="i"
          class="seg"
          :style="{ left: leftPct(s.start), width: widthPct(s.start, s.end), background: driverA.color }"
        />
      </div>
    </div>

    <div class="row">
      <div class="label font-data">{{ driverB.code }}</div>
      <div class="lane">
        <div
          v-for="(s, i) in segB"
          :key="i"
          class="seg"
          :style="{ left: leftPct(s.start), width: widthPct(s.start, s.end), background: driverB.color }"
        />
      </div>
    </div>

    <div v-if="(dataA?.length ?? 0) === 0 && (dataB?.length ?? 0) === 0" class="empty">
      Select drivers and lap to view braking trace
    </div>
  </div>
</template>

<style scoped>
.brake-wrap {
  position: relative;
  padding: 0.25rem 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.label {
  width: 56px;
  color: #aaa;
  font-size: 0.8rem;
  font-weight: 700;
}

.lane {
  position: relative;
  height: 26px;
  flex: 1;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  background: rgba(255,255,255,0.02);
  overflow: hidden;
}

.seg {
  position: absolute;
  top: 0;
  bottom: 0;
  opacity: 0.55;
}

.empty {
  color: #555;
  font-size: 0.875rem;
  text-align: center;
  padding: 1rem 0;
}
</style>

