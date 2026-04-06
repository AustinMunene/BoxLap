<!--
  RaceStory.vue
  Renders the Gemini-generated race narrative as story cards (Insights tab).
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { generateRaceStory, isRaceStatsComplete, type RaceStats } from '@/api/claudeInsights'
import { useRaceStore } from '@/stores/raceStore'

const props = defineProps<{ raceStats: RaceStats | null }>()

const store = useRaceStore()

const stories = ref<{ headline: string; body: string }[]>([])
const loading = ref(true)
const error = ref('')

const borderColors = ['#f97316', '#14b8a6', '#22c55e', '#e8002d', '#3b82f6']

const lapsLoaded = computed(() => Object.keys(store.laps).length)

const readyToGenerateStory = computed(
  () =>
    store.results.length > 0 &&
    Object.keys(store.laps).length >= Math.min(10, Math.max(store.results.length, 1)) &&
    store.stints.length > 0 &&
    store.pits.length > 0
)

async function runStory() {
  const stats = props.raceStats
  if (!stats || !readyToGenerateStory.value) {
    loading.value = false
    return
  }
  if (!isRaceStatsComplete(stats)) {
    error.value =
      'Race story needs a full data snapshot (pace ranking and strategies). Load laps for at least 10 drivers first.'
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const out = await generateRaceStory(stats)
    if (out == null) {
      error.value = 'Race story is not ready yet — try again in a moment.'
      stories.value = []
    } else {
      stories.value = out
    }
  } catch (e) {
    error.value =
      e instanceof Error
        ? e.message
        : 'Race narrative unavailable - check API configuration'
    // eslint-disable-next-line no-console
    console.error('generateRaceStory error:', e)
  } finally {
    loading.value = false
  }
}

function retryStory() {
  void runStory()
}

watch(
  () => [props.raceStats, readyToGenerateStory.value] as const,
  () => {
    if (!props.raceStats) {
      stories.value = []
      loading.value = true
      error.value = ''
      return
    }
    if (!readyToGenerateStory.value) {
      loading.value = true
      error.value = ''
      return
    }
    void runStory()
  },
  { immediate: true }
)
</script>

<template>
  <section class="race-story-section">
    <div class="section-kicker">Race story</div>

    <div v-if="loading" class="story-skeleton-grid">
      <div v-for="i in 5" :key="i" class="story-skeleton-line" />
    </div>

    <div v-else-if="error" class="story-unavailable">
      <p>
        {{ error }}
        <span v-if="lapsLoaded < 10">
          Currently loaded: {{ lapsLoaded }} drivers.
          <button type="button" class="retry-link" @click="retryStory">Try again</button>
        </span>
      </p>
    </div>

    <div v-else class="story-grid">
      <article
        v-for="(story, i) in stories"
        :key="i"
        v-motion
        :initial="{ opacity: 0, y: 12 }"
        :enter="{ opacity: 1, y: 0, transition: { delay: i * 80 } }"
        class="story-card"
        :style="{ '--story-accent': borderColors[i % borderColors.length] }"
      >
        <h3 class="story-headline">{{ story.headline }}</h3>
        <p class="story-body">{{ story.body }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.section-kicker {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #666;
  margin-bottom: 1rem;
}

.story-skeleton-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.story-skeleton-line {
  height: 72px;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.05));
  animation: pulse 1.2s infinite ease-in-out;
}

.story-unavailable {
  font-size: 0.9rem;
  color: #9ca3af;
  line-height: 1.5;
}

.retry-link {
  margin-left: 0.35rem;
  background: none;
  border: none;
  color: #e8002d;
  text-decoration: underline;
  cursor: pointer;
  font-size: inherit;
  padding: 0;
}

.story-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {
  .story-grid {
    grid-template-columns: 1fr;
  }
}

.story-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 1rem 1rem 1rem 1.1rem;
  border-left: 4px solid var(--story-accent);
}

.story-headline {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
}

.story-body {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.55;
  color: #aaa;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
  100% {
    opacity: 1;
  }
}
</style>
