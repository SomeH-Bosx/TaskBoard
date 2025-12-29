<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal-panel" v-if="open" role="dialog" aria-modal="true">
      <h3 class="text-2xl font-semibold mb-4">{{ local.id ? '编辑任务' : '新增任务' }}</h3>

      <div class="space-y-3">
        <label class="text-sm">标题</label>
        <input v-model="local.title" class="input" placeholder="简短的任务标题" />

        <label class="text-sm">描述</label>
        <textarea v-model="local.description" class="input" rows="5" placeholder="详细描述任务要点、目标与要求"></textarea>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="text-sm">截止日期 (DDL)</label>
            <input type="datetime-local" v-model="localDue" class="input" />
            <p class="text-xs text-slate-400 mt-1">可选：用于提醒或统计按时完成</p>
          </div>

          <div>
            <label class="text-sm">预计完成时长 (分钟)</label>
            <input type="number" min="0" v-model.number="local.estimated_minutes" class="input" />
            <p class="text-xs text-slate-400 mt-1">用于倒计时与到期弹窗（例如 90 表示 90 分钟）</p>
          </div>

          <div>
            <label class="text-sm">优先级</label>
            <select v-model.number="local.priority" class="input">
              <option :value="1">高</option>
              <option :value="2">中</option>
              <option :value="3">低</option>
            </select>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <input type="checkbox" id="notify" v-model="notify" />
          <label for="notify" class="text-sm">创建提醒（在预计结束时触发邮件/弹窗）</label>
        </div>

        <div class="flex justify-end gap-3">
          <button class="btn bg-slate-200 text-slate-800" @click="cancel">取消</button>
          <button class="btn" @click="save" :disabled="isSaving">
            <span v-if="isSaving">保存中…</span>
            <span v-else>保存</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { supabase } from '../lib/supabase'
const props = defineProps({ modelValue: Object })
const emit = defineEmits(['update:modelValue','saved'])
const open = ref(true)
const isSaving = ref(false)

const local = reactive(props.modelValue ? { ...props.modelValue } : { title: '', description: '', priority: 2, due_at: null, estimated_minutes: null, user_id: null, status: 'todo' })
const localDue = ref(local.due_at ? isoToLocal(local.due_at) : '')
const notify = ref(false)

watch(() => props.modelValue, (v) => {
  Object.assign(local, v || { title: '', description: '', priority: 2, due_at: null, estimated_minutes: null, user_id: null, status: 'todo' })
  localDue.value = local.due_at ? isoToLocal(local.due_at) : ''
})

function isoToLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0,16)
}
function fromLocalInput(val) {
  if (!val) return null
  return new Date(val).toISOString()
}

async function ensureUserId() {
  if (local.user_id) return
  const { data } = await supabase.auth.getSession()
  const user = data?.session?.user ?? null
  if (user) local.user_id = user.id
}

async function save() {
  isSaving.value = true
  try {
    await ensureUserId()
    local.due_at = fromLocalInput(localDue.value)
    if (local.id) {
      const { error } = await supabase.from('tasks').update({
        title: local.title,
        description: local.description,
        priority: local.priority,
        due_at: local.due_at,
        estimated_minutes: local.estimated_minutes,
        status: local.status
      }).eq('id', local.id)
      if (error) throw error
    } else {
      const payload = {
        user_id: local.user_id,
        title: local.title,
        description: local.description,
        priority: local.priority,
        due_at: local.due_at,
        estimated_minutes: local.estimated_minutes,
        status: local.status || 'todo'
      }
      const { error } = await supabase.from('tasks').insert([payload])
      if (error) throw error
    }

    // 如果需要提醒并且已勾选 notify，则插入 reminders 表（基于 estimated_minutes 或 due_at）
    if (notify.value) {
      // compute remind_at: if estimated_minutes set and started_at is null then remind at now + estimated
      let remindAt = null
      if (local.estimated_minutes) {
        remindAt = new Date(Date.now() + local.estimated_minutes * 60 * 1000).toISOString()
      } else if (local.due_at) {
        remindAt = local.due_at
      }
      if (remindAt) {
        // need user id
        const { data } = await supabase.auth.getSession()
        const uid = data?.session?.user?.id
        await supabase.from('reminders').insert([{ task_id: local.id, user_id: uid, remind_at: remindAt }])
      }
    }

    emit('saved')
    emit('update:modelValue', null)
  } catch (err) {
    console.error('save task error', err)
    alert('保存失败: ' + (err?.message || err))
  } finally {
    isSaving.value = false
  }
}

function cancel() {
  emit('update:modelValue', null)
}
</script>