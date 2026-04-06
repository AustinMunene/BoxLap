<script setup lang="ts">
import { computed } from 'vue'
import type { Lap, PitStop, RaceDriver } from '@/api/openf1'
import type { ErgastRaceResult } from '@/api/ergast'
import { getTeamColor } from '@/constants/teams'

export interface PaceEntry {
  driverNumber: number
  code: string
  team: string
  medianPace: number
  lapCount: number
}

export interface PositionDelta {
  code: string
  grid: number
  finish: number
  delta: number
  status: string
}

const props = defineProps<{
  laps: Record<number, Lap[]>
  results: ErgastRaceResult[]
  pits: PitStop[]
  drivers: RaceDriver[]
  scLaps: number[]
  winner: string
}>()

function teamColor(teamName: string): string {
  return getTeamColor(teamName) || '#888'
}

/**
 * Computes median clean lap time per driver.
 * Clean laps exclude: pit in/out laps, laps under SC/VSC,
 * and any lap where duration > median + 2.5s (outlier filter).
 */
function computePaceRanking(
  laps: Record<number, Lap[]>,
  drivers: RaceDriver[],
  scLaps: number[]
): PaceEntry[] {
  const scSet = new Set(scLaps)
  return drivers
    .map(driver => {
      const driverLaps = laps[driver.driver_number] ?? []
      const cleanLaps = driverLaps.filter(
        l =>
          l.lap_duration !== null &&
          l.lap_duration !== undefined &&
          !l.is_pit_out_lap &&
          !scSet.has(l.lap_number)
      )
      if (cleanLaps.length === 0) return null

      const times = cleanLaps.map(l => l.lap_duration as number).sort((a, b) => a - b)
      const median = times[Math.floor(times.length / 2)]

      const filteredTimes = times.filter(t => t <= median + 2.5)
      if (filteredTimes.length === 0) return null

      const finalMedian = filteredTimes[Math.floor(filteredTimes.length / 2)]

      return {
        driverNumber: driver.driver_number,
        code: driver.name_acronym,
        team: driver.team_name,
        medianPace: finalMedian,
        lapCount: filteredTimes.length,
      }
    })
    .filter((x): x is PaceEntry => x !== null)
    .sort((a, b) => a.medianPace - b.medianPace)
}

function computePositionDeltas(results: ErgastRaceResult[]): PositionDelta[] {
  return results
    .filter(r => r.grid !== '0')
    .map(r => {
      const grid = parseInt(r.grid, 10)
      const finish = parseInt(r.position, 10)
      if (!Number.isFinite(grid) || !Number.isFinite(finish)) return null
      return {
        code: r.Driver.code,
        grid,
        finish,
        delta: grid - finish,
        status: r.status,
      }
    })
    .filter((x): x is PositionDelta => x !== null)
    .sort((a, b) => b.delta - a.delta)
}

function computePitTimeLost(pits: PitStop[], driverNumbers: number[]): Record<number, number> {
  const set = new Set(driverNumbers)
  const totals: Record<number, number> = {}
  for (const pit of pits) {
    if (!set.has(pit.driver_number)) continue
    totals[pit.driver_number] = (totals[pit.driver_number] ?? 0) + (pit.pit_duration ?? 0)
  }
  return totals
}

function generateVerdict(
  paceRanking: PaceEntry[],
  winner: string,
  _pitLost: Record<number, number>
): string {
  if (!paceRanking.length) return ''

  const paceLeader = paceRanking[0]
  if (!winner) return ''

  if (paceLeader.code === winner) {
    return `${winner} had both the fastest race pace and the result to match — a complete performance.`
  }

  const winnerEntry = paceRanking.find(p => p.code === winner)
  const winnerMedian = winnerEntry?.medianPace ?? paceLeader.medianPace
  const fasterBy = winnerMedian - paceLeader.medianPace

  return `${paceLeader.code} was ${fasterBy.toFixed(3)}s/lap faster on median race pace than ${winner}, but the result didn't reflect it.`
}

function formatLapTime(sec: number): string {
  if (!Number.isFinite(sec)) return '—'
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  return `${m}:${s.toFixed(3).padStart(6, '0')}`
}

const paceRanking = computed(() =>
  computePaceRanking(props.laps, props.drivers, props.scLaps ?? [])
)

const positionDeltas = computed(() => computePositionDeltas(props.results))

const gainers = computed(() =>
  positionDeltas.value.filter(d => d.delta > 0).slice(0, 3)
)

const losers = computed(() =>
  [...positionDeltas.value].filter(d => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3)
)

const pitRanking = computed(() => {
  const nums = props.drivers.map(d => d.driver_number)
  const totals = computePitTimeLost(props.pits, nums)
  const rows = Object.entries(totals).map(([dn, totalTime]) => ({
    driverNumber: Number(dn),
    code: props.drivers.find(dr => dr.driver_number === Number(dn))?.name_acronym ?? dn,
    totalTime,
  }))
  return rows.sort((a, b) => a.totalTime - b.totalTime)
})

const pitMaxTime = computed(() => {
  const pr = pitRanking.value
  if (!pr.length) return 1
  return Math.max(...pr.map(p => p.totalTime), 0.001)
})

const pitLost = computed(() => {
  const nums = props.drivers.map(d => d.driver_number)
  return computePitTimeLost(props.pits, nums)
})

const verdict = computed(() =>
  generateVerdict(paceRanking.value, props.winner, pitLost.value)
)
</script>

<template>
  <div class="race-summary glass-card glass-card--static">
    <div v-if="verdict" class="summary-verdict-bar">
      <span class="verdict-icon">🏁</span>
      <p class="verdict-text">{{ verdict }}</p>
    </div>

    <div class="summary-columns">
      <!-- Pace -->
      <div class="summary-col">
        <h4 class="summary-col-title">Race Pace</h4>
        <p class="summary-col-sub">Median clean lap — excludes SC, pit laps</p>

        <div v-if="paceRanking.length" class="pace-list">
          <div
            v-for="(entry, i) in paceRanking.slice(0, 5)"
            :key="entry.driverNumber"
            class="pace-row"
          >
            <span class="pace-rank">{{ i + 1 }}</span>
            <div
              class="pace-team-dot"
              :style="{ background: teamColor(entry.team) }"
            />
            <span class="pace-code">{{ entry.code }}</span>
            <div class="pace-bar-track">
              <div
                class="pace-bar-fill"
                :style="{
                  width: `${100 - i * 15}%`,
                  background: teamColor(entry.team),
                  opacity: 0.6 - i * 0.08,
                }"
              />
            </div>
            <span class="pace-time">{{ formatLapTime(entry.medianPace) }}</span>
            <span v-if="i > 0" class="pace-delta">
              +{{ (entry.medianPace - paceRanking[0].medianPace).toFixed(3) }}
            </span>
            <span v-else class="pace-delta" />
          </div>
        </div>
        <p v-else class="summary-empty">No lap data loaded yet — open Pace Analysis to load laps.</p>
      </div>

      <!-- Movers -->
      <div class="summary-col">
        <h4 class="summary-col-title">Position Changes</h4>
        <p class="summary-col-sub">Grid vs finish — who moved through the field</p>

        <div class="movers-list">
          <div class="movers-group">
            <span class="movers-group-label">Biggest Gainers</span>
            <div
              v-for="entry in gainers"
              :key="entry.code"
              class="mover-row"
            >
              <span class="mover-code">{{ entry.code }}</span>
              <div class="mover-bar-track">
                <div
                  class="mover-bar-fill mover-bar-fill--gain"
                  :style="{ width: `${Math.min(entry.delta * 12, 100)}%` }"
                />
              </div>
              <span class="mover-delta mover-delta--gain">+{{ entry.delta }}</span>
            </div>
            <p v-if="!gainers.length" class="summary-empty-inline">—</p>
          </div>

          <div class="movers-group">
            <span class="movers-group-label">Biggest Losers</span>
            <div
              v-for="entry in losers"
              :key="entry.code"
              class="mover-row"
            >
              <span class="mover-code">{{ entry.code }}</span>
              <div class="mover-bar-track">
                <div
                  class="mover-bar-fill mover-bar-fill--loss"
                  :style="{ width: `${Math.min(Math.abs(entry.delta) * 12, 100)}%` }"
                />
              </div>
              <span class="mover-delta mover-delta--loss">{{ entry.delta }}</span>
            </div>
            <p v-if="!losers.length" class="summary-empty-inline">—</p>
          </div>
        </div>
      </div>

      <!-- Pits -->
      <div class="summary-col">
        <h4 class="summary-col-title">Pit Performance</h4>
        <p class="summary-col-sub">Total time lost in pit stops</p>

        <div v-if="pitRanking.length" class="pit-list">
          <div
            v-for="(entry, i) in pitRanking.slice(0, 6)"
            :key="entry.driverNumber"
            class="pit-row"
          >
            <span class="pit-code">{{ entry.code }}</span>
            <div class="pit-bar-track">
              <div
                class="pit-bar-fill"
                :style="{
                  width: `${(entry.totalTime / pitMaxTime) * 100}%`,
                  background: i === 0 ? '#00C853' : '#444',
                }"
              />
            </div>
            <span class="pit-time">{{ entry.totalTime.toFixed(1) }}s</span>
          </div>
        </div>
        <p v-else class="summary-empty">No pit stop data for this session.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.race-summary {
  padding: 28px;
  margin-bottom: 28px;
}

.summary-verdict-bar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 20px;
  background: rgba(232, 0, 45, 0.06);
  border: 1px solid rgba(232, 0, 45, 0.15);
  border-radius: 12px;
  margin-bottom: 28px;
}

.verdict-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 1px;
}

.verdict-text {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  line-height: 1.5;
  margin: 0;
}

.summary-empty,
.summary-empty-inline {
  font-size: 12px;
  color: #555;
  margin: 0;
}

.summary-empty-inline {
  margin-top: 4px;
}

.summary-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
}

.summary-col-title {
  font-size: 14px;
  font-weight: 800;
  color: #fff;
  margin-bottom: 4px;
  font-family: 'Titillium Web', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-col-sub {
  font-size: 11px;
  color: #555;
  margin-bottom: 20px;
}

.pace-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pace-row {
  display: grid;
  grid-template-columns: 18px 8px 36px 1fr 70px 54px;
  align-items: center;
  gap: 8px;
}

.pace-rank {
  font-size: 11px;
  color: #444;
  font-weight: 700;
}

.pace-team-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pace-code {
  font-size: 12px;
  font-weight: 700;
  color: #ccc;
  font-family: 'DM Mono', monospace;
}

.pace-bar-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  overflow: hidden;
}

.pace-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.pace-time {
  font-size: 12px;
  font-family: 'DM Mono', monospace;
  color: #888;
  text-align: right;
}

.pace-delta {
  font-size: 11px;
  font-family: 'DM Mono', monospace;
  color: #e8002d;
  text-align: right;
}

.movers-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.movers-group-label {
  font-size: 10px;
  font-weight: 700;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 1px;
  display: block;
  margin-bottom: 8px;
}

.mover-row {
  display: grid;
  grid-template-columns: 36px 1fr 36px;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.mover-code {
  font-size: 12px;
  font-weight: 700;
  color: #ccc;
  font-family: 'DM Mono', monospace;
}

.mover-bar-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  overflow: hidden;
}

.mover-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.mover-bar-fill--gain {
  background: #00c853;
}

.mover-bar-fill--loss {
  background: #e8002d;
}

.mover-delta {
  font-size: 12px;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  text-align: right;
}

.mover-delta--gain {
  color: #00c853;
}

.mover-delta--loss {
  color: #e8002d;
}

.pit-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pit-row {
  display: grid;
  grid-template-columns: 36px 1fr 48px;
  align-items: center;
  gap: 10px;
}

.pit-code {
  font-size: 12px;
  font-weight: 700;
  color: #ccc;
  font-family: 'DM Mono', monospace;
}

.pit-bar-track {
  height: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  overflow: hidden;
}

.pit-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.pit-time {
  font-size: 12px;
  font-family: 'DM Mono', monospace;
  color: #888;
  text-align: right;
}

@media (max-width: 900px) {
  .summary-columns {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
</style>
