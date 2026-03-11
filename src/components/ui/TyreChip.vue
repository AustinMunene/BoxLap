<template>
  <span class="tyre-chip" :style="{ background: tyreInfo.bg, color: tyreInfo.text }">
    <span class="compound-letter">{{ tyreInfo.label }}</span>
    <span v-if="laps" class="laps-count">{{ laps }}L</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getTyreColor } from '@/constants/teams'

const props = defineProps<{
  compound: string
  laps?: number
}>()

const tyreInfo = computed(() => getTyreColor(props.compound))
</script>

<style scoped>
.tyre-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  letter-spacing: 0.03em;
}

.compound-letter {
  font-weight: 900;
}

.laps-count {
  opacity: 0.8;
  font-weight: 500;
}
</style>
