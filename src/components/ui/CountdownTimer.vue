<template>
  <div class="countdown-timer">
    <div class="unit" v-for="unit in units" :key="unit.label">
      <span class="value">{{ pad(unit.value) }}</span>
      <span class="label">{{ unit.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCountdown } from '@/composables/useCountdown'

const props = defineProps<{
  targetDate: string
}>()

const { remaining } = useCountdown(props.targetDate)

const units = computed(() => [
  { label: 'DAYS', value: remaining.value.days },
  { label: 'HRS', value: remaining.value.hours },
  { label: 'MIN', value: remaining.value.minutes },
  { label: 'SEC', value: remaining.value.seconds },
])

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
</script>

<style scoped>
.countdown-timer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 52px;
}

.value {
  font-family: 'DM Mono', monospace;
  font-size: 2rem;
  font-weight: 500;
  color: #fff;
  line-height: 1;
  letter-spacing: -0.02em;
}

.label {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #666;
  margin-top: 0.25rem;
  text-transform: uppercase;
}

.unit:not(:last-child) .value::after {
  content: ':';
  margin-left: 0.75rem;
}
</style>
