<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTodos, type TodoGroup } from '../api'

const emit = defineEmits<{ navigate: [path: string] }>()

const todos = ref<TodoGroup | null>(null)
const loading = ref(true)
const error = ref('')
const expanded = ref<string | null>(null)

const sourceLabels: Record<string, string> = {
  web: 'PM 通道',
  gitlab_mr: '工程师 Git',
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    todos.value = await getTodos()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function toggle(key: string) {
  expanded.value = expanded.value === key ? null : key
}

onMounted(load)
</script>

<template>
  <div class="todo-view">
    <div v-if="loading" class="state">加载中…</div>
    <div v-else-if="error" class="state error">加载失败：{{ error }}</div>
    <template v-else-if="todos">
      <!-- 待审核 -->
      <div class="group">
        <div class="group-head" @click="toggle('pending')">
          <div class="group-title">
            <i class="ri-checkbox-line"></i> 待我审核
          </div>
          <div class="group-right">
            <span v-if="todos.pendingReviews.length" class="badge-warn">{{ todos.pendingReviews.length }}</span>
            <i :class="expanded === 'pending' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"></i>
          </div>
        </div>
        <div v-if="expanded === 'pending'" class="group-body">
          <div v-if="todos.pendingReviews.length" class="item-list">
            <div v-for="t in todos.pendingReviews" :key="t.id" class="item">
              <span :class="['source-tag', t.source]">{{ sourceLabels[t.source] || t.source }}</span>
              <span class="item-slug">{{ t.slug }}</span>
              <span class="item-user">{{ t.submitter }}</span>
              <button class="btn btn-sm btn-primary" @click="emit('navigate', '/review')">处理</button>
            </div>
          </div>
          <div v-else class="empty-inline">暂无待审核任务</div>
        </div>
      </div>

      <!-- 待构建 -->
      <div class="group">
        <div class="group-head" @click="toggle('build')">
          <div class="group-title">
            <i class="ri-hammer-line"></i> 待构建上线
          </div>
          <div class="group-right">
            <span v-if="todos.buildPending.length" class="badge-warn">{{ todos.buildPending.length }}</span>
            <i :class="expanded === 'build' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"></i>
          </div>
        </div>
        <div v-if="expanded === 'build'" class="group-body">
          <div v-if="todos.buildPending.length" class="item-list">
            <div v-for="b in todos.buildPending" :key="b.id" class="item">
              <span class="item-slug">{{ b.ref || 'main' }}</span>
              <span class="item-user muted">{{ b.source }}</span>
              <button class="btn btn-sm btn-primary" @click="emit('navigate', '/docs')">处理</button>
            </div>
          </div>
          <div v-else class="empty-inline">暂无待构建任务</div>
        </div>
      </div>

      <!-- 冲突（P0 降级）-->
      <div class="group">
        <div class="group-head" @click="toggle('conflict')">
          <div class="group-title">
            <i class="ri-alert-line"></i> 冲突草稿
          </div>
          <div class="group-right">
            <span class="badge-muted">0</span>
            <i :class="expanded === 'conflict' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"></i>
          </div>
        </div>
        <div v-if="expanded === 'conflict'" class="group-body">
          <p class="degraded-hint">P0 不做草稿冲突检测。保存时若遇冲突，后端会返回 409 并提示「用我的覆盖」或「放弃改动」。</p>
        </div>
      </div>

      <!-- AI 警告（P0 降级）-->
      <div class="group">
        <div class="group-head" @click="toggle('ai')">
          <div class="group-title">
            <i class="ri-sparkling-line"></i> AI 体检警告
          </div>
          <div class="group-right">
            <span class="badge-muted">0</span>
            <i :class="expanded === 'ai' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"></i>
          </div>
        </div>
        <div v-if="expanded === 'ai'" class="group-body">
          <p class="degraded-hint">P0 不持久化 AI 体检结果。在文档编辑器里点「文档体检」实时查看，结果不落库。</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.todo-view { display: flex; flex-direction: column; gap: 12px; }
.state { padding: 40px; text-align: center; color: var(--text-tertiary); }
.state.error { color: var(--danger, #e00); }
.group {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
}
.group-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; cursor: pointer;
}
.group-head:hover { background: var(--bg-hover); }
.group-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 500; color: var(--text);
}
.group-title i { font-size: 18px; color: var(--primary); }
.group-right { display: flex; align-items: center; gap: 8px; color: var(--text-tertiary); }
.badge-warn {
  padding: 2px 8px; border-radius: 4px; font-size: 11px;
  background: rgba(245, 166, 35, 0.1); color: #f5a623;
}
.badge-muted {
  padding: 2px 8px; border-radius: 4px; font-size: 11px;
  background: var(--bg-hover); color: var(--text-tertiary);
}
.group-body { padding: 0 16px 12px; }
.item-list { display: flex; flex-direction: column; }
.item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0; border-top: 1px solid var(--border-light); font-size: 13px;
}
.source-tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; }
.source-tag.web { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
.source-tag.gitlab_mr { background: rgba(0, 112, 243, 0.1); color: #0070f3; }
.item-slug { font-family: ui-monospace, monospace; font-size: 12px; color: var(--text); flex: 1; }
.item-user { font-size: 12px; color: var(--text-secondary); }
.muted { color: var(--text-tertiary); }
.empty-inline { padding: 16px 0; text-align: center; color: var(--text-tertiary); font-size: 13px; }
.degraded-hint {
  margin: 0; padding: 12px 0; font-size: 13px; color: var(--text-tertiary);
  line-height: 1.5;
}
.btn-sm { padding: 4px 10px; font-size: 12px; }
</style>
