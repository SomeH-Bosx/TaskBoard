<template>
  <header class="bg-white/70 backdrop-blur sticky top-0 z-50 border-b">
    <div class="app-container flex items-center justify-between py-4">
      <router-link to="/" class="flex items-center gap-3">
        <!-- 内嵌 SVG logo（无需外部文件） -->
        <span class="w-10 h-10 rounded bg-primary flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-white">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" />
            <path d="M7 12h10M7 8h10M7 16h6" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>

        <div>
          <div class="text-xl font-extrabold text-primary">TaskBoard</div>
          <div class="text-xs text-slate-400 -mt-1">轻量 · 高效 · 可视化</div>
        </div>
      </router-link>

      <nav class="flex items-center gap-4">
        <!-- 永远显示的导航项，确保用户能从统计返回看板 -->
        <router-link to="/board" class="text-sm text-slate-600 hover:text-primary">看板</router-link>
        <router-link to="/stats" class="text-sm text-slate-600 hover:text-primary">统计</router-link>
        <router-link to="/contact" class="text-sm text-slate-600 hover:text-primary">联系我们</router-link>

        <!-- 登录前 / 登录后 不同显示 -->
        <div v-if="!user" class="ml-4">
          <router-link to="/login" class="btn">注册 / 登录</router-link>
        </div>

        <div v-else class="ml-4 flex items-center gap-3">
          <!-- 显示用户名 & 头像 & 下拉简单操作 -->
          <router-link to="/profile" class="flex items-center gap-2">
            <img v-if="avatar" :src="avatar" alt="avatar" class="w-8 h-8 rounded-full object-cover" />
            <div class="text-sm text-slate-700">{{ displayName }}</div>
          </router-link>

          <button @click="onLogout" class="text-sm text-slate-600 hover:text-red-600">登出</button>
        </div>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

const router = useRouter()
const user = ref(null)
const profile = ref(null)
const avatar = ref(null)
const displayName = ref('')

// load current session user + profile
async function loadUserAndProfile() {
  try {
    const { data } = await supabase.auth.getSession()
    const u = data?.session?.user ?? null
    user.value = u
    if (!u) {
      profile.value = null
      avatar.value = null
      displayName.value = ''
      return
    }
    // fetch profile row
    const { data: p, error } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', u.id).single()
    if (!error && p) {
      profile.value = p
      displayName.value = p.full_name || (u.email ? u.email.split('@')[0] : '用户')
      // handle avatar: if stored as storage path (contains '/'), generate signed url; else use as-is
      if (p.avatar_url && p.avatar_url.includes('/')) {
        try {
          const { data: urlData, error: urlErr } = await supabase.storage.from('avatars').createSignedUrl(p.avatar_url, 60)
          if (!urlErr && urlData?.signedURL) avatar.value = urlData.signedURL
          else avatar.value = p.avatar_url
        } catch (err) {
          avatar.value = p.avatar_url
        }
      } else {
        avatar.value = p.avatar_url || null
      }
    } else {
      displayName.value = u.email ? u.email.split('@')[0] : '用户'
    }
  } catch (err) {
    console.error('loadUserAndProfile error', err)
  }
}

async function onLogout() {
  await supabase.auth.signOut()
  // clear local info
  user.value = null
  profile.value = null
  avatar.value = null
  displayName.value = ''
  router.push('/login')
}

// listen auth changes
let { data: listener } = { data: null }
onMounted(async () => {
  await loadUserAndProfile()
  listener = supabase.auth.onAuthStateChange((event, session) => {
    // reload profile when auth changes
    loadUserAndProfile()
  })
})

onUnmounted(() => {
  if (listener && typeof listener.data !== 'undefined' && listener.data?.subscription) {
    try { listener.data.subscription.unsubscribe() } catch(e) {}
  }
})
</script>

<style scoped>
.bg-primary { background-color: #2563EB; }
.text-primary { color: #2563EB; }
.btn { @apply inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-sm; background-color: #2563EB; }
</style>