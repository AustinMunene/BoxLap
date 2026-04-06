<!--
  ChartWrapper.vue

  Standardizes chart presentation: title, subtitle, skeleton loading,
  error state, and optional AI one-liner slot.
-->
<script setup lang="ts">
import StartLightsLoader from '@/components/ui/StartLightsLoader.vue'

const props = withDefaults(
  defineProps<{
    title: string
    subtitle: string
    oneliner: string
    loading?: boolean
    error?: string
    /** Optional retry handler - if omitted, the retry button is hidden. */
    onRetry?: () => void
  }>(),
  {
    loading: false,
    error: '',
    oneliner: '',
  }
)
</script>

<template>
  <div class="glass-card chart-wrapper">
    <div class="chart-header">
      <h3 class="chart-title">{{ props.title }}</h3>
      <p class="chart-subtitle">{{ props.subtitle }}</p>
    </div>

    <div v-if="props.loading" class="chart-skeleton">
      <div class="skeleton-lights">
        <StartLightsLoader label="Loading data" />
      </div>
      <div class="skeleton-bars">
        <div
          v-for="i in 12"
          :key="i"
          class="skeleton-bar"
          :style="{
            height: `${32 + (i % 5) * 8}%`,
            animationDelay: `${i * 0.08}s`,
          }"
        />
      </div>
    </div>

    <div v-else-if="props.error" class="chart-error">
      <span>⚠️</span>
      <p>{{ props.error }}</p>
      <button v-if="props.onRetry" type="button" class="retry-btn" @click="props.onRetry">Try again</button>
    </div>

    <div v-else class="chart-content">
      <slot />
    </div>

    <div v-if="props.oneliner && !props.loading && !props.error" class="chart-insight">
      <span class="insight-icon">💡</span>
      <p class="insight-text">{{ props.oneliner }}</p>
    </div>
    <div v-else-if="!props.loading && !props.error" class="chart-insight chart-insight--empty">
      <span class="insight-icon">💡</span>
      <p class="insight-text insight-text--placeholder">Insight loading...</p>
    </div>
  </div>
</template>

<style scoped>
.chart-wrapper {
  padding: 1.25rem;
}

.chart-header {
  margin-bottom: 0.75rem;
}

.chart-title {
  font-weight: 900;
  letter-spacing: -0.02em;
  font-size: 1.05rem;
  color: #fff;
  margin: 0;
}

.chart-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: #aaa;
  line-height: 1.4;
}

.chart-skeleton {
  height: 280px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
}

.skeleton-lights {
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.chart-skeleton .skeleton-bars {
  flex: 1;
  min-height: 0;
}

.skeleton-bars {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  width: 100%;
  height: 100%;
}

.skeleton-bar {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px 4px 0 0;
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

.chart-error {
  padding: 1rem;
  color: #cbd5e1;
  font-size: 0.9rem;
}

.chart-error p {
  margin: 0.35rem 0 0;
}

.chart-content {
  min-height: 1px;
}

.chart-insight {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  margin-top: 0.9rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.chart-insight--empty .insight-text--placeholder {
  color: rgba(255, 255, 255, 0.2);
  font-style: italic;
}

.insight-icon {
  flex-shrink: 0;
  font-size: 1.1rem;
  line-height: 1.2rem;
}

.insight-text {
  font-size: 0.9rem;
  color: #cbd5e1;
  font-style: italic;
  line-height: 1.45;
  margin: 0;
}

.retry-btn {
  margin-top: 8px;
  padding: 6px 16px;
  background: rgba(232, 0, 45, 0.15);
  border: 1px solid #e8002d;
  border-radius: 6px;
  color: #e8002d;
  font-size: 13px;
  cursor: pointer;
}

@media (max-width: 768px) {
  .chart-wrapper {
    padding: 16px;
  }

  .chart-wrapper :deep(canvas) {
    max-width: 100% !important;
  }

  .chart-skeleton {
    height: 200px;
  }

  .insight-text {
    font-size: 13px;
  }
}
</style>
