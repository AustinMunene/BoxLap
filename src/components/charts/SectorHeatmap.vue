<!--
  SectorHeatmap.vue

  Sector time heatmap for a race session.
  Each row is a driver, each column is a sector (S1/S2/S3).
  Cell color reflects relative speed for that sector (faster = brighter).
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Lap } from '@/api/openf1'
import type { ErgastRaceResult } from '@/api/ergast'

const props = defineProps<{
  /**
   * Race results (Ergast) used to drive ordering and driver codes.
   *
   * Data source: Ergast race results (see `src/api/ergast.ts`).
   */
  results: ErgastRaceResult[]
  /**
   * Laps keyed by driver permanent number.
   *
   * Data source: OpenF1 `/laps` (loaded into store and exposed by `useRaceData`).
   */
  lapsByDriver: Record<number, Lap[]>
}>()

type SectorKey = 'duration_sector_1' | 'duration_sector_2' | 'duration_sector_3'

/**
 * Computes the median of a numeric array.
 *
 * Returns: 0 when array is empty, otherwise median value.
 */
function median(vals: number[]): number {
  if (vals.length === 0) return 0
  const sorted = [...vals].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Converts a sector time in seconds into a background color.
 *
 * Why: we want a quick fan-friendly "fast vs slow" cue without introducing
 * a full chart dependency for a 3-column grid.
 *
 * Returns: `rgba(...)` string.
 */
function sectorColor(value: number, min: number, max: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'rgba(255,255,255,0.04)'
  if (max <= min) return 'rgba(232, 0, 45, 0.16)'

  // Non-obvious transform:
  // Normalize so fastest sector (min) becomes 1.0 intensity and slowest (max) becomes 0.0.
  const t = 1 - (value - min) / (max - min)
  const alpha = 0.08 + 0.22 * Math.max(0, Math.min(1, t))
  return `rgba(232, 0, 45, ${alpha.toFixed(3)})`
}

const rows = computed(() => {
  const sectorKeys: SectorKey[] = ['duration_sector_1', 'duration_sector_2', 'duration_sector_3']

  const out: Array<{
    code: string
    sectors: Record<SectorKey, number>
  }> = []

  for (const r of props.results) {
    const driverNum = parseInt(r.Driver.permanentNumber)
    const laps = props.lapsByDriver[driverNum] || []

    // Collect sector times for each sector from valid, non-pit-out laps only.
    const sectorValues: Record<SectorKey, number[]> = {
      duration_sector_1: [],
      duration_sector_2: [],
      duration_sector_3: [],
    }

    for (const lap of laps) {
      if (lap.is_pit_out_lap) continue
      for (const key of sectorKeys) {
        const v = lap[key]
        if (typeof v === 'number' && v > 0) sectorValues[key].push(v)
      }
    }

    out.push({
      code: r.Driver.code,
      sectors: {
        duration_sector_1: median(sectorValues.duration_sector_1),
        duration_sector_2: median(sectorValues.duration_sector_2),
        duration_sector_3: median(sectorValues.duration_sector_3),
      },
    })
  }

  return out
})

const sectorMinMax = computed(() => {
  const keys: SectorKey[] = ['duration_sector_1', 'duration_sector_2', 'duration_sector_3']
  const min: Record<SectorKey, number> = {
    duration_sector_1: Infinity,
    duration_sector_2: Infinity,
    duration_sector_3: Infinity,
  }
  const max: Record<SectorKey, number> = {
    duration_sector_1: -Infinity,
    duration_sector_2: -Infinity,
    duration_sector_3: -Infinity,
  }

  for (const row of rows.value) {
    for (const k of keys) {
      const v = row.sectors[k]
      if (!Number.isFinite(v) || v <= 0) continue
      if (v < min[k]) min[k] = v
      if (v > max[k]) max[k] = v
    }
  }

  // Normalize missing min/max.
  for (const k of keys) {
    if (!Number.isFinite(min[k])) min[k] = 0
    if (!Number.isFinite(max[k])) max[k] = 0
  }

  return { min, max }
})
</script>

<template>
  <div class="chart-scroll-wrap">
  <div class="heatmap">
    <div class="head">
      <div class="cell head-cell driver">Driver</div>
      <div class="cell head-cell">S1</div>
      <div class="cell head-cell">S2</div>
      <div class="cell head-cell">S3</div>
    </div>

    <div v-for="row in rows" :key="row.code" class="r">
      <div class="cell driver font-data">{{ row.code }}</div>
      <div
        class="cell sector font-data"
        :style="{ background: sectorColor(row.sectors.duration_sector_1, sectorMinMax.min.duration_sector_1, sectorMinMax.max.duration_sector_1) }"
      >
        {{ row.sectors.duration_sector_1 ? row.sectors.duration_sector_1.toFixed(2) : '-' }}
      </div>
      <div
        class="cell sector font-data"
        :style="{ background: sectorColor(row.sectors.duration_sector_2, sectorMinMax.min.duration_sector_2, sectorMinMax.max.duration_sector_2) }"
      >
        {{ row.sectors.duration_sector_2 ? row.sectors.duration_sector_2.toFixed(2) : '-' }}
      </div>
      <div
        class="cell sector font-data"
        :style="{ background: sectorColor(row.sectors.duration_sector_3, sectorMinMax.min.duration_sector_3, sectorMinMax.max.duration_sector_3) }"
      >
        {{ row.sectors.duration_sector_3 ? row.sectors.duration_sector_3.toFixed(2) : '-' }}
      </div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.heatmap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.head,
.r {
  display: grid;
  grid-template-columns: 88px 1fr 1fr 1fr;
  gap: 6px;
}

.cell {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 10px 10px;
  font-size: 0.82rem;
  color: #d1d5db;
}

.head-cell {
  color: #aaa;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.02);
}

.driver {
  text-align: left;
}

.sector {
  text-align: center;
}

@media (max-width: 520px) {
  .head,
  .r {
    grid-template-columns: 64px 1fr 1fr 1fr;
  }
  .cell {
    padding: 8px 8px;
    font-size: 0.78rem;
  }
}
</style>

