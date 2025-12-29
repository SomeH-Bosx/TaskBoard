<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-surface overflow-x-hidden">
    <Navbar />

    <main class="app-container grid md:grid-cols-2 gap-10 items-center py-20">
      <section class="animate-fade-in">
        <h1 class="text-5xl font-extrabold leading-tight mb-4 text-slate-900">
          TaskBoard — 你的轻量任务与专注利器
        </h1>
        <p class="text-lg text-slate-600 mb-6">
          拖拽看板 · 任务倒计时与预计时长 · 附件、评论与子任务 · 可视化统计与实时同步
        </p>

        <ul class="space-y-3 text-slate-700 mb-6">
          <li class="flex items-start gap-3">
            <span class="badge">1</span>
            <div>拖拽排序，支持列表 / 看板 / 日历三视图，流畅动画体验</div>
          </li>
          <li class="flex items-start gap-3">
            <span class="badge">2</span>
            <div>为任务设置预计时长与倒计时，自动提醒并支持完成确认</div>
          </li>
          <li class="flex items-start gap-3">
            <span class="badge">3</span>
            <div>上传附件、评论协作、任务子项分解，提高协作效率</div>
          </li>
          <li class="flex items-start gap-3">
            <span class="badge">4</span>
            <div>仪表盘分析与 CSV 导出，支持按优先级 & 按时率过滤</div>
          </li>
        </ul>

        <div class="flex gap-4">
          <router-link to="/login" class="btn">立刻开始</router-link>
          <router-link to="/contact" class="btn bg-slate-200 text-slate-800">联系我们</router-link>
        </div>

        <div class="flex gap-6 mt-8 text-slate-600">
          <div>
            <div class="text-2xl font-bold text-primary">{{ liveUsers }}</div>
            <div class="text-sm">活跃用户</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-primary">{{ tasksCreated }}</div>
            <div class="text-sm">任务已创建</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-primary">{{ minutesSaved }}</div>
            <div class="text-sm">节省时间 (分钟)</div>
          </div>
        </div>
      </section>

      <aside class="relative">
        <div class="card p-6 shadow-lg animate-slide-up">
          <h3 class="text-lg font-semibold mb-2">实时演示</h3>
          <p class="text-sm text-slate-500 mb-4">登录后在个人看板创建任务并追踪进度 — 下面为功能预览（示例）</p>

          <div ref="mediaWrap" class="rounded-lg overflow-hidden border border-slate-100 demo-wrap">
            <div class="video-container">
              <video
                ref="demoVideo"
                class="w-full h-64 object-cover bg-slate-100"
                playsinline
                muted
                loop
                preload="none"
                :poster="posterUrl"
                @click="togglePlay"
              >
                <source v-if="hasWebm" :src="webmUrl" type="video/webm" />
                <source v-if="hasMp4" :src="mp4Url" type="video/mp4" />
                <!-- 浏览器不支持 video 时会显示 poster 或回退 img -->
              </video>

              <img v-if="showGifFallback" :src="gifUrl" class="w-full h-64 object-cover" />

              <button v-if="showPlayButton" @click.stop="onPlayBtn" class="play-btn" :title="isPlaying ? '暂停' : '播放'">
                <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M3 22v-20l18 10-18 10z"/></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              </button>
            </div>
          </div>

          <div class="mt-4 text-sm text-slate-600">支持播放/暂停，自动静音以便移动端自动播放。点击画面可切换播放状态。</div>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Navbar from '../components/Navbar.vue'

const webmUrl = '/demo/preview.webm'
const mp4Url = '/demo/preview.mp4'
const gifUrl = '/demo/preview.gif'
const defaultPoster = 'https://images.unsplash.com/photo-1557800636-894a64c1696f?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=3f0e9fd6e16b6c8f3f1efd28bd1a7e3e'

const demoVideo = ref(null)
const mediaWrap = ref(null)
const isPlaying = ref(false)
const showGifFallback = ref(false)
const showPlayButton = ref(true)
const posterUrl = ref(defaultPoster)
const hasMp4 = ref(false)
const hasWebm = ref(false)

const liveUsers = ref(420)
const tasksCreated = ref(1284)
const minutesSaved = ref(15240)

let observer = null

function togglePlay() {
  const v = demoVideo.value
  if (!v) return
  if (v.paused) {
    v.play().catch(()=>{})
    isPlaying.value = true
  } else {
    v.pause()
    isPlaying.value = false
  }
}
function onPlayBtn() { togglePlay() }

// helper: 检查本地 public/demo 文件是否存在（HEAD 请求）
async function checkUrlExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch (err) {
    return false
  }
}

onMounted(async () => {
  // 检查本地资源是否存在（如果存在则使用本地，否则回退到 defaultPoster / 不显示 source）
  hasMp4.value = await checkUrlExists(mp4Url)
  hasWebm.value = await checkUrlExists(webmUrl)
  const posterExists = await checkUrlExists('/demo/preview-poster.jpg')
  if (posterExists) posterUrl.value = '/demo/preview-poster.jpg'
  // 如果没有 video 源但有 gif，尝试显示 gif
  showGifFallback.value = !hasMp4.value && !hasWebm.value && await checkUrlExists(gifUrl)

  // IntersectionObserver 懒加载视频（当进入视口时把 video load/play）
  if (mediaWrap.value && demoVideo.value) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // 如果已有 source，load 并尝试播放
          const v = demoVideo.value
          if ((hasWebm.value || hasMp4.value) && v) {
            v.load()
            v.play().then(()=>{ isPlaying.value = true }).catch(()=>{ isPlaying.value = false })
          }
        } else {
          const v = demoVideo.value
          if (v && !v.paused) { v.pause(); isPlaying.value = false }
        }
      })
    }, { threshold: 0.25 })
    observer.observe(mediaWrap.value)
    demoVideo.value.addEventListener('play', ()=> isPlaying.value = true)
    demoVideo.value.addEventListener('pause', ()=> isPlaying.value = false)
  }
})

onBeforeUnmount(() => {
  if (observer && mediaWrap.value) observer.unobserve(mediaWrap.value)
})
</script>

<style scoped>
.video-container { position: relative; }
.play-btn {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: rgba(17,24,39,0.6);
  border-radius: 999px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}
.demo-wrap { max-width: 100%; height: 260px; }
@media (max-width: 640px) { .demo-wrap { height: 200px; } }
</style>