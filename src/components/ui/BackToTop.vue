<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const visible = ref(false)
let ticking = false

function onScroll() {
  if (!ticking) {
    requestAnimationFrame(() => {
      visible.value = window.scrollY > 400
      ticking = false
    })
    ticking = true
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <Transition name="btt">
    <button v-if="visible" type="button" class="back-to-top" aria-label="Back to top" @click="scrollToTop">
      ↑
    </button>
  </Transition>
</template>

<style scoped>
.back-to-top {
  position: fixed;
  bottom: max(24px, env(safe-area-inset-bottom, 24px));
  right: max(16px, env(safe-area-inset-right, 16px));
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #e8002d;
  color: #fff;
  border: none;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(232, 0, 45, 0.4);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  line-height: 1;
}

.back-to-top:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(232, 0, 45, 0.5);
}

.back-to-top:active {
  transform: scale(0.92);
}

.btt-enter-active,
.btt-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s;
}

.btt-enter-from,
.btt-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
