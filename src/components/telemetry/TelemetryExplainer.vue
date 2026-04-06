<!--
  TelemetryExplainer.vue

  Calls the backend /api/generateTelemetryExplainer endpoint and shows
  a plain-English explanation of the telemetry deltas.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'

const props = defineProps<{
  payload: {
    driverA: { code: string; team: string }
    driverB: { code: string; team: string }
    lap: number
    season: number
    round: number
    raceName: string
    circuitName: string
    country: string
    location: string
    weatherSummary: string
    championshipStandingsSummary: string
    topSpeedDelta: number
    topSpeedAdvantage: string
    brakePointDelta: number
    earlierBraker: string
    throttleApplicationDelta: number
    earlierThrottler: string
    gearChangesA: number
    gearChangesB: number
  } | null
}>()

const loading = ref(false)
const error = ref('')
const text = ref('')

/** Prevents overlapping API calls while a debounced run is still in flight. */
const inFlight = ref(false)

let explainerTimer: ReturnType<typeof setTimeout> | null = null

const cacheKey = computed(() => {
  if (!props.payload) return ''
  const p = props.payload
  return `pitwall_telemetry_explainer_${p.season}_${p.round}_${p.driverA.code}_${p.driverB.code}_${p.lap}_${p.raceName}`
})

/**
 * Loads the Claude explanation, using sessionStorage cache when possible.
 *
 * Data source: `/api/generateTelemetryExplainer` (backend).
 */
async function load() {
  if (!props.payload) return
  if (!cacheKey.value) return

  const cached = sessionStorage.getItem(cacheKey.value)
  if (cached) {
    text.value = cached
    error.value = ''
    return
  }

  if (inFlight.value) return
  inFlight.value = true

  loading.value = true
  error.value = ''
  text.value = ''

  try {
    const res = await fetch('/api/generateTelemetryExplainer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(props.payload),
    })

    const json = (await res.json().catch(() => null)) as {
      text?: string
      error?: string
      code?: string
      retryAfter?: number
    } | null
    if (!res.ok) {
      const msg =
        typeof json?.error === 'string'
          ? json.error
          : 'Could not generate telemetry explanation right now.'
      error.value =
        res.status === 429 && json?.retryAfter != null
          ? `${msg} Try again in ~${json.retryAfter}s.`
          : msg
      return
    }
    const t = String(json?.text ?? '').trim()
    if (!t) throw new Error('Empty response')

    text.value = t
    sessionStorage.setItem(cacheKey.value, t)
  } catch (e) {
    console.error('[TelemetryExplainer] load failed', e)
    error.value = 'Could not generate telemetry explanation right now.'
  } finally {
    loading.value = false
    inFlight.value = false
  }
}

/**
 * Debounced by 800ms so rapid reactive updates during telemetry load
 * do not each trigger a separate API call.
 */
watch(
  () => props.payload,
  p => {
    if (explainerTimer) clearTimeout(explainerTimer)
    if (!p) {
      text.value = ''
      error.value = ''
      return
    }

    const key = cacheKey.value
    if (key) {
      const cached = sessionStorage.getItem(key)
      if (cached) {
        text.value = cached
        error.value = ''
        return
      }
    }

    explainerTimer = setTimeout(() => {
      void load()
    }, 800)
  },
  { immediate: true, deep: false }
)
</script>

<template>
  <div class="glass-card p-4">
    <div class="card-title-label">What the telemetry means</div>

    <div v-if="loading" class="mt-2">
      <SkeletonBlock height="14px" width="92%" />
      <div class="mt-2">
        <SkeletonBlock height="14px" width="85%" />
      </div>
      <div class="mt-2">
        <SkeletonBlock height="14px" width="88%" />
      </div>
    </div>

    <div v-else-if="error" class="text-sm text-gray-300 mt-2">
      {{ error }}
    </div>

    <div v-else class="text-sm text-gray-200 mt-2 leading-relaxed">
      {{ text }}
    </div>
  </div>
</template>
