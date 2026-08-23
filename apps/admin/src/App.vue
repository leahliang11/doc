<script setup lang="ts">
import { ref, computed } from 'vue'
import Sidebar from './components/Sidebar.vue'
import DocsView from './views/DocsView.vue'
import PlaceholderView from './views/PlaceholderView.vue'

const currentRoute = ref('/docs')

const navGroups = [
  {
    title: '工作台',
    items: [{ path: '/dashboard', label: '工作台', icon: 'ri-dashboard-line' }],
  },
  {
    title: '内容',
    items: [
      { path: '/docs', label: '文档', icon: 'ri-file-list-3-line' },
      { path: '/review', label: '审核队列', icon: 'ri-checkbox-line' },
      { path: '/publish', label: '发布记录', icon: 'ri-rocket-line' },
    ],
  },
  {
    title: '其他',
    items: [{ path: '/todo', label: '待办', icon: 'ri-feedback-line' }],
  },
]

const labels: Record<string, string> = {
  '/dashboard': '工作台',
  '/review': '审核队列',
  '/publish': '发布记录',
  '/todo': '待办',
}

function navigate(path: string) {
  currentRoute.value = path
}

const currentLabel = computed(() => labels[currentRoute.value] || '文档')
</script>

<template>
  <div class="app-layout">
    <Sidebar :route="currentRoute" :nav-groups="navGroups" @navigate="navigate" />
    <main class="main-content">
      <header class="main-header">
        <h1 class="main-title">{{ currentLabel }}</h1>
      </header>
      <div class="main-body">
        <DocsView v-if="currentRoute === '/docs'" />
        <PlaceholderView v-else :label="currentLabel" />
      </div>
    </main>
  </div>
</template>
