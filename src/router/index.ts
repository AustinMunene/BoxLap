import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: HomeView,
    },
    {
      path: '/race/:season/:round',
      component: () => import('@/views/RaceView.vue'),
      props: route => ({
        season: parseInt(route.params.season as string),
        round: parseInt(route.params.round as string),
      }),
    },
    {
      path: '/drivers',
      component: () => import('@/views/DriversView.vue'),
    },
    {
      path: '/teams',
      component: () => import('@/views/TeamsView.vue'),
    },
    {
      path: '/predict',
      component: () => import('@/views/PredictView.vue'),
    },
  ],
  scrollBehavior() {
    return { top: 0, behavior: 'smooth' }
  },
})

export default router
