<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { deleteDoc, listDocs, type DocListItem } from '../api'

const emit = defineEmits<{
  open: [doc: DocListItem]
  deleted: []
}>()
const docs = ref<DocListItem[]>([])
const loading = ref(true)
const error = ref('')

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    docs.value = await listDocs()
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(refresh)

async function onDelete(doc: DocListItem) {
  if (!confirm(`确定删除「${doc.title}」吗？\n删除会创建审核合并请求，审核通过后才会从线上移除。`)) return
  try {
    const result = await deleteDoc(doc.slug)
    alert(`已提交删除审核：MR #${result.mr_iid}`)
    await refresh()
    emit('deleted')
  } catch (e: any) {
    alert('删除失败：' + e.message)
  }
}

const categoryLabels: Record<string, string> = {
  quickstart: '快速开始',
  api: 'API 参考',
  models: '模型说明',
  guides: '场景指南',
  troubleshooting: '排障',
}
const statusLabels: Record<string, string> = {
  draft: '草稿',
  review: '审核中',
  published: '已发布',
  archived: '已下架',
}
</script>

<template>
  <div>
    <div class="doc-toolbar">
      <div class="doc-toolbar-actions">
      </div>
    </div>

    <div v-if="loading" class="state">加载中…</div>
    <div v-else-if="error" class="state error">加载失败：{{ error }}（确认后端 :3001 已启动）</div>
    <table v-else class="doc-table">
      <thead>
        <tr>
          <th>标题</th>
          <th>分类</th>
          <th>状态</th>
          <th>更新时间</th>
          <th>slug</th>
          <th class="action-col">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in docs" :key="d.slug" class="doc-row" @click="emit('open', d)">
          <td class="doc-title">{{ d.title }}</td>
          <td>{{ categoryLabels[d.category] || d.category }}</td>
          <td><span class="badge" :class="d.status">{{ statusLabels[d.status] || d.status }}</span></td>
          <td class="muted">{{ d.updated ? d.updated.slice(0, 10) : '-' }}</td>
          <td class="muted mono">{{ d.slug }}</td>
          <td class="action-cell">
            <button class="row-action edit" title="编辑文档" @click.stop="emit('open', d)">
              <i class="ri-edit-line"></i>
            </button>
            <button class="row-action delete" title="删除文档" @click.stop="onDelete(d)">
              <i class="ri-delete-bin-line"></i>
            </button>
          </td>
        </tr>
      </tbody>
    </table>

  </div>
</template>

<style scoped>
.doc-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 12px;
}
.doc-toolbar-actions { display: flex; align-items: center; gap: 8px; }
.btn-danger-outline { padding: 6px 11px; border: 1px solid #f1b4be; border-radius: 6px; color: #be123c; background: #fff7f8; font-size: 13px; }
.btn-danger-outline:hover { background: #fff0f2; }
.create-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 13px;
}
.create-btn .plus {
  font-size: 16px;
  line-height: 1;
}
.doc-table {
  width: 100%;
  table-layout: fixed;
  background: var(--bg-card);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-collapse: collapse;
}
.doc-table th:nth-child(1), .doc-table td:nth-child(1) { width: 23%; }
.doc-table th:nth-child(2), .doc-table td:nth-child(2) { width: 14%; }
.doc-table th:nth-child(3), .doc-table td:nth-child(3) { width: 12%; }
.doc-table th:nth-child(4), .doc-table td:nth-child(4) { width: 15%; }
.doc-table th:nth-child(5), .doc-table td:nth-child(5) { width: 26%; }
.doc-table th:nth-child(6), .doc-table td:nth-child(6) { width: 10%; }
.doc-table th,
.doc-table td {
  padding: 11px 14px;
  text-align: left;
  font-size: 14px;
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}
.doc-table th {
  background: var(--bg-hover);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}
.doc-row {
  cursor: pointer;
  transition: background 0.15s;
}
.doc-row:hover {
  background: var(--bg-hover);
}
.action-col { width: 64px; text-align: center !important; }
.action-cell { width: 64px; text-align: center !important; }
.row-action {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
}
.row-action.delete:hover { background: var(--red-light, #fee2e2); color: var(--red, #dc2626); }
.row-action.edit:hover { background: var(--primary-light, #ede9fe); color: var(--primary, #533afd); }
.doc-title {
  font-weight: 500;
  color: var(--text);
  line-height: 1.45;
  word-break: break-word;
}
.muted {
  color: var(--text-secondary);
}
.mono {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.badge.published {
  background: var(--green-light);
  color: var(--green);
}
.badge.draft {
  background: var(--orange-light);
  color: var(--orange);
}
.state {
  padding: 40px;
  text-align: center;
  color: var(--text-tertiary);
}
.state.error {
  color: var(--red);
}
</style>
