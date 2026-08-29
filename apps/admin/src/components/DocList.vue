<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { deleteDoc, listDocs, type CreateResult, type DocListItem } from '../api'
import CreateDocDialog from './CreateDocDialog.vue'

const emit = defineEmits<{
  open: [doc: DocListItem]
  created: [result: CreateResult]
  openapiGenerated: [docs: DocListItem[]]
  deleted: []
}>()
const docs = ref<DocListItem[]>([])
const loading = ref(true)
const error = ref('')
const showCreate = ref(false)
const selected = ref<string[]>([])

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    docs.value = await listDocs()
    selected.value = selected.value.filter((slug) => docs.value.some((d) => d.slug === slug))
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
function toggleSelected(slug: string) {
  selected.value = selected.value.includes(slug) ? selected.value.filter((item) => item !== slug) : [...selected.value, slug]
}
function toggleAll() {
  selected.value = selected.value.length === docs.value.length ? [] : docs.value.map((doc) => doc.slug)
}
async function deleteSelected() {
  if (!selected.value.length) return
  if (!confirm(`确定批量删除选中的 ${selected.value.length} 篇文档吗？将分别提交删除审核。`)) return
  const targets = [...selected.value]
  try {
    const results = await Promise.all(targets.map((slug) => deleteDoc(slug)))
    selected.value = []
    alert(`已提交 ${results.length} 篇文档的删除审核`)
    await refresh()
    emit('deleted')
  } catch (e: any) {
    alert('批量删除未完成：' + e.message)
  }
}

onMounted(refresh)

function onCreated(result: CreateResult) {
  emit('created', result)
  refresh()
}
function onOpenapiGenerated(newDocs: DocListItem[]) {
  docs.value = newDocs
  emit('openapiGenerated', newDocs)
}

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
      <h2 class="doc-title-h">文档</h2>
      <div class="doc-toolbar-actions">
        <button v-if="selected.length" class="btn btn-danger-outline" @click="deleteSelected">批量删除（{{ selected.length }}）</button>
        <button class="btn btn-primary create-btn" @click="showCreate = true"><span class="plus">+</span> 新建文档</button>
      </div>
    </div>

    <div v-if="loading" class="state">加载中…</div>
    <div v-else-if="error" class="state error">加载失败：{{ error }}（确认后端 :3001 已启动）</div>
    <table v-else class="doc-table">
      <thead>
        <tr>
          <th class="select-col"><input type="checkbox" :checked="selected.length === docs.length && docs.length > 0" aria-label="全选文档" @change="toggleAll" /></th>
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
          <td class="select-cell" @click.stop><input type="checkbox" :checked="selected.includes(d.slug)" :aria-label="`选择${d.title}`" @change="toggleSelected(d.slug)" /></td>
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

    <CreateDocDialog
      :show="showCreate"
      @close="showCreate = false"
      @created="onCreated"
      @openapi-generated="onOpenapiGenerated"
    />
  </div>
</template>

<style scoped>
.doc-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.doc-toolbar-actions { display: flex; align-items: center; gap: 8px; }
.btn-danger-outline { padding: 6px 11px; border: 1px solid #f1b4be; border-radius: 6px; color: #be123c; background: #fff7f8; font-size: 13px; }
.btn-danger-outline:hover { background: #fff0f2; }
.doc-title-h {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}
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
.select-col, .select-cell { width: 42px; text-align: center !important; }
.doc-table th:nth-child(2), .doc-table td:nth-child(2) { width: 23%; }
.doc-table th:nth-child(3), .doc-table td:nth-child(3) { width: 14%; }
.doc-table th:nth-child(4), .doc-table td:nth-child(4) { width: 12%; }
.doc-table th:nth-child(5), .doc-table td:nth-child(5) { width: 15%; }
.doc-table th:nth-child(6), .doc-table td:nth-child(6) { width: 26%; }
.doc-table th:nth-child(7), .doc-table td:nth-child(7) { width: 8%; }
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
