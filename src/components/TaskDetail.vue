<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal-panel max-w-4xl w-full" v-if="task" role="dialog" aria-modal="true">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <h3 class="text-2xl font-semibold">{{ local.title }}</h3>
          <div class="text-sm text-slate-500 mt-1">{{ local.description }}</div>

          <div class="flex items-center gap-3 mt-4">
            <div class="text-sm">状态：<span class="font-medium">{{ local.status }}</span></div>
            <div v-if="local.estimated_minutes" class="text-sm">预计：{{ local.estimated_minutes }} 分钟</div>
            <div v-if="local.started_at" class="text-sm">开始：{{ new Date(local.started_at).toLocaleString() }}</div>
            <div v-if="local.completed_at" class="text-sm text-green-600">完成于：{{ new Date(local.completed_at).toLocaleString() }}</div>
          </div>

          <div class="mt-4">
            <div class="countbar" v-if="hasEstimate">
              <i :style="{ width: progress + '%' }"></i>
            </div>
            <div class="text-xs text-slate-500 mt-2">
              <CountdownTimer
                :startedAt="local.started_at"
                :estimatedMinutes="local.estimated_minutes"
                :dueAt="local.due_at"
                :taskId="local.id"
                @expired="onExpired"
              />
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button v-if="local.status !== 'inprogress'" class="btn" @click="startTask" :disabled="isProcessing">开始任务</button>
          <button v-else class="btn bg-yellow-600" @click="markComplete" :disabled="isProcessing">标记完成</button>
          <button class="btn bg-slate-200 text-slate-800" @click="close">关闭</button>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4 mt-6">
        <div class="col-span-2 space-y-4">
          <div class="card">
            <h4 class="font-semibold mb-2">子任务</h4>
            <Subtasks :taskId="local.id" />
          </div>

          <div class="card">
            <h4 class="font-semibold mb-2">评论</h4>
            <Comments :taskId="local.id" />
          </div>
        </div>

        <div class="space-y-4">
          <div class="card">
            <h4 class="font-semibold mb-2">附件</h4>
            <AttachmentUploader :taskId="local.id" />
          </div>

          <div class="card">
            <h4 class="font-semibold mb-2">任务信息</h4>
            <div class="text-sm text-slate-600">优先级: <span class="font-medium">{{ priorityText }}</span></div>
            <div class="text-sm text-slate-600 mt-1">截止: {{ local.due_at ? new Date(local.due_at).toLocaleString() : '—' }}</div>
            <div class="text-sm text-slate-600 mt-1">预计完成: {{ local.estimated_minutes ? local.estimated_minutes + ' 分钟' : '未设置' }}</div>
          </div>
        </div>
      </div>

      <ConfirmComplete
        v-if="showConfirm"
        @close="() => showConfirm = false"
        @finish="handleFinish"
        @extend="handleExtend"
        @skip="handleSkip"
      />
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, toRefs, watch, computed } from 'vue'
import Subtasks from './Subtasks.vue'
import Comments from './Comments.vue'
import AttachmentUploader from './AttachmentUploader.vue'
import CountdownTimer from './CountdownTimer.vue'
import ConfirmComplete from './ConfirmComplete.vue'
import { supabase } from '../lib/supabase'

const props = defineProps({ task: Object })
const emit = defineEmits(['close','saved','edit'])
const local = reactive({ ...props.task })
const isProcessing = ref(false)
const showConfirm = ref(false)

watch(() => props.task, (v) => {
  Object.assign(local, v || {})
})

const hasEstimate = computed(() => !!(local.estimated_minutes || local.due_at))
const priorityText = computed(() => local.priority === 1 ? '高' : local.priority === 3 ? '低' : '中')

// progress % based on started_at + estimated_minutes
const progress = computed(() => {
  if (!local.started_at || !local.estimated_minutes) return 0
  const start = new Date(local.started_at).getTime()
  const due = start + local.estimated_minutes * 60 * 1000
  const now = Date.now()
  if (now >= due) return 100
  const total = Math.max(1, due - start)
  return Math.min(100, Math.round(((now - start) / total) * 100))
})

async function startTask() {
  isProcessing.value = true
  try {
    const started_at = new Date().toISOString()
    const { error } = await supabase.from('tasks').update({ started_at, status: 'inprogress' }).eq('id', local.id)
    if (error) throw error
    local.started_at = started_at
    local.status = 'inprogress'
    emit('saved')
  } catch (err) {
    console.error('start task error', err)
    alert('开始任务失败: ' + (err.message || err))
  } finally {
    isProcessing.value = false
  }
}

async function markComplete() {
  isProcessing.value = true
  try {
    const completed_at = new Date().toISOString()
    let duration = local.duration_seconds || 0
    if (local.started_at) {
      const started = new Date(local.started_at).getTime()
      duration = Math.floor((Date.now() - started) / 1000)
    }
    const { error } = await supabase.from('tasks').update({ status: 'done', completed_at, duration_seconds: duration }).eq('id', local.id)
    if (error) throw error
    local.status = 'done'
    local.completed_at = completed_at
    local.duration_seconds = duration
    emit('saved')
  } catch (err) {
    console.error('complete error', err)
    alert('完成任务失败: ' + (err.message || err))
  } finally {
    isProcessing.value = false
  }
}

function onExpired(taskId) {
  showConfirm.value = true
}

async function handleFinish({ summary }) {
  showConfirm.value = false
  isProcessing.value = true
  try {
    const completed_at = new Date().toISOString()
    let duration = local.duration_seconds || 0
    if (local.started_at) duration = Math.floor((Date.now() - new Date(local.started_at).getTime()) / 1000)
    const { error } = await supabase.from('tasks').update({ status: 'done', completed_at, duration_seconds: duration }).eq('id', local.id)
    if (error) throw error
    if (summary && summary.trim()) {
      const { data: sUser } = await supabase.auth.getSession()
      const user = sUser?.session?.user
      await supabase.from('comments').insert([{ task_id: local.id, content: '【完成总结】' + summary.trim(), user_id: user?.id }])
    }
    emit('saved')
  } catch (err) {
    console.error('finish error', err)
  } finally {
    isProcessing.value = false
  }
}

async function handleExtend({ extraMinutes }) {
  showConfirm.value = false
  isProcessing.value = true
  try {
    const newEstimate = (local.estimated_minutes || 0) + Number(extraMinutes || 0)
    const { error } = await supabase.from('tasks').update({ estimated_minutes: newEstimate }).eq('id', local.id)
    if (error) throw error
    local.estimated_minutes = newEstimate
  } catch (err) {
    console.error(err)
  } finally {
    isProcessing.value = false
  }
}

async function handleSkip() {
  // 用户选择放回待办：把状态改为 todo，清空 started_at，并把本次已用时间累加到 duration_seconds
  showConfirm.value = false
  isProcessing.value = true
  try {
    // compute elapsed seconds if started_at exists
    let elapsed = 0
    if (local.started_at) {
      const started = new Date(local.started_at).getTime()
      elapsed = Math.floor((Date.now() - started) / 1000)
    }
    const newDuration = (local.duration_seconds || 0) + elapsed
    const updates = { status: 'todo', started_at: null, duration_seconds: newDuration }
    const { error } = await supabase.from('tasks').update(updates).eq('id', local.id)
    if (error) throw error
    // update local copy
    local.status = 'todo'
    local.started_at = null
    local.duration_seconds = newDuration
    emit('saved')
  } catch (err) {
    console.error('skip handling error', err)
    alert('操作失败: ' + (err?.message || err))
  } finally {
    isProcessing.value = false
  }
}

function close() {
  emit('close')
}
</script>

<style scoped>
.countbar > i { transition: width 600ms cubic-bezier(.2,.9,.3,1); height: 10px; display:block; background:linear-gradient(90deg,#2563EB,#1E40AF); border-radius:999px; }
</style>