<template>
  <div class="driver-badge" :style="{ '--team-color': teamColor }">
    <div class="avatar">
      <img v-if="headshotUrl" :src="headshotUrl" :alt="name" />
      <span v-else class="initials">{{ initials }}</span>
    </div>
    <div class="info" v-if="showInfo">
      <span class="code">{{ code }}</span>
      <span class="team-name" :style="{ color: teamColor }">{{ team }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getTeamColor } from '@/constants/teams'

const props = withDefaults(defineProps<{
  code: string
  name: string
  team: string
  headshotUrl?: string
  showInfo?: boolean
  size?: 'sm' | 'md' | 'lg'
}>(), {
  showInfo: true,
  size: 'md',
})

const teamColor = computed(() => getTeamColor(props.team))
const initials = computed(() => {
  const parts = props.name.split(' ')
  return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : props.name.slice(0, 2)
})
</script>

<style scoped>
.driver-badge {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--team-color);
  overflow: hidden;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.initials {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--team-color);
  font-family: 'DM Mono', monospace;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.code {
  font-weight: 700;
  font-size: 0.875rem;
  font-family: 'DM Mono', monospace;
  color: #fff;
  letter-spacing: 0.05em;
}

.team-name {
  font-size: 0.7rem;
  font-weight: 400;
  opacity: 0.85;
}
</style>
