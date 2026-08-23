<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  collapsible?: boolean
  title?: string
  childrenHtml?: string
}>()

const collapsible = computed(() => props.collapsible !== false) // 默认 true
const label = computed(() => props.title || '仅内部可见')
</script>

<template>
  <details v-if="collapsible" class="pv-internal">
    <summary>
      <svg class="pv-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <span class="pv-label">{{ label }}</span>
      <svg class="pv-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </summary>
    <div class="pv-internal-body" v-html="childrenHtml"></div>
  </details>
  <div v-else class="pv-internal-flat">
    <div class="pv-internal-flat-head">
      <svg class="pv-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <span class="pv-label">{{ label }}</span>
    </div>
    <div class="pv-internal-flat-body" v-html="childrenHtml"></div>
  </div>
</template>
