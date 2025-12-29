<template>
  <div class="text-xs">
    <div v-if="!hasTarget" class="text-slate-400">—</div>
    <div v-else :class="expired ? 'text-red-600 font-medium' : 'text-slate-600'">{{ text }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
const props = defineProps({
  dueAt: [String, Date], // optional absolute deadline
  startedAt: [String, Date], // optional start timestamp
  estimatedMinutes: [Number], // estimated duration in minutes
  taskId: String
})
const emit = defineEmits(['expired'])
const text = ref('')
const expired = ref(false)
let timer = null

const hasTarget = computed(() => {
  if (props.dueAt) return true
  if (props.startedAt && props.estimatedMinutes) return true
  return false
})

function getTargetTime() {
  if (props.dueAt) return new Date(props.dueAt).getTime()
  if (props.startedAt && props.estimatedMinutes) {
    const start = new Date(props.startedAt).getTime()
    return start + (props.estimatedMinutes * 60 * 1000)
  }
  return null
}

function formatTime(ms) {
  if (ms <= 0) return '已到期'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${sec}s`
  return `${sec}s`
}

function update() {
  const target = getTargetTime()
  if (!target) { text.value = '—'; return }
  const now = Date.now()
  const diff = target - now
  if (diff <= 0) {
    if (!expired.value) {
      expired.value = true
      text.value = '已到期'
      emit('expired', props.taskId)
    }
    return
  }
  text.value = formatTime(diff)
}

onMounted(() => {
  update()
  timer = setInterval(update, 1000)
})
onUnmounted(() => clearInterval(timer))
watch([() => props.dueAt, () => props.startedAt, () => props.estimatedMinutes], update)
</script>