<template>
  <div class="table-wrapper">
    <table class="race-table">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Driver</th>
          <th>Team</th>
          <th>Grid</th>
          <th>Laps</th>
          <th>Time / Status</th>
          <th>Pts</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="result in results" :key="result.Driver.driverId" class="result-row">
          <td>
            <span class="pos-badge" :class="posBadgeClass(result.position)">
              {{ result.position }}
            </span>
          </td>
          <td>
            <div class="driver-cell">
              <div class="team-strip" :style="{ background: getTeamColor(result.Constructor.name) }"></div>
              <div>
                <div class="driver-name">
                  <span class="driver-code">{{ result.Driver.code }}</span>
                  <span class="driver-fullname">{{ result.Driver.givenName }} {{ result.Driver.familyName }}</span>
                </div>
              </div>
            </div>
          </td>
          <td>
            <span class="team-name" :style="{ color: getTeamColor(result.Constructor.name) }">
              {{ result.Constructor.name }}
            </span>
          </td>
          <td class="font-data text-f1-muted">{{ result.grid === '0' ? 'PL' : result.grid }}</td>
          <td class="font-data text-f1-muted">{{ result.laps }}</td>
          <td class="font-data">
            <span v-if="result.Time" class="lap-time">{{ result.Time.time }}</span>
            <span v-else class="status" :class="{ dnf: isDNF(result.status) }">{{ result.status }}</span>
          </td>
          <td class="font-data points">{{ result.points }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { getTeamColor } from '@/constants/teams'
import type { ErgastRaceResult } from '@/api/ergast'

defineProps<{
  results: ErgastRaceResult[]
}>()

function posBadgeClass(pos: string) {
  const n = parseInt(pos)
  if (n === 1) return 'pos-1'
  if (n === 2) return 'pos-2'
  if (n === 3) return 'pos-3'
  return 'pos-default'
}

function isDNF(status: string) {
  return !['Finished', '+1 Lap', '+2 Laps', '+3 Laps'].includes(status)
}
</script>

<style scoped>
.table-wrapper {
  overflow-x: auto;
}

.race-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

thead tr {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #666;
}

.result-row {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.15s;
}

.result-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

td {
  padding: 0.75rem 1rem;
  vertical-align: middle;
}

.driver-cell {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.team-strip {
  width: 3px;
  height: 28px;
  border-radius: 2px;
  flex-shrink: 0;
}

.driver-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.driver-code {
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  font-size: 0.875rem;
  color: #fff;
  letter-spacing: 0.05em;
}

.driver-fullname {
  color: #888;
  font-size: 0.8rem;
}

.team-name {
  font-size: 0.8rem;
  font-weight: 600;
}

.lap-time {
  font-family: 'DM Mono', monospace;
  color: #ccc;
}

.status {
  font-size: 0.8rem;
  color: #888;
}

.status.dnf {
  color: #E8002D;
}

.points {
  color: #FFC906;
  font-weight: 600;
}
</style>
