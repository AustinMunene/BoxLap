<template>
  <div class="skeleton-block" :style="{ height, width, borderRadius: rounded ? '8px' : '4px' }"></div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  height?: string
  width?: string
  rounded?: boolean
}>(), {
  height: '16px',
  width: '100%',
  rounded: false,
})
</script>

<style scoped>
.skeleton-block {
  background: linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
