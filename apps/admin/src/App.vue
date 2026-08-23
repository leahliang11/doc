<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import DocsView from './views/DocsView.vue'
import ReviewView from './views/ReviewView.vue'
import PlaceholderView from './views/PlaceholderView.vue'

const currentRoute = ref('/docs')

// 暗色切换
const isDark = ref(false)
function toggleDark() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  try {
    localStorage.setItem('admin:theme', isDark.value ? 'dark' : 'light')
  } catch {
    /* ignore */
  }
}
onMounted(() => {
  try {
    const saved = localStorage.getItem('admin:theme')
    if (saved === 'dark') {
      isDark.value = true
      document.documentElement.classList.add('dark')
    }
  } catch {
    /* ignore */
  }
})

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
        <button class="theme-toggle" :title="isDark ? '切换浅色' : '切换深色'" @click="toggleDark">
          <i :class="isDark ? 'ri-sun-line' : 'ri-moon-line'"></i>
        </button>
      </header>
      <div class="main-body">
        <DocsView v-if="currentRoute === '/docs'" />
        <ReviewView v-else-if="currentRoute === '/review'" />
        <PlaceholderView v-else :label="currentLabel" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.theme-toggle {
  margin-left: auto;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.theme-toggle:hover {
  background: var(--bg-hover);
  color: var(--text);
}
</style>
