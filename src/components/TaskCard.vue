<template>
  <div
    class="card group relative overflow-hidden cursor-pointer transform transition duration-200 hover:-translate-y-1 hover:shadow-lg"
    @mouseenter="hover = true" @mouseleave="hover = false"
  >
    <div class="flex justify-between items-start gap-3">
      <div class="flex-1 pr-2" @click="$emit('open', task)">
        <div class="font-semibold text-lg leading-tight text-slate-800 truncate">{{ task.title }}</div>
        <div class="text-sm text-slate-500 mt-1 line-clamp-2">{{ task.description }}</div>
      </div>

      <div class="flex flex-col items-end gap-2">
        <div class="badge transition-opacity duration-200 opacity-90 group-hover:opacity-100">{{ priorityText }}</div>
        <div class="text-xs" :class="dueClass">{{ remainingText }}</div>
      </div>
    </div>

    <div class="flex items-center justify-between gap-3 mt-3">
      <div class="flex-1">
        <div class="countbar" v-if="hasTarget">
          <i :style="{ width: progress + '%' }"></i>
        </div>
        <div v-else class="h-2"></div>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click.stop="$emit('open', task)"
          class="btn-detail inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm bg-white border border-slate-100 shadow-sm hover:bg-primary/6 focus:outline-none transition"
          aria-label="查看详情"
          title="查看详情"
        >
          <svg class="w-4 h-4 text-primary transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12z"/>
          </svg>
          <span class="hidden md:inline text-primary font-medium">详情</span>
        </button>

        <button
          @click.stop="$emit('delete', task)"
          class="text-sm text-red-500 hover:underline"
          title="删除任务"
        >
          删除
        </button>
      </div>
    </div>

    <!-- small hover actions -->
    <div class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
      <div class="flex flex-col items-end gap-2">
        <button @click.stop="$emit('open', task)" class="p-1 rounded-full bg-white/80 hover:bg-white">
          <svg class="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({ task: Object })
const emit = defineEmits(['open','delete','expired'])

const hover = ref(false)
const progress = ref(0)           // percent 0-100
const remainingText = ref('—')    // human readable remain time
let rafId = null

// compute whether we have a target to count down to (due_at or started_at+estimate)
const hasTarget = computed(() => {
  return !!(props.task?.due_at || (props.task?.started_at && props.task?.estimated_minutes))
})

// compute target time in ms
function getTargetTime() {
  if (!props.task) return null
  if (props.task.due_at) {
    return new Date(props.task.due_at).getTime()
  }
  if (props.task.started_at && props.task.estimated_minutes) {
    const start = new Date(props.task.started_at).getTime()
    return start + (Number(props.task.estimated_minutes) * 60 * 1000)
  }
  return null
}

function formatRemaining(ms) {
  if (ms <= 0) return '已到期'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${sec}s`
  return `${sec}s`
}

function updateFrame() {
  const target = getTargetTime()
  if (!target) {
    remainingText.value = '—'
    progress.value = 0
    return
  }
  const now = Date.now()
  const diff = target - now
  if (diff <= 0) {
    remainingText.value = '已到期'
    progress.value = 100
    emit('expired', props.task.id)
    // stop animation after expired reached
    cancelRaf()
    return
  }

  // compute progress: if based on started_at+estimate, compute fraction; otherwise for due_at we estimate from created_at -> due_at
  let pct = 0
  if (props.task.started_at && props.task.estimated_minutes) {
    const start = new Date(props.task.started_at).getTime()
    const end = start + Number(props.task.estimated_minutes) * 60 * 1000
    const total = Math.max(1, end - start)
    const passed = Math.max(0, now - start)
    pct = Math.min(100, Math.round((passed / total) * 100))
  } else if (props.task.due_at && props.task.created_at) {
    const created = new Date(props.task.created_at).getTime()
    const due = new Date(props.task.due_at).getTime()
    const total = Math.max(1, due - created)
    const passed = Math.max(0, now - created)
    pct = Math.min(100, Math.round((passed / total) * 100))
  } else {
    pct = 0
  }

  // smooth the progress with small easing
  progress.value = pct
  remainingText.value = formatRemaining(diff)

  // schedule next frame
  rafId = requestAnimationFrame(updateFrame)
}

function cancelRaf() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

onMounted(() => {
  // start loop if there's a target
  if (hasTarget.value) {
    if (!rafId) rafId = requestAnimationFrame(updateFrame)
  }
})

onUnmounted(() => {
  cancelRaf()
})

// restart animation if task prop changes (e.g., start/estimate updated)
watch(() => [props.task?.started_at, props.task?.estimated_minutes, props.task?.due_at, props.task?.created_at], () => {
  cancelRaf()
  if (hasTarget.value) rafId = requestAnimationFrame(updateFrame)
})

const priorityText = computed(() => props.task.priority === 1 ? '高' : props.task.priority === 3 ? '低' : '中')
const dueClass = computed(() => {
  if (!props.task?.due_at && !(props.task?.started_at && props.task?.estimated_minutes)) return 'text-slate-400'
  const target = getTargetTime()
  if (!target) return 'text-slate-400'
  return Date.now() > target ? 'text-red-600 font-medium' : 'text-slate-600'
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* progress bar visuals */
.countbar {
  height: 8px;
  background: #eef2ff; /* light */
  border-radius: 999px;
  overflow: hidden;
}
.countbar > i {
  display: block;
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #2563EB, #1E40AF);
  transition: width 300ms linear;
  border-radius: 999px;
}
</style>