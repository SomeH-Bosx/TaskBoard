<template>
  <div>
    <Navbar />
    <div class="app-container mt-8">
      <div class="flex items-center justify-between gap-4 mb-6">
        <h2 class="text-2xl font-semibold">统计面板（增强）</h2>

        <div class="flex items-center gap-3">
          <router-link to="/board" class="btn bg-slate-200 text-slate-800">返回看板</router-link>

          <select v-model="range" class="input">
            <option value="7">最近7天</option>
            <option value="30">最近30天</option>
            <option value="90">最近90天</option>
            <option value="365">最近一年</option>
            <option value="all">全部</option>
          </select>

          <button class="btn" @click="load">刷新</button>
          <button class="btn bg-slate-200 text-slate-800" @click="exportCSV">导出 CSV</button>
        </div>
      </div>

      <!-- KPIs -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="card p-4">
          <div class="text-sm text-slate-500">总任务</div>
          <div class="text-2xl font-bold">{{ metrics.total }}</div>
        </div>
        <div class="card p-4">
          <div class="text-sm text-slate-500">完成率</div>
          <div class="text-2xl font-bold text-green-600">{{ metrics.completionRate }}%</div>
        </div>
        <div class="card p-4">
          <div class="text-sm text-slate-500">平均完成 (min)</div>
          <div class="text-2xl font-bold">{{ metrics.avgCompletion }}</div>
        </div>
        <div class="card p-4">
          <div class="text-sm text-slate-500">按时完成率</div>
          <div class="text-2xl font-bold">{{ metrics.onTimeRate }}%</div>
        </div>
      </div>

      <!-- Charts row -->
      <div class="grid md:grid-cols-3 gap-4 mb-6">
        <div class="card p-4">
          <div class="text-sm text-slate-500 mb-2">状态分布</div>
          <canvas ref="statusChart"></canvas>
        </div>

        <div class="card p-4">
          <div class="text-sm text-slate-500 mb-2">优先级分布</div>
          <canvas ref="priorityChart"></canvas>
        </div>

        <div class="card p-4">
          <div class="text-sm text-slate-500 mb-2">完成趋势</div>
          <canvas ref="trendChart"></canvas>
        </div>
      </div>

      <!-- Time distribution + detailed task list -->
      <div class="grid md:grid-cols-3 gap-4">
        <div class="card p-4 md:col-span-2">
          <div class="text-sm text-slate-500 mb-2">任务明细（最近 {{ tasks.length }} 条）</div>

          <div class="overflow-auto max-h-96">
            <table class="w-full text-sm">
              <thead class="text-slate-500 text-left">
                <tr>
                  <th class="p-2">标题</th>
                  <th class="p-2">状态</th>
                  <th class="p-2">优先</th>
                  <th class="p-2">预计(分)</th>
                  <th class="p-2">开始</th>
                  <th class="p-2">完成</th>
                  <th class="p-2">时长(min)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in tasks" :key="t.id" class="border-t">
                  <td class="p-2">{{ t.title }}</td>
                  <td class="p-2">{{ t.status }}</td>
                  <td class="p-2">{{ priorityText(t.priority) }}</td>
                  <td class="p-2">{{ t.estimated_minutes ?? '—' }}</td>
                  <td class="p-2">{{ t.started_at ? new Date(t.started_at).toLocaleString() : '—' }}</td>
                  <td class="p-2">{{ t.completed_at ? new Date(t.completed_at).toLocaleString() : '—' }}</td>
                  <td class="p-2">{{ Math.round((t.duration_seconds || 0) / 60) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card p-4">
          <div class="text-sm text-slate-500 mb-2">时间分布（实际用时）</div>
          <canvas ref="timeHistogram"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Navbar from '../components/Navbar.vue'
import { supabase } from '../lib/supabase'
import Chart from 'chart.js/auto'
import dayjs from 'dayjs'
import { saveAs } from 'file-saver'

const range = ref('30')
const tasks = ref([])

const statusChart = ref(null)
const priorityChart = ref(null)
const trendChart = ref(null)
const timeHistogram = ref(null)
let sInst, pInst, trInst, hInst = null

const metrics = ref({ total: 0, completionRate: 0, avgCompletion: 0, onTimeRate: 0 })

function priorityText(p) { return p === 1 ? '高' : p === 3 ? '低' : '中' }

async function fetchTasks() {
  const { data: sessionData } = await supabase.auth.getSession()
  const user = sessionData?.session?.user
  if (!user) return []
  let q = supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500)
  if (range.value !== 'all') {
    const days = parseInt(range.value, 10)
    q = supabase.from('tasks').select('*').eq('user_id', user.id).gte('created_at', dayjs().subtract(days, 'day').toISOString()).order('created_at', { ascending: false }).limit(500)
  }
  const { data } = await q
  return data || []
}

function computeMetrics(arr) {
  const total = arr.length
  const done = arr.filter(t => t.status === 'done')
  const completionRate = total ? Math.round((done.length / total) * 100) : 0
  const avgCompletion = done.length ? Math.round((done.reduce((s,t)=> s + ((t.duration_seconds||0)/60),0)/done.length)) : 0

  // on-time
  let onTimeCount = 0
  done.forEach(t => {
    if (t.estimated_minutes && t.started_at && t.completed_at) {
      const start = new Date(t.started_at).getTime()
      const comp = new Date(t.completed_at).getTime()
      const deadline = start + (t.estimated_minutes * 60 * 1000)
      if (comp <= deadline) onTimeCount++
    } else if (t.due_at && t.completed_at) {
      if (new Date(t.completed_at).getTime() <= new Date(t.due_at).getTime()) onTimeCount++
    }
  })
  const onTimeRate = done.length ? Math.round((onTimeCount / done.length) * 100) : 0

  return { total, completionRate, avgCompletion, onTimeRate }
}

function drawStatus(arr) {
  const labels = ['待办','进行中','已完成','逾期']
  const data = [arr.filter(t=>t.status==='todo').length, arr.filter(t=>t.status==='inprogress').length, arr.filter(t=>t.status==='done').length, arr.filter(t=>t.status==='overdue').length]
  if (sInst) sInst.destroy()
  sInst = new Chart(statusChart.value, { type: 'doughnut', data: { labels, datasets:[{ data, backgroundColor: ['#F59E0B','#06B6D4','#10B981','#EF4444'] }] }, options: { cutout: '65%' } })
}

function drawPriority(arr) {
  const by = { high:0, mid:0, low:0 }
  arr.forEach(t => t.priority===1 ? by.high++ : t.priority===3 ? by.low++ : by.mid++ )
  if (pInst) pInst.destroy()
  pInst = new Chart(priorityChart.value, { type:'bar', data:{ labels:['高','中','低'], datasets:[{ label:'数量', data:[by.high,by.mid,by.low], backgroundColor:['#ef4444','#2563EB','#10B981'] }]}, options:{indexAxis:'y'} })
}

function drawTrend(arr) {
  const map = {}
  arr.forEach(t => {
    const d = (t.created_at||'').slice(0,10) || dayjs().format('YYYY-MM-DD')
    map[d] = (map[d]||0) + 1
  })
  const labels = Object.keys(map).sort()
  const data = labels.map(l => map[l])
  if (trInst) trInst.destroy()
  trInst = new Chart(trendChart.value, { type:'line', data:{ labels, datasets:[{ label:'新增任务', data, borderColor:'#2563EB', backgroundColor:'rgba(37,99,235,0.08)', fill:true, tension:0.3 }]}, options:{responsive:true} })
}

function drawHistogram(arr) {
  // bucket durations (minutes)
  const durations = arr.map(t => Math.round((t.duration_seconds||0)/60)).filter(n => n>0)
  if (!durations.length) {
    if (hInst) hInst.destroy()
    hInst = new Chart(timeHistogram.value, { type:'bar', data:{ labels:['无数据'], datasets:[{ data:[0], backgroundColor:'#2563EB' }] } })
    return
  }
  const buckets = [0,15,30,60,120,300]
  const labels = ['<15','15-30','30-60','60-120','120+']
  const counts = [0,0,0,0,0]
  durations.forEach(m => {
    if (m < 15) counts[0]++
    else if (m < 30) counts[1]++
    else if (m < 60) counts[2]++
    else if (m < 120) counts[3]++
    else counts[4]++
  })
  if (hInst) hInst.destroy()
  hInst = new Chart(timeHistogram.value, { type:'bar', data:{ labels, datasets:[{ label:'分钟', data:counts, backgroundColor:'#2563EB' }]}, options:{responsive:true} })
}

async function load() {
  tasks.value = await fetchTasks()
  const m = computeMetrics(tasks.value)
  metrics.value = { total: m.total, completionRate: m.completionRate, avgCompletion: m.avgCompletion, onTimeRate: m.onTimeRate }
  drawStatus(tasks.value)
  drawPriority(tasks.value)
  drawTrend(tasks.value)
  drawHistogram(tasks.value)
}

function exportCSV() {
  const rows = tasks.value.map(t => ({
    id: t.id, title: t.title, status: t.status, priority: t.priority,
    estimated_minutes: t.estimated_minutes, duration_minutes: Math.round((t.duration_seconds||0)/60),
    created_at: t.created_at, completed_at: t.completed_at
  }))
  if (!rows.length) { alert('没有数据'); return }
  const header = Object.keys(rows[0]).join(',') + '\n'
  const body = rows.map(r => Object.values(r).map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `tasks-stats-${new Date().toISOString().slice(0,10)}.csv`)
}

onMounted(load)
</script>

<style scoped>
.card { background:#fff; border-radius:14px; box-shadow: 0 8px 28px rgba(16,24,40,0.06); }
.input { padding:0.4rem 0.6rem; border-radius:8px; border:1px solid #e6e9ef; }
.btn { padding:0.45rem 0.85rem; background:#2563EB; color:#fff; border-radius:8px; }
</style>