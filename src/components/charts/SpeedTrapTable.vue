<!--
  SpeedTrapTable.vue (Breakdown)

  Ranked table of each driver's top speed recorded during the race.

  Data source: OpenF1 `/laps`
  Field used: `st_speed` (speed trap speed in km/h)
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Lap } from '@/api/openf1'
import type { ErgastRaceResult } from '@/api/ergast'
import DriverBadge from '@/components/ui/DriverBadge.vue'
import { getTeamColor } from '@/constants/teams'

const props = defineProps<{
  /**
   * Race results used to map driver codes/teams and set stable ordering.
   *
   * Data source: Ergast race results.
   */
  results: ErgastRaceResult[]
  /**
   * Laps keyed by driver permanent number.
   *
   * Data source: OpenF1 `/laps`.
   */
  lapsByDriver: Record<number, Lap[]>
}>()

type Row = {
  pos: number
  code: string
  name: string
  team: string
  headshotUrl?: string
  topSpeed: number
  lap: number
  vsFastest: number | null
  teamColor: string
}

/**
 * Finds each driver's maximum `st_speed` and the lap it occurred on.
 *
 * Returns: Sorted rows (fastest first).
 */
const rows = computed<Row[]>(() => {
  const out: Array<Omit<Row, 'pos' | 'vsFastest'>> = []

  for (const r of props.results) {
    const driverNum = parseInt(r.Driver.permanentNumber)
    const laps = props.lapsByDriver[driverNum] || []

    let bestSpeed = -Infinity
    let bestLap = -1

    for (const lap of laps) {
      // OpenF1 `/laps` provides st_speed per lap, or null when missing.
      const sp = (lap as unknown as { st_speed?: number | null }).st_speed ?? null
      if (typeof sp !== 'number' || !Number.isFinite(sp)) continue
      if (sp > bestSpeed) {
        bestSpeed = sp
        bestLap = lap.lap_number
      }
    }

    if (bestSpeed === -Infinity || bestLap === -1) continue

    out.push({
      code: r.Driver.code,
      name: `${r.Driver.givenName} ${r.Driver.familyName}`,
      team: r.Constructor.name,
      headshotUrl: undefined,
      topSpeed: bestSpeed,
      lap: bestLap,
      teamColor: getTeamColor(r.Constructor.name),
    })
  }

  // Sort descending by speed.
  out.sort((a, b) => b.topSpeed - a.topSpeed)

  const fastest = out[0]?.topSpeed ?? null
  return out.map((r, idx) => ({
    ...r,
    pos: idx + 1,
    vsFastest: fastest != null ? r.topSpeed - fastest : null,
  }))
})
</script>

<template>
  <div class="table-wrap">
    <table class="w-full text-sm">
      <thead>
        <tr>
          <th class="text-left">Pos</th>
          <th class="text-left">Driver</th>
          <th class="text-left">Team</th>
          <th class="text-right">Top Speed</th>
          <th class="text-right">Lap</th>
          <th class="text-right">vs Fastest</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.code" class="row" :class="{ first: r.pos === 1 }">
          <td class="font-data">{{ r.pos }}</td>
          <td>
            <DriverBadge :code="r.code" :name="r.name" :team="r.team" :headshotUrl="r.headshotUrl" />
          </td>
          <td class="team-cell">
            <span class="team-strip" :style="{ background: r.teamColor }" />
            <span>{{ r.team }}</span>
          </td>
          <td class="text-right font-data">{{ r.topSpeed.toFixed(1) }} km/h</td>
          <td class="text-right font-data">{{ r.lap }}</td>
          <td class="text-right font-data">
            <span v-if="r.pos === 1">-</span>
            <span v-else class="delta">-{{ Math.abs(r.vsFastest ?? 0).toFixed(1) }} km/h</span>
          </td>
        </tr>
        <tr v-if="rows.length === 0">
          <td colspan="6" class="empty">No speed trap data loaded</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
}

table th {
  color: #aaa;
  font-size: 0.75rem;
  padding-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

table td {
  padding: 0.6rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  vertical-align: middle;
}

.row.first {
  border-left: 3px solid rgba(255, 215, 0, 0.8);
}

.team-cell {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.delta {
  color: #ff6b6b;
}

.empty {
  padding: 1rem 0;
  text-align: center;
  color: #777;
}
</style>

