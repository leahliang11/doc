<script setup lang="ts">
import { computed } from 'vue'

interface NextStepItem {
  title: string
  description: string
  href: string
}

const props = defineProps<{
  items?: NextStepItem[]
}>()

const items = computed<NextStepItem[]>(() => (Array.isArray(props.items) ? props.items : []))
</script>

<template>
  <div class="pv-nextsteps" v-if="items.length">
    <a
      v-for="item in items"
      :key="item.href"
      :href="item.href"
      target="_blank"
      rel="noopener"
      class="pv-nextstep-card"
    >
      <h3 class="pv-nextstep-title">{{ item.title }}</h3>
      <p class="pv-nextstep-desc">{{ item.description }}</p>
      <svg class="pv-nextstep-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
    </a>
  </div>
</template>
