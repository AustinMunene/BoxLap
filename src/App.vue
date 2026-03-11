<template>
  <div class="app">
    <!-- Navigation -->
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
            :class="{ 'nav-link-active': $route.path === link.path }"
          >
            {{ link.label }}
          </router-link>
        </div>
        <button class="nav-mobile-btn" @click="mobileOpen = !mobileOpen" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
      </div>
      <!-- Mobile menu -->
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
      </div>
    </nav>

    <!-- Main content with route transitions -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </router-view>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-inner">
        <span class="footer-logo"><span class="logo-accent">PIT</span>WALL</span>
        <span class="footer-desc">F1 Fan Analytics — Data from OpenF1 & Ergast API</span>
        <span class="footer-disclaimer">Not affiliated with Formula 1, FOM, or FIA.</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const mobileOpen = ref(false)

const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/drivers', label: 'Drivers' },
  { path: '/teams', label: 'Teams' },
  { path: '/predict', label: 'Predict' },
]
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
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.nav-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 1.5rem;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 2rem;
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
  color: #E8002D;
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
  transition: color 0.15s, background 0.15s;
  letter-spacing: 0.03em;
}

.nav-link:hover {
  color: #fff;
  background: rgba(255,255,255,0.06);
}

.nav-link.router-link-active,
.nav-link.nav-link-active {
  color: #fff;
  background: rgba(232, 0, 45, 0.12);
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
  border-top: 1px solid rgba(255,255,255,0.06);
}

.mobile-menu.open {
  display: flex;
}

.mobile-link {
  padding: 0.75rem 0.5rem;
  color: #888;
  text-decoration: none;
  font-weight: 600;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: color 0.15s;
}

.mobile-link:hover {
  color: #fff;
}

.main-content {
  flex: 1;
}

.footer {
  border-top: 1px solid rgba(255,255,255,0.06);
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

@media (max-width: 768px) {
  .nav-links {
    display: none;
  }
  .nav-mobile-btn {
    display: flex;
    margin-left: auto;
  }
}
</style>
