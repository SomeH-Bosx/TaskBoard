<template>
  <div>
    <div class="space-y-3 mb-4">
      <textarea v-model="content" placeholder="写下你的评论..." class="input" rows="3"></textarea>
      <div class="flex justify-end gap-2">
        <button class="btn bg-slate-200 text-slate-800" @click="loadComments">刷新</button>
        <button class="btn" @click="post" :disabled="posting">{{ posting ? '发布中...' : '发布评论' }}</button>
      </div>
    </div>

    <div v-if="loading" class="text-sm text-slate-500">加载评论...</div>

    <ul class="space-y-3">
      <li v-for="c in comments" :key="c.id" class="p-3 bg-slate-50 rounded-md">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-medium">{{ c.profile_name || (c.user_email ? c.user_email.split('@')[0] : '匿名') }}</div>
            <div class="text-xs text-slate-400">{{ formatDate(c.created_at) }}</div>
          </div>
          <div class="text-xs text-slate-500">
            <button v-if="canDelete(c)" class="text-red-500" @click="remove(c)">删除</button>
          </div>
        </div>
        <div class="mt-2 text-sm">{{ c.content }}</div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'

const props = defineProps({ taskId: { type: String, required: true } })
const comments = ref([])
const loading = ref(false)
const posting = ref(false)
const content = ref('')
const currentUserId = ref(null)
const currentUserEmail = ref(null)

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}

async function loadCurrentUser() {
  const { data } = await supabase.auth.getSession()
  currentUserId.value = data?.session?.user?.id ?? null
  currentUserEmail.value = data?.session?.user?.email ?? null
}

// load comments with profile name (left join equivalent via supabase select)
async function loadComments() {
  loading.value = true
  try {
    // select comments plus profile full_name if exists via RPC-like select
    // supabase select syntax: comments:user_id (profiles full_name) is not direct; use explicit join-like select
    const { data, error } = await supabase
      .from('comments')
      .select(`id, content, user_id, created_at, user_email, profiles: user_id ( full_name )`)
      .eq('task_id', props.taskId)
      .order('created_at', { ascending: false })

    if (error) throw error

    comments.value = (data || []).map(item => ({
      id: item.id,
      content: item.content,
      user_id: item.user_id,
      created_at: item.created_at,
      user_email: item.user_email || (item.profiles ? null : null),
      profile_name: item.profiles?.full_name ?? null
    }))
  } catch (err) {
    console.error('load comments error', err)
    // optional: show error toast
  } finally {
    loading.value = false
  }
}

async function post() {
  if (!content.value.trim()) {
    alert('评论内容不能为空')
    return
  }
  posting.value = true
  try {
    const { data } = await supabase.auth.getSession()
    const user = data?.session?.user
    if (!user) { alert('请先登录'); posting.value = false; return }

    const payload = {
      task_id: props.taskId,
      content: content.value.trim(),
      user_id: user.id,
      user_email: user.email
    }

    // insert and request the inserted row to be returned (supabase-js typically returns data)
    const { data: inserted, error } = await supabase.from('comments').insert([payload]).select().single()
    if (error) throw error

    // use returned row (persistent) to update UI
    comments.value.unshift({
      id: inserted.id,
      content: inserted.content,
      user_id: inserted.user_id,
      created_at: inserted.created_at,
      user_email: inserted.user_email,
      profile_name: null // will be loaded on next loadComments or keep null
    })

    content.value = ''
    // optionally reload to get profiles and normalized data
    await loadComments()
  } catch (err) {
    console.error('post comment error', err)
    alert('发布评论失败：' + (err?.message || err))
  } finally {
    posting.value = false
  }
}

function canDelete(c) {
  return currentUserId.value && (currentUserId.value === c.user_id)
}

async function remove(c) {
  if (!confirm('确认删除评论？')) return
  try {
    const { error } = await supabase.from('comments').delete().eq('id', c.id)
    if (error) throw error
    await loadComments()
  } catch (err) {
    console.error('delete comment error', err)
    alert('删除失败: ' + (err?.message || err))
  }
}

onMounted(async () => {
  await loadCurrentUser()
  await loadComments()

  // 可选：订阅实时新增（如果你已启用 Realtime）
  // const channel = supabase.channel('public:comments')
  // channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `task_id=eq.${props.taskId}` }, (payload) => {
  //   comments.value.unshift(payload.new)
  // }).subscribe()
})
</script>

<style scoped>
.input { width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid #e6e9ef; }
.btn { padding: 0.45rem 0.85rem; background:#2563EB; color:#fff; border-radius:8px; }
</style>