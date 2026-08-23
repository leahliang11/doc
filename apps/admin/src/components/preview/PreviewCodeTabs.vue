<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  tabs?: { label: string; code: string }[]
}>()

const tabs = computed(() => (Array.isArray(props.tabs) ? props.tabs : []))
const activeIdx = ref(0)
const copied = ref<string | null>(null)

function select(idx: number) {
  activeIdx.value = idx
}

async function copy(label: string, code: string) {
  try {
    await navigator.clipboard.writeText(code)
    copied.value = label
    setTimeout(() => (copied.value = null), 2000)
  } catch {
    /* 预览环境剪贴板不可用，忽略 */
  }
}
</script>

<template>
  <div class="pv-codetabs" v-if="tabs.length">
    <div class="pv-codetabs-bar">
      <button
        v-for="(tab, i) in tabs"
        :key="tab.label"
        :class="['pv-codetab-btn', { active: i === activeIdx }]"
        @click="select(i)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="pv-codetab-panel" v-for="(tab, i) in tabs" :key="tab.label" v-show="i === activeIdx">
      <button class="pv-codetab-copy" :title="copied === tab.label ? '已复制' : '复制'" @click="copy(tab.label, tab.code)">
        <svg v-if="copied === tab.label" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0a8" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <pre class="pv-codetab-pre"><code>{{ tab.code }}</code></pre>
    </div>
  </div>
</template>
