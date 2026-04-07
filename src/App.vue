<template>
  <div class="app noise-bg">
    <nav class="nav navbar">
      <div class="nav-inner navbar-inner">
        <router-link to="/" class="nav-logo navbar-logo">
          <span class="logo-accent">BOX</span>LAP
        </router-link>

        <div class="nav-links navbar-links" :class="{ 'navbar-links--open': menuOpen }">
          <router-link
            v-for="link in navLinks"
            :key="link.path"
            :to="link.path"
            class="nav-link navbar-link"
            :class="{ 'nav-link-active': isNavActive(link), 'navbar-link--active': isNavActive(link) }"
            @click="menuOpen = false"
          >
            {{ link.label }}
          </router-link>
          <div class="season-selector season-selector--in-menu">
            <button
              v-for="year in seasonStore.availableSeasons"
              :key="year"
              type="button"
              class="season-pill"
              :class="{ 'season-pill--active': seasonStore.selectedSeason === year }"
              @click="selectSeasonMobile(year)"
            >
              {{ year }}
            </button>
          </div>
        </div>

        <div class="season-selector season-selector--desktop">
          <button
            v-for="year in seasonStore.availableSeasons"
            :key="year"
            type="button"
            class="season-pill"
            :class="{ 'season-pill--active': seasonStore.selectedSeason === year }"
            @click="onSeasonSelect(year)"
          >
            {{ year }}
          </button>
        </div>

        <button
          type="button"
          class="hamburger"
          :class="{ 'hamburger--open': menuOpen }"
          aria-label="Menu"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <span class="hamburger-line" />
          <span class="hamburger-line" />
          <span class="hamburger-line" />
        </button>
      </div>
    </nav>

    <main class="main-content page-content">
      <router-view v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </router-view>
    </main>

    <footer class="footer">
      <div class="footer-inner container">
        <span class="footer-logo"><span class="logo-accent">BOX</span>LAP</span>
        <span class="footer-desc">F1 Fan Analytics - Data from OpenF1 & Ergast API</span>
        <span class="footer-disclaimer">Not affiliated with Formula 1, FOM, or FIA.</span>
      </div>
    </footer>

    <BackToTop />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSeasonStore } from '@/stores/seasonStore'
import { useRaceStore } from '@/stores/raceStore'
import BackToTop from '@/components/ui/BackToTop.vue'

const menuOpen = ref(false)
const route = useRoute()
const router = useRouter()
const seasonStore = useSeasonStore()
const raceStore = useRaceStore()

watch(
  () => route.path,
  () => {
    menuOpen.value = false
  }
)

watch(menuOpen, open => {
  document.body.style.overflow = open ? 'hidden' : ''
})

/**
 * When the user selects a different season, we navigate to the home page rather than
 * staying on the current page. Race rounds, telemetry sessions, and profile context
 * are season-specific; going home matches common F1 site behaviour and avoids stale state.
 */
async function onSeasonSelect(year: number) {
  if (year === seasonStore.selectedSeason) return

  seasonStore.setSelectedSeason(year)
  raceStore.reset()
  await seasonStore.loadCurrentSeason()
  await router.push('/')
}

const navLinks = computed(() => [
  { path: '/', label: 'Home' },
  { path: '/drivers', label: 'Drivers' },
  { path: '/teams', label: 'Teams' },
  { path: `/telemetry/${seasonStore.selectedSeason}/1`, label: 'Telemetry', telemetry: true as const },
])

function isNavActive(link: { path: string; telemetry?: boolean }) {
  if (link.telemetry) return route.path.startsWith('/telemetry')
  return route.path === link.path
}

async function selectSeasonMobile(year: number) {
  await onSeasonSelect(year)
  menuOpen.value = false
}

onMounted(() => {
  void seasonStore.loadCurrentSeason()
})
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(8, 8, 8, 0.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.nav-inner {
  min-height: 60px;
  flex-wrap: wrap;
}

.nav-logo {
  font-size: 1.25rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  color: white;
  text-decoration: none;
  flex-shrink: 0;
}

.logo-accent {
  color: #e8002d;
}

.nav-link {
  border-radius: 6px;
  color: #888;
  text-decoration: none;
  transition:
    color 0.15s,
    background 0.15s;
  letter-spacing: 0.03em;
}

.nav-link:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}

.nav-link.router-link-active,
.nav-link.nav-link-active {
  color: #fff;
  background: rgba(232, 0, 45, 0.12);
}

.season-selector--desktop {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  padding: 4px;
  flex-shrink: 0;
}

.season-selector--in-menu {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  padding: 8px;
}

.season-pill {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 700;
  color: #666;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Titillium Web', sans-serif;
}

.season-pill--active {
  background: #e8002d;
  color: #fff;
}

.main-content {
  flex: 1;
}

.footer {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 2rem 1.5rem;
}

.footer-inner {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
  text-align: center;
}

.footer-logo {
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: 0.06em;
}

.footer-desc {
  font-size: 0.8rem;
  color: #666;
}

.footer-disclaimer {
  font-size: 0.75rem;
  color: #444;
}

@media (min-width: 769px) {
  .nav-links {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
  }

  .nav-link {
    padding: 0.375rem 0.875rem;
    font-size: 0.875rem;
    font-weight: 600;
  }
}

@media (max-width: 900px) {
  .season-selector--desktop {
    order: 3;
    width: 100%;
    justify-content: center;
  }
}
</style>
