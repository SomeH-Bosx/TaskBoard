<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal-panel max-w-lg">
      <h3 class="text-xl font-semibold mb-3">任务时间已到</h3>
      <p class="text-sm text-slate-600 mb-3">任务预计时间已到，你要如何处理？</p>

      <div class="space-y-3">
        <div>
          <label class="text-sm">如果完成，请写下任务总结（选填）</label>
          <textarea v-model="summary" class="input" rows="4" placeholder="写下这次任务的感想或总结"></textarea>
        </div>

        <div>
          <label class="text-sm">延长时长（分钟）</label>
          <input type="number" v-model.number="extraMinutes" min="1" class="input" />
        </div>

        <div class="flex justify-end gap-3 mt-3">
          <button class="btn bg-slate-200 text-slate-800" @click="skip">暂不处理</button>
          <button class="btn" @click="extend">延长并继续执行</button>
          <button class="btn bg-green-600" @click="finish">确认完成</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const emit = defineEmits(['close','finish','extend','skip'])
const summary = ref('')
const extraMinutes = ref(10)

function close() { emit('close') }
function finish() { emit('finish', { summary: summary.value }) }
function extend() { emit('extend', { extraMinutes: extraMinutes.value }) }
function skip() { emit('skip') }
</script>