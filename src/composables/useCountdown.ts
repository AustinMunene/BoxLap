import { ref, onMounted, onUnmounted } from 'vue'

export function useCountdown(targetDate: string) {
  const remaining = ref({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  let timer: ReturnType<typeof setInterval> | null = null

  function update() {
    const now = Date.now()
    const target = new Date(targetDate).getTime()
    const diff = Math.max(0, target - now)

    remaining.value = {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
    }
  }

  onMounted(() => {
    update()
    timer = setInterval(update, 1000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return { remaining: remaining as Readonly<typeof remaining> }
}
