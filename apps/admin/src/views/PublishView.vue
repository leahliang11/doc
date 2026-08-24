<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { listPublish, getDiff, type PublishItem } from '../api'

const emit = defineEmits<{ navigate: [path: string] }>()

const items = ref<PublishItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const toast = ref('')

// diff 弹窗
const diffItem = ref<PublishItem | null>(null)
const diffText = ref('')
const diffLoading = ref(false)

const sourceLabels: Record<string, string> = {
  web: 'PM 通道',
  gitlab_mr: '工程师 Git',
}

async function load() {
  loading.value = true
  try {
    const r = await listPublish(page.value, pageSize)
    items.value = r.items
    total.value = r.total
  } catch (e: any) {
    toast.value = '加载失败：' + e.message
  } finally {
    loading.value = false
  }
}

async function viewDiff(item: PublishItem) {
  diffItem.value = item
  diffText.value = ''
  diffLoading.value = true
  try {
    const r = await getDiff(item.id)
    diffText.value = r.diff
  } catch (e: any) {
    diffText.value = '获取 diff 失败：' + e.message
  } finally {
    diffLoading.value = false
  }
}

function mrUrl(iid: number | null): string {
  if (!iid) return ''
  return `https://coding.jd.com/liangyuanwen.1/doc/merges/${iid}`
}

function docUrl(slug: string): string {
  return `/joymaas-docs/docs/${slug}`
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

function goPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  load()
}

onMounted(load)
</script>

<template>
  <div class="publish-view">
    <div v-if="toast" class="toast">{{ toast }}</div>

    <div class="toolbar">
      <span class="muted">共 {{ total }} 条发布记录</span>
      <button class="btn refresh-btn" @click="load" :disabled="loading">
        <i class="ri-refresh-line"></i> {{ loading ? '加载中…' : '刷新' }}
      </button>
    </div>

    <table v-if="items.length" class="pub-table">
      <thead>
        <tr>
          <th>发布时间</th>
          <th>文档</th>
          <th>来源</th>
          <th>提交人</th>
          <th>审核人</th>
          <th>MR</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="it in items" :key="it.id" class="pub-row">
          <td class="muted">{{ it.reviewed_at?.slice(0, 16) || '-' }}</td>
          <td>
            <a :href="docUrl(it.slug)" target="_blank" class="slug-link">{{ it.slug }}</a>
          </td>
          <td>
            <span :class="['source-tag', it.source]">{{ sourceLabels[it.source] || it.source }}</span>
          </td>
          <td>{{ it.submitter }}</td>
          <td>{{ it.reviewer || '-' }}</td>
          <td>
            <a v-if="it.mr_iid" :href="mrUrl(it.mr_iid)" target="_blank">!{{ it.mr_iid }}</a>
            <span v-else class="muted">-</span>
          </td>
          <td>
            <button class="btn btn-sm diff-btn" @click="viewDiff(it)">查看 diff</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-else-if="!loading" class="empty">
      <i class="ri-rocket-2-line empty-icon"></i>
      <p>暂无发布记录</p>
      <p class="empty-hint">审核通过并合入 main 的文档会出现在这里</p>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="pager">
      <button class="btn btn-sm" :disabled="page === 1" @click="goPage(page - 1)">上一页</button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button class="btn btn-sm" :disabled="page === totalPages" @click="goPage(page + 1)">下一页</button>
    </div>

    <!-- diff 弹窗 -->
    <div v-if="diffItem" class="modal-mask" @click.self="diffItem = null">
      <div class="modal">
        <div class="modal-head">
          <span>Diff · {{ diffItem.slug }}（{{ diffItem.branch }} → main）</span>
          <button class="modal-close" @click="diffItem = null">×</button>
        </div>
        <div v-if="diffLoading" class="diff-loading">加载 diff…</div>
        <pre v-else class="diff-view">{{ diffText || '无 diff 内容' }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.publish-view { padding: 0; }
.toast {
  position: fixed; top: 16px; right: 16px; z-index: 200;
  background: var(--text); color: #fff; padding: 8px 14px;
  border-radius: 6px; font-size: 13px;
}
.toolbar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.muted { color: var(--text-tertiary); font-size: 13px; }
.refresh-btn {
  background: var(--bg-card); border: 1px solid var(--border);
  color: var(--text-secondary); display: flex; align-items: center; gap: 4px;
}
.pub-table {
  width: 100%; border-collapse: collapse; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: 8px; overflow: hidden; font-size: 13px;
}
.pub-table th, .pub-table td {
  padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border-light);
}
.pub-table th {
  background: var(--bg-hover); font-weight: 500; color: var(--text-secondary); font-size: 12px;
}
.pub-row:hover { background: var(--bg-hover); }
.slug-link { font-family: ui-monospace, monospace; font-size: 12px; color: var(--primary); text-decoration: none; }
.slug-link:hover { text-decoration: underline; }
.source-tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; }
.source-tag.web { background: rgba(79, 70, 229, 0.1); color: #4f46e5; }
.source-tag.gitlab_mr { background: rgba(0, 112, 243, 0.1); color: #0070f3; }
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.diff-btn { background: transparent; border: 1px solid var(--border); color: var(--text-secondary); }
.diff-btn:hover { border-color: var(--primary); color: var(--primary); }
.empty {
  padding: 60px 0; text-align: center; color: var(--text-tertiary);
}
.empty-icon { font-size: 40px; display: block; margin-bottom: 8px; }
.empty-hint { font-size: 12px; margin-top: 4px; }
.pager {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  margin-top: 16px;
}
.page-info { font-size: 13px; color: var(--text-secondary); }
.modal-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 300;
  display: flex; align-items: center; justify-content: center;
}
.modal {
  background: var(--bg-card); border-radius: 8px; width: 760px; max-width: 92vw;
  max-height: 80vh; display: flex; flex-direction: column; overflow: hidden;
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid var(--border);
  font-size: 14px; font-weight: 500;
}
.modal-close {
  background: transparent; border: none; font-size: 22px; cursor: pointer;
  color: var(--text-tertiary); line-height: 1;
}
.diff-loading { padding: 40px; color: var(--text-tertiary); text-align: center; }
.diff-view {
  padding: 16px 20px; font-family: ui-monospace, monospace; font-size: 12px;
  line-height: 1.6; color: var(--text); overflow: auto; white-space: pre-wrap;
  word-break: break-all; margin: 0; flex: 1;
}
</style>
