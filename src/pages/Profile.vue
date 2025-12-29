<template>
  <div>
    <Navbar />

    <div class="app-container mt-10">
      <div class="grid md:grid-cols-3 gap-6">
        <!-- Avatar & quick actions -->
        <div class="card col-span-1 flex flex-col items-center gap-4 p-8">
          <div class="w-36 h-36 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
            <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" class="w-full h-full object-cover" />
            <div v-else class="text-slate-400">无头像</div>
          </div>

          <div class="flex gap-3">
            <input ref="fileRef" type="file" accept="image/*" class="hidden" @change="onFileChange" />
            <button class="btn" @click="triggerFile">本地上传</button>
            <button class="btn bg-slate-200 text-slate-800" @click="showUrlModal = true">通过 URL 上传</button>
          </div>

          <div class="flex gap-3 mt-2">
            <button class="btn bg-red-600" @click="removeAvatar" :disabled="removing">
              {{ removing ? '移除中...' : '移除' }}
            </button>
          </div>

          <div v-if="msg" class="text-sm text-green-600 mt-2">{{ msg }}</div>
          <div v-if="error" class="text-sm text-red-600 mt-2">{{ error }}</div>
        </div>

        <!-- Profile edit form -->
        <div class="card col-span-2 p-6">
          <h3 class="text-xl font-semibold mb-4">编辑个人信息</h3>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-sm">姓名</label>
              <input v-model="profile.full_name" class="input mt-1" placeholder="你的名字" />
            </div>

            <div>
              <label class="text-sm">时区</label>
              <input v-model="profile.timezone" class="input mt-1" placeholder="例如 Asia/Shanghai" />
            </div>

            <div class="col-span-2">
              <label class="text-sm">个人简介</label>
              <textarea v-model="profile.bio" rows="4" class="input mt-1" placeholder="一句话介绍自己"></textarea>
            </div>

            <div>
              <label class="text-sm">公开邮箱（只读）</label>
              <div class="input mt-1 bg-slate-50">{{ userEmail || '未登录' }}</div>
            </div>

            <div>
              <label class="text-sm">已创建任务 / 进行中 / 已完成</label>
              <div class="input mt-1 bg-slate-50">
                {{ stats.total }} / {{ stats.inprogress }} / {{ stats.done }}
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 mt-4">
            <button class="btn bg-slate-200 text-slate-800" @click="reload">重置</button>
            <button class="btn" @click="save" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
          </div>
        </div>
      </div>

      <!-- Optional: additional profile info or activity -->
      <div class="grid md:grid-cols-3 gap-4 mt-8">
        <div class="card col-span-2 p-6">
          <h4 class="font-semibold mb-2">近期活动（示例）</h4>
          <ul class="text-sm text-slate-600 space-y-2">
            <li v-for="a in recent" :key="a.id">
              <div class="font-medium">{{ a.title }}</div>
              <div class="text-xs text-slate-400">{{ formatDate(a.at) }}</div>
            </li>
          </ul>
        </div>

        <div class="card p-6">
          <h4 class="font-semibold mb-2">账户信息</h4>
          <div class="text-sm text-slate-700">用户ID: <span class="font-mono text-xs">{{ userId || '-' }}</span></div>
          <div class="text-sm text-slate-700 mt-2">注册时间: <span>{{ profile.created_at ? formatDate(profile.created_at) : '—' }}</span></div>
        </div>
      </div>
    </div>

    <!-- URL upload modal -->
    <div v-if="showUrlModal" class="modal-backdrop" @click.self="showUrlModal = false">
      <div class="modal-panel max-w-md">
        <h3 class="text-lg font-semibold mb-2">通过 URL 上传头像</h3>
        <p class="text-sm text-slate-500 mb-3">粘贴图片的完整 URL（例如 https://...jpg/png）。该 URL 将直接保存到你的个人信息中。</p>
        <input v-model="avatarUrlInput" placeholder="https://..." class="input" />
        <div class="flex justify-end gap-3 mt-3">
          <button class="btn bg-slate-200 text-slate-800" @click="showUrlModal = false">取消</button>
          <button class="btn" @click="saveAvatarFromUrl" :disabled="urlSaving">{{ urlSaving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar.vue'

const fileRef = ref(null)
const showUrlModal = ref(false)
const avatarUrlInput = ref('')
const urlSaving = ref(false)
const saving = ref(false)
const removing = ref(false)
const msg = ref('')
const error = ref('')
const userId = ref(null)
const userEmail = ref(null)
const avatarPreview = ref(null) // for display (signed url or direct url)
const profile = reactive({
  id: null,
  full_name: '',
  avatar_url: null,
  bio: '',
  timezone: null,
  created_at: null
})

const stats = reactive({ total: 0, done: 0, inprogress: 0 })
const recent = ref([])

const AVATAR_BUCKET = 'avatars'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}

async function loadProfile() {
  msg.value = ''
  error.value = ''
  try {
    const { data } = await supabase.auth.getSession()
    const user = data?.session?.user
    if (!user) { userId.value = null; userEmail.value = null; return }
    userId.value = user.id
    userEmail.value = user.email

    // load profile row
    const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (pErr && pErr.code !== 'PGRST116') console.error(pErr)
    if (p) {
      profile.id = p.id
      profile.full_name = p.full_name || ''
      profile.avatar_url = p.avatar_url || null
      profile.bio = p.bio || ''
      profile.timezone = p.timezone || ''
      profile.created_at = p.created_at || null
      // resolve avatar preview
      await resolveAvatarPreview()
    }

    // load stats
    const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', user.id)
    const arr = tasks || []
    stats.total = arr.length
    stats.done = arr.filter(t => t.status === 'done').length
    stats.inprogress = arr.filter(t => t.status === 'inprogress').length

    // recent demo events (from tasks)
    recent.value = (arr.slice(0, 6) || []).map(t => ({ id: t.id, title: `${t.title} (${t.status})`, at: t.created_at }))
  } catch (err) {
    console.error('loadProfile', err)
    error.value = err.message || String(err)
  }
}

async function resolveAvatarPreview() {
  avatarPreview.value = null
  if (!profile.avatar_url) return
  // if stored as path in storage (contains '/'), create signed url
  if (typeof profile.avatar_url === 'string' && profile.avatar_url.includes('/')) {
    try {
      const { data, error: urlErr } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(profile.avatar_url, 60)
      if (!urlErr && data?.signedURL) {
        avatarPreview.value = data.signedURL
        return
      }
    } catch (err) {
      console.warn('createSignedUrl err', err)
    }
  }
  // otherwise treat as normal URL
  avatarPreview.value = profile.avatar_url
}

function triggerFile() {
  fileRef.value?.click()
}

async function onFileChange(e) {
  const f = e.target.files?.[0]
  if (!f) return
  msg.value = ''
  error.value = ''
  try {
    const { data } = await supabase.auth.getSession()
    const user = data?.session?.user
    if (!user) { error.value = '未登录'; return }
    const path = `${user.id}/${Date.now()}-${f.name}`
    const { data: upData, error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, f, { upsert: true })
    if (upErr) throw upErr

    // save path to profiles table
    const payload = { id: user.id, avatar_url: path, full_name: profile.full_name, bio: profile.bio, timezone: profile.timezone }
    const { error: upProfileErr } = await supabase.from('profiles').upsert(payload)
    if (upProfileErr) throw upProfileErr

    profile.avatar_url = path
    await resolveAvatarPreview()
    msg.value = '头像上传成功'
  } catch (err) {
    console.error('upload avatar', err)
    error.value = '上传失败: ' + (err?.message || err)
  } finally {
    if (fileRef.value) fileRef.value.value = ''
  }
}

async function saveAvatarFromUrl() {
  if (!avatarUrlInput.value || !avatarUrlInput.value.trim()) { error.value = '请输入图片 URL'; return }
  urlSaving.value = true
  error.value = ''
  try {
    const { data } = await supabase.auth.getSession()
    const user = data?.session?.user
    if (!user) { error.value = '请先登录'; urlSaving.value = false; return }
    // Save full URL in profiles.avatar_url (no RLS issue)
    const payload = { id: user.id, avatar_url: avatarUrlInput.value.trim(), full_name: profile.full_name, bio: profile.bio, timezone: profile.timezone }
    const { error: e } = await supabase.from('profiles').upsert(payload)
    if (e) throw e
    profile.avatar_url = avatarUrlInput.value.trim()
    await resolveAvatarPreview()
    msg.value = '头像已更新'
    showUrlModal.value = false
    avatarUrlInput.value = ''
  } catch (err) {
    console.error('saveAvatarFromUrl', err)
    error.value = '保存失败: ' + (err?.message || err)
  } finally {
    urlSaving.value = false
  }
}

async function removeAvatar() {
  if (!confirm('确认移除头像？')) return
  removing.value = true
  try {
    const { data } = await supabase.auth.getSession()
    const user = data?.session?.user
    if (!user) { removing.value = false; return }
    // clear profile.avatar_url; do not delete storage file automatically
    const { error } = await supabase.from('profiles').upsert({ id: user.id, avatar_url: null, full_name: profile.full_name, bio: profile.bio, timezone: profile.timezone })
    if (error) throw error
    profile.avatar_url = null
    avatarPreview.value = null
    msg.value = '头像已移除'
  } catch (err) {
    console.error('removeAvatar', err)
    error.value = '移除失败: ' + (err?.message || err)
  } finally {
    removing.value = false
  }
}

async function save() {
  saving.value = true
  error.value = ''
  msg.value = ''
  try {
    const { data } = await supabase.auth.getSession()
    const user = data?.session?.user
    if (!user) { error.value = '请先登录'; saving.value = false; return }
    const payload = { id: user.id, full_name: profile.full_name, bio: profile.bio, timezone: profile.timezone, avatar_url: profile.avatar_url || null }
    const { error: e } = await supabase.from('profiles').upsert(payload)
    if (e) throw e
    msg.value = '已保存'
    await loadProfile()
    // notify other components if needed
    window.dispatchEvent(new Event('profile-updated'))
  } catch (err) {
    console.error('save profile', err)
    error.value = '保存失败: ' + (err?.message || err)
  } finally {
    saving.value = false
  }
}

function reload() { loadProfile() }

onMounted(() => {
  loadProfile()
})
</script>

<style scoped>
.input { width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem; border: 1px solid #e6e9ef; background: #fff; }
.btn { display:inline-flex; align-items:center; gap:0.5rem; padding:0.5rem 0.85rem; border-radius:0.6rem; background:#2563EB; color:#fff; }
.card { background:#fff; border-radius:14px; box-shadow: 0 8px 28px rgba(16,24,40,0.06); }
.modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.28); display:flex; align-items:center; justify-content:center; z-index:60; }
.modal-panel { background:#fff; border-radius:12px; padding:1.25rem; width:100%; max-width:520px; box-shadow:0 12px 40px rgba(16,24,40,0.12); }
</style>