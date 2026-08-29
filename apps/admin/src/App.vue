<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import Sidebar from './components/Sidebar.vue'
import DocsView from './views/DocsView.vue'
import ReviewView from './views/ReviewView.vue'
import PublishView from './views/PublishView.vue'
import DashboardView from './views/DashboardView.vue'
import TodoView from './views/TodoView.vue'
import PlaceholderView from './views/PlaceholderView.vue'
import {
  checkAdminSession,
  clearStoredAdminToken,
  getStoredAdminToken,
  loginAdmin,
  listBuildTasks,
  runBuild,
  setStoredAdminToken,
  type BuildTask,
} from './api'

const currentRoute = ref('/docs')
const authReady = ref(false)
const authenticated = ref(false)
const loginUsername = ref('admin')
const loginPassword = ref('')
const loginError = ref('')
const loggingIn = ref(false)

async function verifyToken(token: string) {
  if (!token) return false
  try { return await checkAdminSession(token) } catch { return false }
}

async function login() {
  const username = loginUsername.value.trim()
  const password = loginPassword.value
  if (!username || !password || loggingIn.value) return
  loggingIn.value = true
  loginError.value = ''
  try {
    const token = await loginAdmin(username, password)
    setStoredAdminToken(token)
    authenticated.value = true
    loginPassword.value = ''
  } catch (e: any) {
    clearStoredAdminToken()
    loginError.value = e.message || '账号或密码不正确'
  }
  loggingIn.value = false
}

function logout() {
  clearStoredAdminToken()
  authenticated.value = false
  loginPassword.value = ''
}

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

onMounted(async () => {
  const token = getStoredAdminToken()
  authenticated.value = await verifyToken(token)
  if (!authenticated.value) clearStoredAdminToken()
  authReady.value = true
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

watch(authenticated, (active) => {
  if (buildTimer) clearInterval(buildTimer)
  buildTimer = null
  if (active) {
    loadPendingBuilds()
    buildTimer = setInterval(loadPendingBuilds, 15000)
  }
}, { immediate: true })
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
  <div v-if="!authReady" class="auth-loading">正在验证访问权限…</div>
  <div v-else-if="!authenticated" class="auth-page">
    <form class="auth-card" @submit.prevent="login">
      <div class="auth-mark"><i class="ri-book-open-line"></i></div>
      <h1>JoyMaaS 文档后台</h1>
      <p>请输入管理员账号和密码后继续。</p>
      <label for="admin-username">账号</label>
      <input
        id="admin-username"
        v-model="loginUsername"
        type="text"
        autocomplete="username"
        placeholder="输入账号"
        autofocus
      />
      <label for="admin-password">密码</label>
      <input
        id="admin-password"
        v-model="loginPassword"
        type="password"
        autocomplete="current-password"
        placeholder="输入密码"
      />
      <span v-if="loginError" class="auth-error">{{ loginError }}</span>
      <button type="submit" :disabled="loggingIn || !loginUsername.trim() || !loginPassword">
        {{ loggingIn ? '验证中…' : '进入后台' }}
      </button>
    </form>
  </div>
  <div v-else class="app-layout">
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
          <button class="theme-toggle" title="退出后台" @click="logout">
            <i class="ri-logout-box-r-line"></i>
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
.auth-loading,
.auth-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: var(--bg-page);
  color: var(--text-secondary);
}
.auth-card {
  width: min(380px, calc(100vw - 32px));
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-card);
  padding: 28px;
  box-shadow: var(--shadow-md);
}
.auth-mark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 19px;
}
.auth-card h1 { margin: 18px 0 6px; font-size: 20px; color: var(--text); }
.auth-card p { margin: 0 0 22px; font-size: 13px; color: var(--text-secondary); }
.auth-card label { display: block; margin-bottom: 7px; font-size: 12px; font-weight: 600; color: var(--text); }
.auth-card input {
  width: 100%; height: 38px; border: 1px solid var(--border); border-radius: 7px;
  padding: 0 11px; background: var(--bg-card); color: var(--text); outline: none;
}
.auth-card input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
.auth-card button {
  width: 100%; height: 38px; margin-top: 14px; border: 0; border-radius: 7px;
  background: var(--brand); color: #fff; font-weight: 600; cursor: pointer;
}
.auth-card button:disabled { opacity: .55; cursor: not-allowed; }
.auth-error { display: block; margin-top: 8px; font-size: 12px; color: var(--danger); }
.theme-toggle {
  margin-left: 0;
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
