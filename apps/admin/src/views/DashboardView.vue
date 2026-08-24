<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getDashboardStats, type DashboardStats } from '../api'

const emit = defineEmits<{ navigate: [path: string] }>()

const stats = ref<DashboardStats | null>(null)
const loading = ref(true)
const error = ref('')

const sourceLabels: Record<string, string> = {
  web: 'PM 通道',
  gitlab_mr: '工程师 Git',
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    stats.value = await getDashboardStats()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function statusLabel(s: string): string {
  return { pending: '待审核', approved: '通过', rejected: '驳回', merged: '已合入' }[s] || s
}

onMounted(load)
</script>

<template>
  <div class="dash-view">
    <div v-if="loading" class="state">加载中…</div>
    <div v-else-if="error" class="state error">加载失败：{{ error }}</div>
    <template v-else-if="stats">
      <!-- 4 张统计卡片 -->
      <div class="cards">
        <div class="card" @click="emit('navigate', '/docs')">
          <div class="card-icon ri-file-list-3-line"></div>
          <div class="card-body">
            <div class="card-num">{{ stats.docsTotal }}</div>
            <div class="card-label">文档总数</div>
          </div>
        </div>

        <div class="card" @click="emit('navigate', '/review')">
          <div class="card-icon ri-checkbox-line"></div>
          <div class="card-body">
            <div class="card-num">{{ stats.pendingReview }}</div>
            <div class="card-label">待审核</div>
          </div>
        </div>

        <div class="card" @click="emit('navigate', '/publish')">
          <div class="card-icon ri-rocket-line"></div>
          <div class="card-body">
            <div class="card-num">{{ stats.publishedThisWeek }}</div>
            <div class="card-label">本周发布</div>
          </div>
        </div>

        <div class="card" @click="emit('navigate', '/todo')">
          <div class="card-icon ri-sparkling-line"></div>
          <div class="card-body">
            <div class="card-num">{{ stats.aiCallsThisWeek }}</div>
            <div class="card-label">AI 调用（累计）</div>
          </div>
        </div>
      </div>

      <div class="sections">
        <!-- 最近活动 -->
        <div class="section">
          <div class="section-head">
            <span class="section-title">最近活动</span>
            <button class="btn btn-sm refresh" @click="load">
              <i class="ri-refresh-line"></i> 刷新
            </button>
          </div>
          <div v-if="stats.recentEdits.length" class="activity-list">
            <div v-for="e in stats.recentEdits" :key="e.id" class="activity-row">
              <span :class="['source-tag', e.source]">{{ sourceLabels[e.source] || e.source }}</span>
              <span class="act-slug">{{ e.slug }}</span>
              <span class="act-status">{{ statusLabel(e.status) }}</span>
              <span class="act-user">{{ e.submitter }}</span>
              <span class="act-time muted">{{ (e.reviewed_at || e.created_at)?.slice(0, 16) }}</span>
            </div>
          </div>
          <div v-else class="empty-inline">暂无活动</div>
        </div>

        <!-- 待构建快捷入口 -->
        <div v-if="stats.buildPending" class="section">
          <div class="section-head">
            <span class="section-title">待构建</span>
            <span class="badge-warn">{{ stats.buildPending }} 篇</span>
          </div>
          <p class="hint">有 {{ stats.buildPending }} 篇文档变更待构建上线，点顶部「立即构建」触发。</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dash-view { padding: 0; }
.state { padding: 40px; text-align: center; color: var(--text-tertiary); }
.state.error { color: var(--danger, #e00); }
.cards {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;
}
.card {
  display: flex; align-items: center; gap: 12px;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px;
  padding: 16px; cursor: pointer; transition: border-color 0.15s;
}
.card:hover { border-color: var(--primary); }
.card-icon {
  font-size: 24px; color: var(--primary); width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(99, 102, 241, 0.08); border-radius: 8px;
}
.card-num { font-size: 24px; font-weight: 600; color: var(--text); line-height: 1.2; }
.card-label { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
.sections { display: flex; flex-direction: column; gap: 20px; }
.section {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px;
}
.section-head {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
}
.section-title { font-size: 14px; font-weight: 500; color: var(--text); }
.refresh { background: transparent; border: 1px solid var(--border); color: var(--text-secondary); display: flex; align-items: center; gap: 4px; }
.activity-list { display: flex; flex-direction: column; }
.activity-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0; border-bottom: 1px solid var(--border-light); font-size: 13px;
}
.activity-row:last-child { border-bottom: none; }
.source-tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; }
.source-tag.web { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
.source-tag.gitlab_mr { background: rgba(0, 112, 243, 0.1); color: #0070f3; }
.act-slug { font-family: ui-monospace, monospace; font-size: 12px; color: var(--text); flex: 1; }
.act-status { font-size: 11px; color: var(--text-secondary); }
.act-user { font-size: 12px; color: var(--text-secondary); }
.act-time { font-size: 12px; }
.muted { color: var(--text-tertiary); }
.empty-inline { padding: 16px 0; text-align: center; color: var(--text-tertiary); font-size: 13px; }
.badge-warn {
  padding: 2px 8px; border-radius: 4px; font-size: 11px;
  background: rgba(245, 166, 35, 0.1); color: #f5a623;
}
.hint { font-size: 13px; color: var(--text-secondary); margin: 0; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
</style>
