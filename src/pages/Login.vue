<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="w-full max-w-3xl app-container grid grid-cols-2 gap-8 items-center">
      <!-- 左侧：欢迎信息 -->
      <div>
        <h1 class="text-4xl font-extrabold mb-4">欢迎回到 TaskBoard</h1>
        <p class="text-slate-600 mb-6">高效管理你的任务，拖拽、倒计时、统计 — 现在就开始。</p>

        <div class="card">
          <div class="mb-3 text-sm text-slate-500">演示账户</div>
          <div class="flex items-center gap-3">
            <div class="font-medium">demo@demo.com</div>
            <div class="text-sm text-slate-500">/ 密码: DemoPass123!</div>
          </div>
          <div class="mt-4">
            <button class="btn" @click="useDemo">
              使用演示账户登录
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：登录表单 -->
      <div>
        <div class="card">
          <form @submit.prevent="login" class="space-y-4">
            <div>
              <label class="block text-sm mb-1">邮箱</label>
              <input v-model="email" type="email" class="input" placeholder="you@example.com" required />
            </div>

            <div>
              <label class="block text-sm mb-1">密码</label>
              <input v-model="password" type="password" class="input" placeholder="你的密码" required />
            </div>

            <div class="flex items-center justify-between">
              <div class="flex gap-2">
                <button @click.prevent="login" class="btn">登录</button>
                <button @click.prevent="signup" class="btn bg-slate-200 text-slate-800 hover:bg-slate-300">注册</button>
              </div>
              <div class="text-sm text-slate-500">忘记密码？</div>
            </div>

            <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useRouter } from 'vue-router'

const email = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()

async function login() {
  error.value = ''
  const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
  if (err) { error.value = err.message; return }
  router.push('/board')
}

async function signup() {
  error.value = ''
  const { data, error: err } = await supabase.auth.signUp({ email: email.value, password: password.value })
  if (err) { error.value = err.message; return }
  // 如果返回 user -> 创建 profile
  const user = data?.user ?? null
  if (user) await supabase.from('profiles').upsert([{ id: user.id, full_name: '' }])
  router.push('/board')
}

async function useDemo() {
  email.value = 'demo@demo.com'
  password.value = 'DemoPass123!'
  await login()
}
</script>