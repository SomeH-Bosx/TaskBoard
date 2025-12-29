<template>
  <div>
    <Navbar />
    <div class="app-container py-12">
      <div class="grid md:grid-cols-2 gap-8 items-start">
        <div class="space-y-4">
          <h2 class="text-3xl font-bold">联系我们</h2>
          <p class="text-slate-600">有问题、合作或定制需求？请通过下面联系方式与我们联系。以下为示例信息（演示用）。</p>

          <div class="card p-4">
            <h4 class="font-semibold">客服邮箱</h4>
            <div class="text-sm text-slate-700">support@taskboard.example</div>
          </div>

          <div class="card p-4">
            <h4 class="font-semibold">销售咨询</h4>
            <div class="text-sm text-slate-700">sales@taskboard.example</div>
            <div class="text-xs text-slate-500 mt-1">工作日 9:00 - 18:00</div>
          </div>

          <div class="card p-4">
            <h4 class="font-semibold">公司地址（示例）</h4>
            <div class="text-sm text-slate-700">上海市静安区示例路 100 号</div>
          </div>
        </div>

        <div>
          <div class="card p-6">
            <h4 class="font-semibold mb-2">在线留言（示例表单）</h4>
            <input v-model="name" placeholder="你的姓名" class="input mb-2" />
            <input v-model="email" placeholder="联系邮箱" class="input mb-2" />
            <textarea v-model="message" placeholder="留言内容" class="input mb-2" rows="6"></textarea>
            <div class="flex justify-end gap-2">
              <button class="btn bg-slate-200 text-slate-800" @click="reset">重置</button>
              <button class="btn" @click="submit">发送留言</button>
            </div>
            <div v-if="sent" class="text-sm text-green-600 mt-3">已发送（示例） — 我们会尽快联系你。</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import Navbar from '../components/Navbar.vue'
import { ref } from 'vue'

const name = ref('')
const email = ref('')
const message = ref('')
const sent = ref(false)

function submit() {
  // 示例行为：本地模拟发送（实际可调用后端邮件 API）
  if (!email.value || !message.value) { alert('请填写邮箱和留言'); return }
  sent.value = true
  setTimeout(() => { sent.value = false; name.value = ''; email.value = ''; message.value = '' }, 2000)
}

function reset() { name.value=''; email.value=''; message.value=''; sent.value=false }
</script>