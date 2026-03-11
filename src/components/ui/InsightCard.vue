<template>
  <div class="insight-card glass-card" :style="{ '--accent': accent || '#E8002D' }">
    <div class="accent-bar"></div>
    <div class="content">
      <div class="header">
        <span class="icon">{{ icon }}</span>
        <span class="title">{{ title }}</span>
      </div>
      <p class="description">{{ description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description: string
  accent?: string
  type?: string
}>()
</script>

<style scoped>
.insight-card {
  display: flex;
  overflow: hidden;
  transition: transform 0.2s, border-color 0.2s;
}

.insight-card:hover {
  transform: translateY(-2px);
}

.accent-bar {
  width: 4px;
  flex-shrink: 0;
  background: var(--accent);
  border-radius: 0;
}

.content {
  padding: 1rem 1.25rem;
  flex: 1;
}

.header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.icon {
  font-size: 1.1rem;
}

.title {
  font-weight: 700;
  font-size: 0.875rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--accent);
}

.description {
  font-size: 0.875rem;
  color: #ccc;
  line-height: 1.5;
  margin: 0;
}
</style>
