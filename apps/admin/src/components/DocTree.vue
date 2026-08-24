<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getMeta, moveDoc, type Meta } from '../api'

const emit = defineEmits<{ open: [slug: string] }>()

const meta = ref<Meta>({ sections: [] })
const loading = ref(true)
const saving = ref(false)
const toast = ref('')
const error = ref('')

// 拖拽状态
const draggingSlug = ref<string | null>(null)
const dragOverGroup = ref<string | null>(null) // sectionId/groupId 复合 key

// slug → 标题 查找表（从 dashboard 或直接用 slug 推断）
const titleMap = ref<Record<string, string>>({})

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    meta.value = await getMeta()
    // 拿文档列表补标题（复用 dashboard 不够，直接调 docs）
    const resp = await fetch('/api/docs')
    const docs = await resp.json()
    titleMap.value = Object.fromEntries(docs.map((d: any) => [d.slug, d.title]))
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function groupKey(sectionId: string, groupId: string) {
  return `${sectionId}/${groupId}`
}

// 计算未分类文档（meta 里没引用的）
const uncategorized = computed(() => {
  const referenced = new Set<string>()
  meta.value.sections?.forEach((s) =>
    s.groups?.forEach((g) => g.pages?.forEach((p) => referenced.add(p))),
  )
  return Object.keys(titleMap.value).filter((slug) => !referenced.has(slug))
})

// ============ 拖拽逻辑（原生 HTML5 drag） ============
function onDragStart(slug: string, e: DragEvent) {
  draggingSlug.value = slug
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', slug)
  }
}

function onDragEnd() {
  draggingSlug.value = null
  dragOverGroup.value = null
}

function onDragOver(sectionId: string, groupId: string, e: DragEvent) {
  if (!draggingSlug.value) return
  e.preventDefault() // 允许 drop
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverGroup.value = groupKey(sectionId, groupId)
}

function onDragLeave(sectionId: string, groupId: string) {
  if (dragOverGroup.value === groupKey(sectionId, groupId)) {
    dragOverGroup.value = null
  }
}

async function onDrop(sectionId: string, groupId: string, e: DragEvent) {
  e.preventDefault()
  const slug = draggingSlug.value
  dragOverGroup.value = null
  draggingSlug.value = null
  if (!slug) return

  // 检查是否已在目标组（避免无意义移动）
  const already = meta.value.sections
    ?.find((s) => s.id === sectionId)
    ?.groups?.find((g) => g.id === groupId)
    ?.pages?.includes(slug)
  if (already) return

  saving.value = true
  toast.value = ''
  try {
    // 调 move（走 draft + MR）
    await moveDoc(slug, sectionId, groupId)
    toast.value = `已移动「${titleMap.value[slug] || slug}」，提交审核后生效`
    await refresh()
  } catch (err: any) {
    toast.value = '移动失败：' + err.message
  } finally {
    saving.value = false
    setTimeout(() => (toast.value = ''), 3000)
  }
}

onMounted(refresh)
</script>

<template>
  <div class="doc-tree">
    <div class="tree-header">
      <h3 class="tree-title">文档结构</h3>
      <span class="tree-hint">拖拽文档到不同分组可移动</span>
    </div>

    <div v-if="loading" class="tree-loading">加载中…</div>
    <div v-else-if="error" class="tree-error">{{ error }}</div>

    <div v-else class="tree-body">
      <div v-for="section in meta.sections" :key="section.id" class="section">
        <div class="section-label">
          <span class="section-icon"><i class="ri-folder-line"></i></span>
          {{ section.label }}
        </div>

        <div v-for="group in section.groups" :key="group.id" class="group">
          <div
            class="group-box"
            :class="{ 'drag-over': dragOverGroup === groupKey(section.id, group.id) }"
            @dragover="onDragOver(section.id, group.id, $event)"
            @dragleave="onDragLeave(section.id, group.id)"
            @drop="onDrop(section.id, group.id, $event)"
          >
            <div class="group-label">
              <span class="group-icon"><i class="ri-folder-3-line"></i></span>
              {{ group.label }}
              <span class="group-count">{{ group.pages?.length || 0 }}</span>
            </div>

            <ul class="page-list">
              <li
                v-for="slug in group.pages"
                :key="slug"
                class="page-item"
                :class="{ dragging: draggingSlug === slug }"
                draggable="true"
                @dragstart="onDragStart(slug, $event)"
                @dragend="onDragEnd"
                @click="emit('open', slug)"
              >
                <span class="drag-handle"><i class="ri-drag-move-2-line"></i></span>
                <span class="page-title">{{ titleMap[slug] || slug }}</span>
                <span class="page-slug">{{ slug }}</span>
              </li>
              <li v-if="!group.pages?.length" class="page-empty">（空分组）</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 未分类降级区 -->
      <div v-if="uncategorized.length" class="section uncategorized">
        <div class="section-label">未分类</div>
        <ul class="page-list flat">
          <li
            v-for="slug in uncategorized"
            :key="slug"
            class="page-item"
            draggable="true"
            @dragstart="onDragStart(slug, $event)"
            @dragend="onDragEnd"
            @click="emit('open', slug)"
          >
            <span class="drag-handle"><i class="ri-drag-move-2-line"></i></span>
            <span class="page-title">{{ titleMap[slug] || slug }}</span>
            <span class="page-slug">{{ slug }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="toast" class="tree-toast" :class="{ error: toast.includes('失败') }">{{ toast }}</div>
    <div v-if="saving" class="tree-saving">处理中…</div>
  </div>
</template>

<style scoped>
.doc-tree {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
}
.tree-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}
.tree-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}
.tree-hint {
  font-size: 11px;
  color: var(--text-secondary);
}
.tree-loading,
.tree-error {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
}
.tree-error {
  color: var(--danger, #dc2626);
}
.section {
  margin-bottom: 16px;
}
.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
  padding: 0 4px;
}
.section-icon {
  color: var(--text-secondary);
}
.group {
  margin-bottom: 8px;
}
.group-box {
  border: 1px solid var(--border-light);
  border-radius: 6px;
  padding: 8px 10px;
  transition: border-color 0.15s, background 0.15s;
}
.group-box.drag-over {
  border-color: var(--primary, #533afd);
  background: var(--bg-hover);
}
.group-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 6px;
}
.group-icon {
  color: var(--text-secondary);
  font-size: 13px;
}
.group-count {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 8px;
  margin-left: 2px;
}
.page-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.page-list.flat {
  padding: 0 4px;
}
.page-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.12s;
}
.page-item:hover {
  background: var(--bg-hover);
}
.page-item.dragging {
  opacity: 0.4;
}
.drag-handle {
  color: var(--text-secondary);
  cursor: grab;
  font-size: 13px;
}
.drag-handle:active {
  cursor: grabbing;
}
.page-title {
  color: var(--text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-slug {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
}
.page-empty {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 8px;
  font-style: italic;
}
.uncategorized .section-label {
  color: var(--text-secondary);
}
.tree-toast {
  margin-top: 12px;
  padding: 8px 12px;
  font-size: 12px;
  background: var(--bg-hover);
  border-radius: 6px;
  color: var(--text);
}
.tree-toast.error {
  color: var(--danger, #dc2626);
}
.tree-saving {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
