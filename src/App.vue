<template>
  <div class="app noise-bg">
    <nav class="nav">
      <div class="nav-inner">
        <router-link to="/" class="nav-logo">
          <span class="logo-accent">PIT</span>WALL
        </router-link>
        <div class="nav-links">
          <router-link
            v-for="link in navLinks"
            :key="link.path"
            :to="link.path"
            class="nav-link"
            :class="{ 'nav-link-active': isNavActive(link) }"
          >
            {{ link.label }}
          </router-link>
        </div>

        <div class="season-selector">
          <button
            v-for="year in seasonStore.availableSeasons"
            :key="year"
            type="button"
            class="season-pill"
            :class="{ 'season-pill--active': seasonStore.selectedSeason === year }"
            @click="seasonStore.setSelectedSeason(year)"
          >
            {{ year }}
          </button>
        </div>

        <button class="nav-mobile-btn" @click="mobileOpen = !mobileOpen" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
      </div>
      <div class="mobile-menu" :class="{ open: mobileOpen }">
        <router-link
          v-for="link in navLinks"
          :key="link.path"
          :to="link.path"
          class="mobile-link"
          @click="mobileOpen = false"
        >
          {{ link.label }}
        </router-link>
        <div class="mobile-seasons">
          <span class="mobile-seasons-label">Season</span>
          <div class="season-selector season-selector--mobile">
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
      </div>
    </nav>

    <main class="main-content">
      <router-view v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </router-view>
    </main>

    <footer class="footer">
      <div class="footer-inner">
        <span class="footer-logo"><span class="logo-accent">PIT</span>WALL</span>
        <span class="footer-desc">F1 Fan Analytics - Data from OpenF1 & Ergast API</span>
        <span class="footer-disclaimer">Not affiliated with Formula 1, FOM, or FIA.</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useSeasonStore } from '@/stores/seasonStore'

const mobileOpen = ref(false)
const route = useRoute()
const seasonStore = useSeasonStore()

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

function selectSeasonMobile(year: number) {
  seasonStore.setSelectedSeason(year)
  mobileOpen.value = false
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
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem;
  min-height: 60px;
  display: flex;
  align-items: center;
  gap: 1rem;
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

.nav-links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
}

.nav-link {
  padding: 0.375rem 0.875rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
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

.season-selector {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  padding: 4px;
  flex-shrink: 0;
}

.season-selector--mobile {
  width: 100%;
  flex-wrap: wrap;
  justify-content: center;
}

.mobile-seasons {
  padding: 0.75rem 0.5rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.mobile-seasons-label {
  display: block;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #555;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
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

.nav-mobile-btn {
  display: none;
  flex-direction: column;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
}

.nav-mobile-btn span {
  display: block;
  width: 22px;
  height: 2px;
  background: #aaa;
  border-radius: 2px;
}

.mobile-menu {
  display: none;
  flex-direction: column;
  padding: 0.5rem 1rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.mobile-menu.open {
  display: flex;
}

.mobile-link {
  padding: 0.75rem 0.5rem;
  color: #888;
  text-decoration: none;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: color 0.15s;
}

.mobile-link:hover {
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
  max-width: 1280px;
  margin: 0 auto;
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

@media (max-width: 900px) {
  .season-selector:not(.season-selector--mobile) {
    order: 3;
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .nav-links {
    display: none;
  }
  .season-selector:not(.season-selector--mobile) {
    display: none;
  }
  .nav-mobile-btn {
    display: flex;
    margin-left: auto;
  }
}
</style>
