<template>
  <div>
    <div class="flex gap-2 mb-3">
      <input v-model="newTitle" @keyup.enter="add" placeholder="添加子任务..." class="input" />
      <button class="btn" @click="add" :disabled="adding">{{ adding ? '添加中...' : '添加' }}</button>
    </div>

    <ul class="space-y-2">
      <li v-for="s in subtasks" :key="s.id" class="flex items-center gap-3 p-3 bg-slate-50 rounded-md">
        <input type="checkbox" :checked="s.completed" @change="toggle(s)" />
        <div class="flex-1">
          <div :class="{'line-through text-slate-400': s.completed}">{{ s.title }}</div>
          <div class="text-xs text-slate-400">{{ formatDate(s.created_at) }}</div>
        </div>
        <button class="text-sm text-red-500" @click="remove(s)" :disabled="deletingId===s.id">删除</button>
      </li>
    </ul>

    <div v-if="loading" class="text-sm text-slate-500 mt-2">加载中...</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'

const props = defineProps({ taskId: { type: String, required: true } })
const subtasks = ref([])
const loading = ref(false)
const adding = ref(false)
const deletingId = ref(null)
const newTitle = ref('')

async function load() {
  loading.value = true
  const { data, error } = await supabase
    .from('subtasks')
    .select('*')
    .eq('task_id', props.taskId)
    .order('order_index', { ascending: true })
  if (error) console.error('load subtasks error', error)
  subtasks.value = data || []
  loading.value = false
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}

async function add() {
  if (!newTitle.value.trim()) return
  adding.value = true
  try {
    const { data, error } = await supabase.from('subtasks').insert([{ task_id: props.taskId, title: newTitle.value.trim() }])
    if (error) throw error
    newTitle.value = ''
    await load()
  } catch (err) {
    console.error('add subtask error', err)
    alert('添加子任务失败：' + (err?.message || err))
  } finally {
    adding.value = false
  }
}

async function toggle(s) {
  try {
    await supabase.from('subtasks').update({ completed: !s.completed }).eq('id', s.id)
    s.completed = !s.completed
  } catch (err) {
    console.error('toggle subtask error', err)
  }
}

async function remove(s) {
  if (!confirm('确认删除子任务？')) return
  deletingId.value = s.id
  try {
    await supabase.from('subtasks').delete().eq('id', s.id)
    await load()
  } catch (err) {
    console.error('delete subtask error', err)
  } finally {
    deletingId.value = null
  }
}

onMounted(load)
</script>