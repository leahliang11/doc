<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  listReviewTasks,
  getDiff,
  approveReview,
  rejectReview,
  type ReviewTask,
} from '../api'

const tasks = ref<ReviewTask[]>([])
const loading = ref(false)
const toast = ref('')
const tab = ref<'pending' | 'all'>('pending')
// source_kind 筛选：all / pm / engineer / auto
const kindFilter = ref<'all' | 'pm' | 'engineer' | 'auto'>('all')
// 展开的行 id
const expandedId = ref<number | null>(null)
const diffText = ref('')
const diffLoading = ref(false)
// 驳回评论
const rejectComment = ref('')
const actionLoading = ref(false)

const sourceLabels: Record<string, string> = {
  web: 'PM 通道',
  gitlab_mr: '工程师 Git',
  auto: '智能运营',
}
const sourceKindLabels: Record<string, string> = {
  pm: 'PM',
  engineer: '工程师',
  auto: '机器',
}
const statusLabels: Record<string, string> = {
  pending: '待审核',
  approved: '通过',
  rejected: '驳回',
  merged: '已合入',
}

// 前端过滤 source_kind
const filteredTasks = computed(() => {
  if (kindFilter.value === 'all') return tasks.value
  return tasks.value.filter((t: any) => (t.source_kind ?? 'pm') === kindFilter.value)
})

async function load() {
  loading.value = true
  try {
    tasks.value = await listReviewTasks(tab.value === 'pending' ? 'pending' : 'all')
  } catch (e: any) {
    toast.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

async function toggleExpand(task: ReviewTask) {
  if (expandedId.value === task.id) {
    expandedId.value = null
    return
  }
  expandedId.value = task.id
  diffText.value = ''
  diffLoading.value = true
  try {
    const r = await getDiff(task.id)
    diffText.value = r.diff
  } catch (e: any) {
    diffText.value = '获取 diff 失败：' + e.message
  } finally {
    diffLoading.value = false
  }
}

async function approve(task: ReviewTask) {
  if (!confirm(`确认通过 MR #${task.mr_iid} 并合入 main？`)) return
  actionLoading.value = true
  toast.value = '合并中…'
  try {
    await approveReview(task.id)
    toast.value = `已通过，MR #${task.mr_iid} 已合入 main`
    await load()
  } catch (e: any) {
    toast.value = '通过失败：' + e.message
  } finally {
    actionLoading.value = false
  }
}

async function reject(task: ReviewTask) {
  if (!confirm(`确认驳回 MR #${task.mr_iid}？`)) return
  actionLoading.value = true
  toast.value = '驳回中…'
  try {
    await rejectReview(task.id, rejectComment.value || '审核驳回')
    toast.value = `已驳回 MR #${task.mr_iid}`
    rejectComment.value = ''
    expandedId.value = null
    await load()
  } catch (e: any) {
    toast.value = '驳回失败：' + e.message
  } finally {
    actionLoading.value = false
  }
}

function mrUrl(iid: number | null): string {
  if (!iid) return ''
  return `https://coding.jd.com/liangyuanwen.1/doc/merges/${iid}`
}

onMounted(load)
</script>

<template>
  <div class="review-view">
    <div class="review-toolbar">
      <div class="review-tabs">
        <button :class="['tab-btn', { active: tab === 'pending' }]" @click="tab = 'pending'; load()">
          待审核
        </button>
        <button :class="['tab-btn', { active: tab === 'all' }]" @click="tab = 'all'; load()">
          全部
        </button>
      </div>
      <!-- source_kind 筛选 -->
      <div class="kind-filter">
        <button
          v-for="k in ['all', 'pm', 'engineer', 'auto'] as const"
          :key="k"
          :class="['kind-btn', { active: kindFilter === k }]"
          @click="kindFilter = k"
        >
          <span v-if="k !== 'all'" :class="['kind-dot', `kind-dot--${k}`]"></span>
          {{ k === 'all' ? '全部来源' : sourceKindLabels[k] }}
        </button>
      </div>
      <button class="btn refresh-btn" @click="load" :disabled="loading">
        <i class="ri-refresh-line"></i> {{ loading ? '加载中…' : '刷新' }}
      </button>
    </div>

    <table class="review-table" v-if="filteredTasks.length">
      <thead>
        <tr>
          <th>来源</th>
          <th>文档</th>
          <th>分支</th>
          <th>MR</th>
          <th>提交者</th>
          <th>状态</th>
          <th>时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="t in filteredTasks" :key="t.id">
          <tr class="review-row" @click="toggleExpand(t)">
            <td>
              <div class="source-cell">
                <span :class="['source-tag', (t as any).source]">{{ sourceLabels[(t as any).source] || (t as any).source }}</span>
                <span :class="['kind-badge', `kind-badge--${(t as any).source_kind ?? 'pm'}`]">
                  {{ sourceKindLabels[(t as any).source_kind ?? 'pm'] }}
                </span>
              </div>
            </td>
            <td class="slug-cell">{{ t.slug }}</td>
            <td class="branch-cell" :title="t.branch">{{ t.branch.slice(0, 28) }}{{ t.branch.length > 28 ? '…' : '' }}</td>
            <td>
              <a v-if="t.mr_iid" :href="mrUrl(t.mr_iid)" target="_blank" @click.stop>#{{ t.mr_iid }}</a>
              <span v-else class="muted">-</span>
            </td>
            <td>{{ t.submitter }}</td>
            <td>
              <span :class="['status-tag', t.status]">{{ statusLabels[t.status] || t.status }}</span>
            </td>
            <td class="muted">{{ t.created_at?.slice(0, 16) }}</td>
            <td>
              <button
                v-if="t.status === 'pending'"
                class="btn btn-sm btn-primary"
                :disabled="actionLoading"
                @click.stop="approve(t)"
              >通过</button>
            </td>
          </tr>
          <tr v-if="expandedId === t.id" class="expand-row">
            <td colspan="8">
              <div class="expand-content">
                <div class="diff-head">
                  <span>Diff（{{ t.branch }} → main）</span>
                  <span v-if="t.status === 'pending'" class="expand-actions">
                    <input
                      v-model="rejectComment"
                      class="reject-input"
                      placeholder="驳回理由（可选）"
                      @click.stop
                    />
                    <button class="btn btn-sm reject-btn" :disabled="actionLoading" @click.stop="reject(t)">
                      驳回
                    </button>
                  </span>
                </div>
                <div v-if="diffLoading" class="diff-loading">加载 diff…</div>
                <pre v-else class="diff-view">{{ diffText || '无 diff 内容' }}</pre>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <div v-else-if="!loading" class="empty">
      <i class="ri-inbox-line empty-icon"></i>
      <p>{{ kindFilter !== 'all' ? `没有来自「${sourceKindLabels[kindFilter]}」的任务` : (tab === 'pending' ? '暂无待审核任务' : '暂无记录') }}</p>
    </div>
  </div>
</template>

<style scoped>
.review-view { padding: 0; }
.review-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.review-tabs { display: flex; gap: 4px; }
.tab-btn {
  padding: 6px 16px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
}
.tab-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.refresh-btn {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}
.review-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  font-size: 13px;
}
.review-table th,
.review-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
}
.review-table th {
  background: var(--bg-hover);
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 12px;
}
.review-row { cursor: pointer; }
.review-row:hover { background: var(--bg-hover); }
.slug-cell { font-family: ui-monospace, monospace; font-size: 12px; }
.branch-cell { font-family: ui-monospace, monospace; font-size: 12px; color: var(--text-tertiary); }
.muted { color: var(--text-tertiary); }
.source-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}
.source-tag.web { background: var(--brand-soft); color: var(--brand); }
.source-tag.gitlab_mr { background: #dbeafe; color: #1d4ed8; }
.source-tag.auto { background: var(--orange-light); color: #92400e; }
.source-cell { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
/* source_kind badge */
.kind-badge {
  padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600;
}
.kind-badge--pm { background: var(--brand-soft); color: var(--brand); }
.kind-badge--engineer { background: var(--green-light); color: var(--green-dark, #16a34a); }
.kind-badge--auto { background: var(--orange-light); color: #92400e; }
/* kind filter bar */
.kind-filter { display: flex; align-items: center; gap: 4px; }
.kind-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: 6px; font-size: 12px;
  background: var(--bg-hover); color: var(--text-secondary);
  border: 1px solid transparent; cursor: pointer; transition: all 0.15s;
}
.kind-btn:hover { background: var(--bg-card); border-color: var(--border); }
.kind-btn.active { background: var(--brand-soft); color: var(--brand); border-color: var(--brand)/20; }
.kind-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.kind-dot--pm { background: var(--brand); }
.kind-dot--engineer { background: var(--green); }
.kind-dot--auto { background: var(--orange); }
.status-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}
.status-tag.pending { background: rgba(245, 166, 35, 0.1); color: #f5a623; }
.status-tag.merged, .status-tag.approved { background: rgba(0, 168, 0, 0.1); color: #0a8; }
.status-tag.rejected { background: rgba(224, 0, 0, 0.1); color: #e00; }
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
.btn-sm { padding: 4px 12px; font-size: 12px; }
.expand-row { background: var(--bg-hover); }
.expand-row td { padding: 0; }
.expand-content { padding: 16px; }
.diff-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 8px;
}
.expand-actions { display: flex; gap: 8px; align-items: center; }
.reject-input {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  width: 240px;
  background: var(--bg-card);
  color: var(--text);
}
.reject-btn {
  background: transparent;
  border: 1px solid var(--danger, #e00);
  color: var(--danger, #e00);
}
.diff-loading { padding: 20px; color: var(--text-tertiary); font-size: 13px; }
.diff-view {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text);
  max-height: 400px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
.empty {
  padding: 60px 0;
  text-align: center;
  color: var(--text-tertiary);
}
.empty-icon { font-size: 40px; display: block; margin-bottom: 8px; }
</style>
