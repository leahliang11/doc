<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Sidebar from './components/Sidebar.vue'
import DocsView from './views/DocsView.vue'
import ReviewView from './views/ReviewView.vue'
import PublishView from './views/PublishView.vue'
import DashboardView from './views/DashboardView.vue'
import TodoView from './views/TodoView.vue'
import PlaceholderView from './views/PlaceholderView.vue'
import { listBuildTasks, runBuild, type BuildTask } from './api'

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

// 待构建（Week 6）
const pendingBuilds = ref<BuildTask[]>([])
const building = ref(false)
let buildTimer: ReturnType<typeof setInterval> | null = null

async function loadPendingBuilds() {
  try {
    pendingBuilds.value = await listBuildTasks('pending')
  } catch {
    /* ignore */
  }
}

async function triggerBuild() {
  if (building.value) return
  building.value = true
  try {
    await runBuild()
    // 轮询看构建是否完成
    const poll = setInterval(async () => {
      await loadPendingBuilds()
      // 看最新任务状态
      const all = await listBuildTasks('all')
      const latest = all[0]
      if (latest && (latest.status === 'done' || latest.status === 'failed')) {
        clearInterval(poll)
        building.value = false
        if (latest.status === 'done') {
          alert('构建完成')
        } else {
          alert('构建失败，见日志：\n' + (latest.log || '').slice(-500))
        }
        await loadPendingBuilds()
      }
    }, 3000)
  } catch (e: any) {
    building.value = false
    alert('触发构建失败：' + e.message)
  }
}

onMounted(() => {
  loadPendingBuilds()
  buildTimer = setInterval(loadPendingBuilds, 15000) // 15s 轮询待构建数
})
onUnmounted(() => {
  if (buildTimer) clearInterval(buildTimer)
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
        <div class="header-actions">
          <span v-if="pendingBuilds.length" class="build-badge" :title="`${pendingBuilds.length} 篇待构建`">
            <i class="ri-hammer-line"></i> {{ pendingBuilds.length }} 待构建
          </span>
          <button
            v-if="pendingBuilds.length || building"
            class="build-btn"
            :disabled="building"
            @click="triggerBuild"
          >
            <i :class="building ? 'ri-loader-4-line spin' : 'ri-play-line'"></i>
            {{ building ? '构建中…' : '立即构建' }}
          </button>
          <button class="theme-toggle" :title="isDark ? '切换浅色' : '切换深色'" @click="toggleDark">
            <i :class="isDark ? 'ri-sun-line' : 'ri-moon-line'"></i>
          </button>
        </div>
      </header>
      <div class="main-body">
        <DashboardView v-if="currentRoute === '/dashboard'" @navigate="navigate" />
        <DocsView v-else-if="currentRoute === '/docs'" />
        <ReviewView v-else-if="currentRoute === '/review'" />
        <PublishView v-else-if="currentRoute === '/publish'" @navigate="navigate" />
        <TodoView v-else-if="currentRoute === '/todo'" @navigate="navigate" />
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
.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.build-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  background: rgba(245, 166, 35, 0.1);
  color: #f5a623;
}
.build-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  font-size: 12px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.build-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
