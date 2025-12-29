<template>
  <div>
    <div class="flex items-center gap-3 mb-3">
      <input type="file" ref="fileRef" @change="onFileChange" class="hidden" />
      <button class="btn" @click="pickFile" :disabled="uploading">{{ uploading ? '上传中...' : '上传附件' }}</button>
      <button class="btn bg-slate-200 text-slate-800" @click="loadAttachments">刷新</button>
    </div>

    <div v-if="error" class="text-sm text-red-600 mb-2">{{ error }}</div>

    <ul class="space-y-2">
      <li v-for="a in attachments" :key="a.id" class="p-3 bg-slate-50 rounded-md flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="text-sm font-medium">{{ filename(a.path) }}</div>
          <div class="text-xs text-slate-400">{{ formatDate(a.created_at) }}</div>
        </div>
        <div class="flex items-center gap-2">
          <a :href="signedUrlMap[a.path] || '#'" target="_blank" rel="noreferrer" class="text-primary text-sm" @click.prevent="download(a)">下载</a>
          <button class="text-sm text-red-500" @click="remove(a)" :disabled="deletingId===a.id">删除</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'

const props = defineProps({ taskId: { type: String, required: true } })
const fileRef = ref(null)
const attachments = ref([])
const loading = ref(false)
const uploading = ref(false)
const deletingId = ref(null)
const signedUrlMap = ref({})
const error = ref(null)
const bucket = 'attachments' // ensure this bucket exists

function filename(path) {
  const parts = path.split('/')
  return parts[parts.length - 1]
}
function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}

async function loadAttachments() {
  loading.value = true
  error.value = null
  try {
    const { data, error: e } = await supabase.from('attachments').select('*').eq('task_id', props.taskId).order('created_at', { ascending: false })
    if (e) throw e
    attachments.value = data || []
    // create signed url for each item (private bucket)
    for (const a of attachments.value) {
      try {
        const { data: urlData, error: urlErr } = await supabase.storage.from(a.bucket).createSignedUrl(a.path, 60)
        if (!urlErr && urlData?.signedURL) signedUrlMap.value[a.path] = urlData.signedURL
      } catch (err) {
        console.warn('signed url error', err)
      }
    }
  } catch (err) {
    console.error('load attachments error', err)
    error.value = err.message || String(err)
  } finally {
    loading.value = false
  }
}

function pickFile() {
  fileRef.value?.click()
}

async function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  uploading.value = true
  error.value = null
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData?.session?.user
    if (!user) throw new Error('未登录')

    // path: {userId}/{taskId}/{timestamp}-{filename}
    const path = `${user.id}/${props.taskId}/${Date.now()}-${file.name}`

    // upload to storage
    const { data: upData, error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false })
    if (upErr) throw upErr

    // insert metadata into attachments table (RLS allows user_id = auth.uid())
    const { error: metaErr } = await supabase.from('attachments').insert([{
      task_id: props.taskId,
      user_id: user.id,
      bucket,
      path,
      mime_type: file.type,
      size: file.size
    }])
    if (metaErr) throw metaErr

    await loadAttachments()
  } catch (err) {
    console.error('upload error', err)
    error.value = '上传失败: ' + (err?.message || String(err))
    alert(error.value)
  } finally {
    uploading.value = false
    if (fileRef.value) fileRef.value.value = ''
  }
}

async function download(a) {
  try {
    if (signedUrlMap.value[a.path]) {
      window.open(signedUrlMap.value[a.path], '_blank')
      return
    }
    const { data, error } = await supabase.storage.from(a.bucket).createSignedUrl(a.path, 60)
    if (error) throw error
    signedUrlMap.value[a.path] = data.signedURL
    window.open(data.signedURL, '_blank')
  } catch (err) {
    console.error('create signed url error', err)
    alert('获取下载链接失败')
  }
}

async function remove(a) {
  if (!confirm('确认删除附件？')) return
  deletingId.value = a.id
  try {
    // delete from storage then metadata
    const { error: delErr } = await supabase.storage.from(a.bucket).remove([a.path])
    if (delErr) throw delErr
    const { error: metaErr } = await supabase.from('attachments').delete().eq('id', a.id)
    if (metaErr) throw metaErr
    await loadAttachments()
  } catch (err) {
    console.error('delete attachment error', err)
    alert('删除失败: ' + (err?.message || err))
  } finally {
    deletingId.value = null
  }
}

onMounted(loadAttachments)
</script>