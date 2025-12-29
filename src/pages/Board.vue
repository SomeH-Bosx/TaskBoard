<template>
  <div>
    <Navbar />

    <div class="app-container mt-8">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-4">
          <input v-model="query" placeholder="搜索任务..." class="input w-72" />
          <div class="flex items-center gap-2">
            <button :class="view==='board' ? 'btn' : 'btn bg-slate-200 text-slate-800'" @click="view='board'">看板</button>
            <button :class="view==='list' ? 'btn' : 'btn bg-slate-200 text-slate-800'" @click="view='list'">列表</button>
            <button class="btn" @click="openNew">新增任务</button>
          </div>
        </div>
        <div>
          <button class="btn bg-slate-200 text-slate-800" @click="loadTasks">刷新</button>
        </div>
      </div>

      <div v-if="view==='board'" class="grid grid-cols-3 gap-4">
        <div v-for="col in columns" :key="col.status">
          <div class="col-header">
            <div>{{ col.title }}</div>
            <div class="text-xs text-slate-400">{{ (tasksByStatus[col.status] || []).length }}</div>
          </div>

          <div class="space-y-3">
            <draggable
              v-model="tasksByStatus[col.status]"
              :group="{ name: 'tasks' }"
              item-key="id"
              :animation="180"
              :ghost-class="'drag-ghost'"
              :chosen-class="'drag-chosen'"
              :fallbackOnBody="true"
              @start="onDragStart"
              @end="onDragEnd"
            >
              <template #item="{ element }">
                <TaskCard :task="element" @open="openDetail" @delete="removeTask" />
              </template>
            </draggable>
          </div>
        </div>
      </div>

      <!-- 列表视图 -->
      <div v-if="view==='list'" class="space-y-3">
        <div v-for="t in filteredTasks" :key="t.id" class="card flex items-center justify-between">
          <div>
            <div class="font-medium">{{ t.title }}</div>
            <div class="text-xs text-slate-500">{{ t.description }}</div>
          </div>
          <div class="flex items-center gap-3">
            <div class="text-sm text-slate-500">{{ t.status }}</div>
            <button class="btn" @click="openDetail(t)">详情</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <TaskModal
      v-if="editing"
      :modelValue="editing"
      @update:modelValue="val => editing = val"
      @saved="loadTasks"
    />
    <TaskDetail
      v-if="detailTask"
      :task="detailTask"
      @close="closeDetail"
      @saved="loadTasks"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar.vue'
import TaskCard from '../components/TaskCard.vue'
import TaskModal from '../components/TaskModal.vue'
import TaskDetail from '../components/TaskDetail.vue'
import draggable from 'vuedraggable'
import { useRouter } from 'vue-router'

const columns = [
  { status: 'todo', title: '待办' },
  { status: 'inprogress', title: '进行中' },
  { status: 'done', title: '已完成' }
]

const tasks = ref([])
const query = ref('')
const editing = ref(null)
const detailTask = ref(null)
const view = ref('board')
const router = useRouter()

async function getUser() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.user ?? null
}

async function loadTasks() {
  const user = await getUser()
  if (!user) { router.push('/'); return }
  const { data } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('order_index', { ascending: true })
  tasks.value = data || []
}

onMounted(loadTasks)

function openNew() {
  getUser().then(u => {
    editing.value = { title: '', description: '', status: 'todo', priority: 2, user_id: u?.id ?? null }
  })
}

function openDetail(t) {
  detailTask.value = { ...t }
}

function closeDetail() {
  detailTask.value = null
}

async function removeTask(t) {
  if (!confirm('确认删除？')) return
  await supabase.from('tasks').delete().eq('id', t.id)
  // optimistic remove
  tasks.value = tasks.value.filter(x => x.id !== t.id)
}

let dragOrigin = null
function onDragStart(evt) {
  dragOrigin = evt
}
async function onDragEnd(evt) {
  // optimistic: update local tasks order and statuses
  // Build updates for changed items only
  const updates = []
  for (const col of columns) {
    const arr = tasksByStatus.value[col.status] || []
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i]
      if (item.status !== col.status || item.order_index !== i) {
        // update local
        item.status = col.status
        item.order_index = i
        updates.push({ id: item.id, status: col.status, order_index: i })
      }
    }
  }
  // send batched updates (non-blocking, handle errors)
  try {
    await Promise.all(updates.map(u => supabase.from('tasks').update({ status: u.status, order_index: u.order_index }).eq('id', u.id)))
  } catch (err) {
    console.error('drag save error', err)
    // if failed, reload tasks
    loadTasks()
  }
}

function reloadTasks() { loadTasks() }

const tasksByStatus = computed(() => {
  const q = query.value.toLowerCase().trim()
  const filtered = tasks.value.filter(t => !q || (t.title + ' ' + (t.description || '')).toLowerCase().includes(q))
  const map = { todo: [], inprogress: [], done: [] }
  for (const t of filtered) {
    if (!map[t.status]) map[t.status] = []
    map[t.status].push(t)
  }
  // sort by order_index
  Object.keys(map).forEach(k => {
    map[k].sort((a,b) => (a.order_index||0)-(b.order_index||0))
  })
  return map
})

const filteredTasks = computed(() => tasks.value.filter(t => !query.value || (t.title + ' ' + (t.description || '')).toLowerCase().includes(query.value.toLowerCase())))

</script>

<style>
.drag-ghost { opacity: 0.6; transform: scale(0.98); }
.drag-chosen { box-shadow: 0 20px 40px rgba(16,24,40,0.18); transform: translateY(-6px); }
</style>