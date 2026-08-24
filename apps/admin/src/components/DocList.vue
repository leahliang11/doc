<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listDocs, type DocListItem } from '../api'
import CreateDocDialog from './CreateDocDialog.vue'

const emit = defineEmits<{
  open: [doc: DocListItem]
  created: [slug: string]
  openapiGenerated: [docs: DocListItem[]]
}>()
const docs = ref<DocListItem[]>([])
const loading = ref(true)
const error = ref('')
const showCreate = ref(false)

async function refresh() {
  try {
    docs.value = await listDocs()
  } catch (e: any) {
    error.value = e.message
  }
}

onMounted(refresh)

function onCreated(slug: string) {
  emit('created', slug)
  refresh()
}
function onOpenapiGenerated(newDocs: DocListItem[]) {
  docs.value = newDocs
  emit('openapiGenerated', newDocs)
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
      <button class="btn btn-primary create-btn" @click="showCreate = true">
        <span class="plus">+</span> 新建文档
      </button>
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
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in docs" :key="d.slug" class="doc-row" @click="emit('open', d)">
          <td class="doc-title">{{ d.title }}</td>
          <td>{{ categoryLabels[d.category] || d.category }}</td>
          <td><span class="badge" :class="d.status">{{ statusLabels[d.status] || d.status }}</span></td>
          <td class="muted">{{ d.updated ? d.updated.slice(0, 10) : '-' }}</td>
          <td class="muted mono">{{ d.slug }}</td>
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
  background: var(--bg-card);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-collapse: collapse;
}
.doc-table th,
.doc-table td {
  padding: 12px 16px;
  text-align: left;
  font-size: 13px;
  border-bottom: 1px solid var(--border-light);
}
.doc-table th {
  background: var(--bg-hover);
  color: var(--text-secondary);
  font-weight: 600;
}
.doc-row {
  cursor: pointer;
  transition: background 0.15s;
}
.doc-row:hover {
  background: var(--bg-hover);
}
.doc-title {
  font-weight: 500;
  color: var(--text);
}
.muted {
  color: var(--text-tertiary);
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
