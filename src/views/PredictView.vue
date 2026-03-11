<template>
  <div class="predict-view">
    <div class="container">
      <div class="page-header">
        <div class="page-badge">EXPERIMENTAL</div>
        <h1 class="page-title">Race Predictor</h1>
        <p class="page-desc">
          Rule-based prediction using historical F1 patterns. Not real-time telemetry.
        </p>
      </div>

      <div class="predict-layout">
        <!-- Inputs Panel -->
        <div class="inputs-panel glass-card">
          <div class="panel-title">Configure Race Scenario</div>

          <!-- Circuit Selector -->
          <div class="input-group">
            <label class="input-label">Circuit</label>
            <select v-model="selectedCircuit" class="input-select">
              <option value="">Select circuit...</option>
              <option v-for="race in seasonStore.schedule" :key="race.round" :value="race.Circuit.circuitId">
                {{ getCircuitFlag(race.Circuit.Location.country) }} {{ race.raceName.replace(' Grand Prix', ' GP') }}
              </option>
            </select>
          </div>

          <!-- Grid Positions -->
          <div class="input-group">
            <label class="input-label">Starting Grid (Top 5)</label>
            <div class="grid-inputs">
              <div v-for="pos in 5" :key="pos" class="grid-row">
                <span class="grid-pos font-data">P{{ pos }}</span>
                <select v-model="gridPositions[pos - 1]" class="input-select-sm">
                  <option value="">Select driver</option>
                  <option
                    v-for="s in seasonStore.driverStandings"
                    :key="s.Driver.driverId"
                    :value="s.Driver.driverId"
                  >
                    {{ s.Driver.code }} — {{ s.Driver.familyName }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- Weather -->
          <div class="input-group">
            <label class="input-label">Weather Conditions</label>
            <div class="toggle-group">
              <button
                class="toggle-btn"
                :class="{ active: weather === 'dry' }"
                @click="weather = 'dry'"
              >☀️ Dry</button>
              <button
                class="toggle-btn"
                :class="{ active: weather === 'wet' }"
                @click="weather = 'wet'"
              >🌧️ Wet</button>
            </div>
          </div>

          <!-- Tyre Strategy -->
          <div class="input-group">
            <label class="input-label">Expected Strategy</label>
            <div class="toggle-group">
              <button
                v-for="strat in strategies"
                :key="strat.id"
                class="toggle-btn"
                :class="{ active: strategy === strat.id }"
                @click="strategy = strat.id"
              >
                {{ strat.label }}
              </button>
            </div>
          </div>

          <!-- High Degradation -->
          <div class="input-group">
            <label class="input-label">Circuit Degradation</label>
            <div class="toggle-group">
              <button
                class="toggle-btn"
                :class="{ active: highDeg === false }"
                @click="highDeg = false"
              >Low</button>
              <button
                class="toggle-btn"
                :class="{ active: highDeg === true }"
                @click="highDeg = true"
              >High</button>
            </div>
          </div>

          <button class="predict-btn" @click="runPrediction" :disabled="!canPredict">
            Generate Prediction →
          </button>
        </div>

        <!-- Results Panel -->
        <div class="results-panel">
          <div v-if="!predictionResult" class="placeholder-card glass-card">
            <div class="placeholder-icon">🏎️</div>
            <p>Configure the race scenario and click "Generate Prediction" to see the results.</p>
          </div>

          <div v-else>
            <!-- Predicted Podium -->
            <div class="glass-card result-card">
              <div class="result-header">
                <div class="result-title">Predicted Podium</div>
                <div class="confidence-badge">{{ predictionResult.confidence }}% Confidence</div>
              </div>

              <div class="podium-result">
                <div
                  v-for="(driver, i) in predictionResult.podium"
                  :key="driver.driverId"
                  class="podium-pos-item"
                >
                  <span class="podium-badge" :class="`pos-${i + 1}`">{{ i + 1 }}</span>
                  <div class="podium-driver-info">
                    <div class="podium-driver-name">
                      <span class="font-data" :style="{ color: getTeamColor(driver.team) }">
                        {{ driver.code }}
                      </span>
                      {{ driver.name }}
                    </div>
                    <div class="podium-driver-team" :style="{ color: getTeamColor(driver.team) }">
                      {{ driver.team }}
                    </div>
                  </div>
                  <div class="podium-prob font-data">{{ driver.probability }}%</div>
                </div>
              </div>
            </div>

            <!-- Risk Factors -->
            <div class="glass-card result-card">
              <div class="result-title">Key Risk Factors</div>
              <div class="risk-list">
                <div v-for="risk in predictionResult.risks" :key="risk" class="risk-item">
                  <span class="risk-dot"></span>
                  {{ risk }}
                </div>
              </div>
            </div>

            <!-- Strategy Recommendation -->
            <div class="glass-card result-card strategy-rec">
              <div class="rec-icon">💡</div>
              <div>
                <div class="result-title">Strategy Recommendation</div>
                <p class="rec-text">{{ predictionResult.strategyRec }}</p>
              </div>
            </div>

            <!-- Disclaimer -->
            <p class="disclaimer">
              ⚠️ Simplified prediction based on historical patterns, not real-time telemetry.
              Actual results may vary significantly.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSeasonStore } from '@/stores/seasonStore'
import { getTeamColor, getCircuitFlag } from '@/constants/teams'

const seasonStore = useSeasonStore()

const selectedCircuit = ref('')
const gridPositions = ref<string[]>(['', '', '', '', ''])
const weather = ref<'dry' | 'wet'>('dry')
const strategy = ref('one-stop')
const highDeg = ref(false)

const strategies = [
  { id: 'one-stop', label: '1-Stop' },
  { id: 'two-stop', label: '2-Stop' },
  { id: 'soft-start', label: 'Soft Start' },
]

interface PredictionResult {
  podium: Array<{
    driverId: string
    code: string
    name: string
    team: string
    probability: number
  }>
  confidence: number
  risks: string[]
  strategyRec: string
}

const predictionResult = ref<PredictionResult | null>(null)

const canPredict = computed(() =>
  selectedCircuit.value !== '' && gridPositions.value[0] !== ''
)

function getDriverStanding(driverId: string) {
  return seasonStore.driverStandings.find(s => s.Driver.driverId === driverId)
}

function runPrediction() {
  // Build predicted order based on rules
  const selectedDriverIds = gridPositions.value.filter(Boolean)
  if (!selectedDriverIds.length) return

  const driverEntries = selectedDriverIds.map((id, gridIndex) => {
    const standing = getDriverStanding(id)
    if (!standing) return null

    // Base score: championship position (inverted)
    const champPos = parseInt(standing.position)
    let score = 100 - champPos * 2

    // Rule: From P1, win X% — slight bonus for pole
    if (gridIndex === 0) score += 15
    if (gridIndex === 1) score += 8
    if (gridIndex === 2) score += 4

    // Wet conditions: DNF probability increases, underdogs benefit
    if (weather.value === 'wet') {
      score += Math.random() * 10 - 5 // +/- chaos
    }

    // Soft starters fall back ~2 positions on average (penalize front runners on soft)
    if (strategy.value === 'soft-start' && gridIndex < 3) {
      score -= 6
    }

    // Two-stop gains ~1.5 positions on high-deg circuits
    if (strategy.value === 'two-stop' && highDeg.value) {
      score += 5
    }

    // Points leader bonus (usually fastest car)
    if (champPos <= 3) score += 5

    return {
      driverId: id,
      code: standing.Driver.code,
      name: `${standing.Driver.givenName} ${standing.Driver.familyName}`,
      team: standing.Constructors[0]?.name || '',
      score,
    }
  }).filter((d): d is NonNullable<typeof d> => d !== null)

  driverEntries.sort((a, b) => b.score - a.score)

  // Normalize to probabilities
  const totalScore = driverEntries.reduce((sum, d) => sum + Math.max(d.score, 1), 0)
  const podium = driverEntries.slice(0, 3).map(d => ({
    ...d,
    probability: Math.round((Math.max(d.score, 1) / totalScore) * 100),
  }))

  // Build risks
  const risks: string[] = []
  if (weather.value === 'wet') risks.push('Wet conditions increase DNF probability by ~40% across the field')
  if (strategy.value === 'soft-start') risks.push('Soft starters typically lose 2+ positions by lap 20 due to degradation')
  if (strategy.value === 'two-stop' && !highDeg.value) risks.push('Two-stop strategy may cost time on low-degradation circuits')
  if (highDeg.value) risks.push('High tyre degradation circuit — undercut opportunities will be frequent')
  if (parseInt(driverEntries[0]?.score?.toString() || '0') - parseInt(driverEntries[1]?.score?.toString() || '0') < 5) {
    risks.push('Very competitive predicted battle for P1 — minor incident could shuffle the order')
  }

  if (risks.length === 0) risks.push('Conditions look standard — expect a conventional race pace battle')

  // Strategy recommendation
  let strategyRec = ''
  if (highDeg.value) {
    strategyRec = 'On high-degradation circuits, a two-stop strategy with medium-hard compounds typically yields the best race pace. Undercutting the leader on lap 20–25 is the optimal window.'
  } else if (weather.value === 'wet') {
    strategyRec = 'In wet conditions, slick tyre timing is critical. A team that reads the track drying window first gains 3–8 positions on average. Stay alert around lap 15–25.'
  } else if (strategy.value === 'soft-start') {
    strategyRec = 'Drivers starting on softs should push hard in the opening stint (laps 1–18) to build gap, then switch to hard/medium to manage the race.'
  } else {
    strategyRec = 'A standard one-stop strategy (medium → hard) looks optimal for this circuit. The safety car window around lap 25–35 is the key strategic pivot point to watch.'
  }

  predictionResult.value = {
    podium,
    confidence: weather.value === 'wet' ? 45 : highDeg.value ? 62 : 71,
    risks,
    strategyRec,
  }
}

onMounted(() => {
  if (!seasonStore.schedule.length) {
    seasonStore.loadCurrentSeason()
  }
})
</script>

<style scoped>
.predict-view {
  padding-bottom: 4rem;
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.page-header {
  padding: 2.5rem 0 2rem;
}

.page-badge {
  display: inline-flex;
  padding: 0.2rem 0.625rem;
  border: 1px solid rgba(255, 193, 7, 0.4);
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #FFC107;
  margin-bottom: 0.75rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  margin-bottom: 0.5rem;
}

.page-desc {
  font-size: 0.875rem;
  color: #666;
}

.predict-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 1.5rem;
  align-items: start;
}

/* Inputs Panel */
.inputs-panel {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.panel-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #555;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #666;
}

.input-select {
  padding: 0.625rem 0.875rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #fff;
  font-family: 'Titillium Web', sans-serif;
  font-size: 0.875rem;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
}

.input-select:focus {
  border-color: rgba(255,255,255,0.2);
}

.input-select option {
  background: #1a1a1a;
}

.input-select-sm {
  padding: 0.375rem 0.625rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  color: #fff;
  font-size: 0.8rem;
  cursor: pointer;
  outline: none;
  flex: 1;
}

.input-select-sm option {
  background: #1a1a1a;
}

.grid-inputs {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.grid-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.grid-pos {
  font-size: 0.75rem;
  font-weight: 700;
  color: #555;
  min-width: 24px;
  letter-spacing: 0.04em;
}

.toggle-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.toggle-btn {
  padding: 0.4rem 0.875rem;
  border-radius: 6px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  color: #888;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-btn:hover {
  border-color: rgba(255,255,255,0.2);
  color: #fff;
}

.toggle-btn.active {
  background: rgba(232, 0, 45, 0.15);
  border-color: rgba(232, 0, 45, 0.4);
  color: #E8002D;
}

.predict-btn {
  padding: 0.875rem;
  background: #E8002D;
  color: #fff;
  font-weight: 700;
  border-radius: 8px;
  border: none;
  font-size: 0.875rem;
  cursor: pointer;
  letter-spacing: 0.04em;
  transition: opacity 0.15s, transform 0.15s;
  font-family: 'Titillium Web', sans-serif;
}

.predict-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.predict-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Results Panel */
.placeholder-card {
  padding: 3rem 2rem;
  text-align: center;
  color: #555;
}

.placeholder-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.result-card {
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.result-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #555;
  margin-bottom: 1rem;
}

.confidence-badge {
  font-size: 0.75rem;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  background: rgba(39, 244, 210, 0.1);
  border: 1px solid rgba(39, 244, 210, 0.3);
  color: #27F4D2;
  padding: 0.2rem 0.625rem;
  border-radius: 4px;
}

/* Predicted Podium */
.podium-result {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.podium-pos-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.podium-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  font-family: 'DM Mono', monospace;
  flex-shrink: 0;
}

.pos-1 { background: #FFD700; color: #000; }
.pos-2 { background: #C0C0C0; color: #000; }
.pos-3 { background: #CD7F32; color: #000; }

.podium-driver-info {
  flex: 1;
}

.podium-driver-name {
  font-size: 0.95rem;
  font-weight: 600;
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
}

.podium-driver-team {
  font-size: 0.75rem;
  margin-top: 0.1rem;
}

.podium-prob {
  font-size: 1rem;
  font-weight: 700;
  color: #27F4D2;
}

/* Risks */
.risk-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.risk-item {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  font-size: 0.875rem;
  color: #ccc;
  line-height: 1.5;
}

.risk-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #FFC107;
  flex-shrink: 0;
  margin-top: 0.45rem;
}

/* Strategy rec */
.strategy-rec {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.rec-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.rec-text {
  font-size: 0.875rem;
  color: #ccc;
  line-height: 1.6;
  margin: 0;
  margin-top: 0.5rem;
}

.disclaimer {
  font-size: 0.75rem;
  color: #444;
  line-height: 1.5;
  padding: 1rem;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 8px;
}

@media (max-width: 900px) {
  .predict-layout {
    grid-template-columns: 1fr;
  }
}
</style>
