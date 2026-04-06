<!--
  StartLightsLoader.vue

  Animates 5 red lights illuminating one by one then going dark,
  matching the F1 race start sequence timing.

  Props:
  - compact: boolean — smaller version for inline use in buttons
  - label: string — optional text below the lights
-->
<script setup lang="ts">
defineProps<{
  compact?: boolean
  label?: string
}>()

const lightIndices = [1, 2, 3, 4, 5] as const
</script>

<template>
  <div class="start-lights" :class="{ 'start-lights--compact': compact }">
    <div class="lights-row">
      <div v-for="i in lightIndices" :key="i" class="light-pod">
        <div class="light-bulb" :style="{ animationDelay: `${(i - 1) * 0.4}s` }" />
      </div>
    </div>
    <p v-if="label && !compact" class="lights-label">{{ label }}</p>
  </div>
</template>

<style scoped>
.start-lights {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.start-lights--compact {
  flex-direction: row;
  gap: 8px;
  padding: 0;
}

.lights-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.start-lights--compact .lights-row {
  gap: 4px;
}

.light-pod {
  width: 24px;
  height: 36px;
  background: #1a0a0a;
  border-radius: 4px;
  border: 1px solid #2a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.start-lights--compact .light-pod {
  width: 14px;
  height: 20px;
  border-radius: 3px;
}

.light-bulb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #2a0000;
  border: 1px solid #3a0000;
  animation: light-sequence 2.5s ease-in-out infinite;
}

.start-lights--compact .light-bulb {
  width: 8px;
  height: 8px;
}

@keyframes light-sequence {
  0% {
    background: #2a0000;
    box-shadow: none;
    border-color: #3a0000;
  }
  15% {
    background: #cc0000;
    box-shadow: 0 0 8px #ff0000, 0 0 16px rgba(255, 0, 0, 0.4);
    border-color: #ff0000;
  }
  65% {
    background: #ff0000;
    box-shadow: 0 0 12px #ff0000, 0 0 24px rgba(255, 0, 0, 0.5), 0 0 40px rgba(255, 0, 0, 0.2);
    border-color: #ff3333;
  }
  80% {
    background: #ff0000;
    box-shadow: 0 0 12px #ff0000, 0 0 24px rgba(255, 0, 0, 0.5);
    border-color: #ff3333;
  }
  90% {
    background: #2a0000;
    box-shadow: none;
    border-color: #3a0000;
  }
  100% {
    background: #2a0000;
    box-shadow: none;
    border-color: #3a0000;
  }
}

.lights-label {
  font-size: 12px;
  color: #555;
  font-family: 'Titillium Web', sans-serif;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin: 0;
}
</style>
