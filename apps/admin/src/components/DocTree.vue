<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { adminFetch, deleteDoc, getMeta, moveDoc, saveMeta, type Meta } from '../api'

const emit = defineEmits<{ open: [slug: string]; deleted: []; create: [sectionId?: string, groupId?: string] }>()

const meta = ref<Meta>({ sections: [] })
const loading = ref(true)
const saving = ref(false)
const toast = ref('')
const error = ref('')
const structureDialog = ref<{
  show: boolean
  mode: 'add-section' | 'add-group' | 'rename-section' | 'rename-group'
  sectionId?: string
  groupId?: string
  label: string
  title: string
}>({ show: false, mode: 'add-section', label: '', title: '' })

// 拖拽状态
const draggingSlug = ref<string | null>(null)
const dragOverGroup = ref<string | null>(null) // sectionId/groupId 复合 key

// slug → 标题 查找表（从 dashboard 或直接用 slug 推断）
const titleMap = ref<Record<string, string>>({})
const collapsedSections = ref<Record<string, boolean>>({})
const collapsedGroups = ref<Record<string, boolean>>({})
const selectedSlugs = ref<string[]>([])

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    meta.value = await getMeta()
    // 拿文档列表补标题（复用 dashboard 不够，直接调 docs）
    const resp = await adminFetch('/api/docs')
    const docs = await resp.json()
    titleMap.value = Object.fromEntries(docs.map((d: any) => [d.slug, d.title]))
    selectedSlugs.value = selectedSlugs.value.filter((slug) => Object.prototype.hasOwnProperty.call(titleMap.value, slug))
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function toggleSelected(slug: string) {
  selectedSlugs.value = selectedSlugs.value.includes(slug)
    ? selectedSlugs.value.filter((item) => item !== slug)
    : [...selectedSlugs.value, slug]
}

async function deleteSelected() {
  if (!selectedSlugs.value.length) return
  const targets = [...selectedSlugs.value]
  if (!confirm(`确定删除选中的 ${targets.length} 篇文档吗？删除会分别创建审核合并请求。`)) return
  saving.value = true
  toast.value = `正在提交 ${targets.length} 篇文档的删除…`
  try {
    // 后端会在同一个工作区切换 draft 分支，必须串行执行，避免并发 checkout 导致删除失败。
    const results = []
    for (const slug of targets) results.push(await deleteDoc(slug))
    selectedSlugs.value = []
    toast.value = `已提交 ${results.length} 篇文档的删除审核`
    emit('deleted')
    await refresh()
  } catch (err: any) {
    toast.value = '批量删除失败：' + err.message
  } finally {
    saving.value = false
    setTimeout(() => (toast.value = ''), 4500)
  }
}

function groupKey(sectionId: string, groupId: string) {
  return `${sectionId}/${groupId}`
}

function toggleSection(sectionId: string) {
  collapsedSections.value[sectionId] = !collapsedSections.value[sectionId]
}

function toggleGroup(sectionId: string, groupId: string) {
  const key = groupKey(sectionId, groupId)
  collapsedGroups.value[key] = !collapsedGroups.value[key]
}

function slugifyLabel(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '') || `group-${Date.now()}`
}

async function saveStructure(next: Meta, message: string) {
  saving.value = true
  toast.value = '目录保存中…'
  try {
    const result = await saveMeta(next)
    meta.value = next
    toast.value = `${message}，已提交审核 MR #${result.mr_iid}`
  } catch (err: any) {
    toast.value = '目录保存失败：' + err.message
  } finally {
    saving.value = false
    setTimeout(() => (toast.value = ''), 4500)
  }
}

function copyMeta() {
  return JSON.parse(JSON.stringify(meta.value)) as Meta
}

function openStructureDialog(mode: typeof structureDialog.value.mode, options: { sectionId?: string; groupId?: string; label?: string; title: string }) {
  structureDialog.value = { show: true, mode, sectionId: options.sectionId, groupId: options.groupId, label: options.label || '', title: options.title }
}

function closeStructureDialog() {
  structureDialog.value.show = false
}

function addSection() {
  openStructureDialog('add-section', { title: '新建顶层目录' })
}

async function submitStructureDialog() {
  const { mode, sectionId, groupId } = structureDialog.value
  const label = structureDialog.value.label.trim()
  if (!label) return
  closeStructureDialog()
  if (mode === 'add-section') {
  const next = copyMeta()
  const id = slugifyLabel(label)
  if (next.sections.some((s) => s.id === id)) return (toast.value = '目录 ID 已存在，请换一个名称')
  next.sections.push({ id, label, order: next.sections.length + 1, groups: [] })
  await saveStructure(next, `已创建目录「${label}」`)
  } else if (mode === 'add-group' && sectionId) {
    const next = copyMeta()
    const section = next.sections.find((s) => s.id === sectionId)
    if (!section) return
    section.groups ||= []
    const id = slugifyLabel(label)
    if (section.groups.some((g) => g.id === id)) return (toast.value = '分组 ID 已存在，请换一个名称')
    section.groups.push({ id, label, order: section.groups.length + 1, pages: [] })
    await saveStructure(next, `已创建分组「${label}」`)
  } else if (mode === 'rename-section' && sectionId) {
    const next = copyMeta()
    const section = next.sections.find((s) => s.id === sectionId)
    if (!section || label === section.label) return
    section.label = label
    await saveStructure(next, `已重命名为「${label}」`)
  } else if (mode === 'rename-group' && sectionId && groupId) {
    const next = copyMeta()
    const group = next.sections.find((s) => s.id === sectionId)?.groups?.find((g) => g.id === groupId)
    if (!group || label === group.label) return
    group.label = label
    await saveStructure(next, `已重命名为「${label}」`)
  }
}

async function addGroup(sectionId: string) {
  openStructureDialog('add-group', { sectionId, title: '新建分组' })
}

async function renameSection(sectionId: string) {
  const section = meta.value.sections.find((s) => s.id === sectionId)
  if (!section) return
  openStructureDialog('rename-section', { sectionId, label: section.label, title: '重命名目录' })
}

async function renameGroup(sectionId: string, groupId: string) {
  const section = meta.value.sections.find((s) => s.id === sectionId)
  const group = section?.groups?.find((g) => g.id === groupId)
  if (!group) return
  openStructureDialog('rename-group', { sectionId, groupId, label: group.label, title: '重命名分组' })
}

async function removeSection(sectionId: string) {
  const section = meta.value.sections.find((s) => s.id === sectionId)
  if (!section) return
  const pageCount = section.groups?.reduce((sum, group) => sum + (group.pages?.length || 0), 0) || 0
  const suffix = pageCount ? `目录下的 ${pageCount} 篇文档会保留并变为未分类。` : '目录为空。'
  if (!confirm(`确定删除目录「${section.label}」吗？\n${suffix}`)) return
  const next = copyMeta()
  next.sections = next.sections.filter((s) => s.id !== sectionId)
  await saveStructure(next, `已删除目录「${section.label}」`)
}

async function removeGroup(sectionId: string, groupId: string) {
  const section = meta.value.sections.find((s) => s.id === sectionId)
  const group = section?.groups?.find((g) => g.id === groupId)
  if (!section || !group) return
  const pageCount = group.pages?.length || 0
  const suffix = pageCount ? `分组下的 ${pageCount} 篇文档会保留并变为未分类。` : '分组为空。'
  if (!confirm(`确定删除分组「${group.label}」吗？\n${suffix}`)) return
  const next = copyMeta()
  next.sections.find((s) => s.id === sectionId)!.groups = section.groups!.filter((g) => g.id !== groupId)
  await saveStructure(next, `已删除分组「${group.label}」`)
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

async function onDelete(slug: string) {
  const title = titleMap.value[slug] || slug
  if (!confirm(`确定删除「${title}」吗？\n未发布草稿将直接删除，已发布文档会进入审核流程。`)) return
  saving.value = true
  toast.value = '删除提交中…'
  try {
    const result = await deleteDoc(slug)
    toast.value = result.direct ? `草稿「${title}」已直接删除` : `已提交删除审核：PR #${result.mr_iid}`
    emit('deleted')
    await refresh()
  } catch (err: any) {
    toast.value = '删除失败：' + err.message
  } finally {
    saving.value = false
    setTimeout(() => (toast.value = ''), 4000)
  }
}

onMounted(refresh)
</script>

<template>
  <div class="doc-tree">
    <div class="tree-header">
      <div>
        <h3 class="tree-title">文档结构</h3>
        <span class="tree-hint">拖拽文档移动，目录支持新建、重命名和删除</span>
      </div>
      <div class="tree-header-actions">
        <button v-if="selectedSlugs.length" class="tree-batch-delete" type="button" @click="deleteSelected">
          <i class="ri-delete-bin-line"></i> 批量删除 {{ selectedSlugs.length }} 项
        </button>
        <button class="tree-add" title="新建顶层目录" @click="addSection"><i class="ri-folder-add-line"></i> 新建目录</button>
      </div>
    </div>

    <div v-if="loading" class="tree-loading">加载中…</div>
    <div v-else-if="error" class="tree-error">{{ error }}</div>

    <div v-else class="tree-body">
      <div v-for="section in meta.sections" :key="section.id" class="section">
        <div class="section-label">
          <button class="tree-toggle" :title="collapsedSections[section.id] ? '展开目录' : '收起目录'" @click="toggleSection(section.id)">
            <i :class="collapsedSections[section.id] ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line'"></i>
          </button>
          <span class="section-icon"><i class="ri-folder-line"></i></span>
          {{ section.label }}
          <span class="structure-actions">
            <button title="新建分组" @click="addGroup(section.id)"><i class="ri-add-line"></i></button>
            <button title="在此目录新建文档" @click="emit('create', section.id)"><i class="ri-file-add-line"></i></button>
            <button title="重命名目录" @click="renameSection(section.id)"><i class="ri-edit-line"></i></button>
            <button title="删除目录" @click="removeSection(section.id)"><i class="ri-delete-bin-line"></i></button>
          </span>
        </div>

        <template v-if="!collapsedSections[section.id]">
        <div v-for="group in section.groups" :key="group.id" class="group">
          <div
            class="group-box"
            :class="{ 'drag-over': dragOverGroup === groupKey(section.id, group.id) }"
            @dragover="onDragOver(section.id, group.id, $event)"
            @dragleave="onDragLeave(section.id, group.id)"
            @drop="onDrop(section.id, group.id, $event)"
          >
            <div class="group-label">
              <button class="tree-toggle" :title="collapsedGroups[groupKey(section.id, group.id)] ? '展开分组' : '收起分组'" @click.stop="toggleGroup(section.id, group.id)">
                <i :class="collapsedGroups[groupKey(section.id, group.id)] ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line'"></i>
              </button>
              <span class="group-icon"><i class="ri-folder-3-line"></i></span>
              {{ group.label }}
              <span class="group-count">{{ group.pages?.length || 0 }}</span>
              <span class="structure-actions">
              <button title="重命名分组" @click.stop="renameGroup(section.id, group.id)"><i class="ri-edit-line"></i></button>
                <button title="在此分组新建文档" @click.stop="emit('create', section.id, group.id)"><i class="ri-file-add-line"></i></button>
                <button title="删除分组" @click.stop="removeGroup(section.id, group.id)"><i class="ri-delete-bin-line"></i></button>
              </span>
            </div>

            <ul v-if="!collapsedGroups[groupKey(section.id, group.id)]" class="page-list">
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
                <input class="page-check" type="checkbox" :checked="selectedSlugs.includes(slug)" :aria-label="`选择${titleMap[slug] || slug}`" @click.stop @change="toggleSelected(slug)" />
                <span class="page-title">{{ titleMap[slug] || slug }}</span>
                <span class="page-slug">{{ slug }}</span>
                <button class="page-action edit" title="编辑文档" @click.stop="emit('open', slug)">
                  <i class="ri-edit-line"></i>
                </button>
                <button class="page-action delete" title="删除文档" @click.stop="onDelete(slug)">
                  <i class="ri-delete-bin-line"></i>
                </button>
              </li>
              <li v-if="!group.pages?.length" class="page-empty">（空分组）</li>
            </ul>
          </div>
        </div>
        </template>
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
            <input class="page-check" type="checkbox" :checked="selectedSlugs.includes(slug)" :aria-label="`选择${titleMap[slug] || slug}`" @click.stop @change="toggleSelected(slug)" />
            <span class="page-title">{{ titleMap[slug] || slug }}</span>
            <span class="page-slug">{{ slug }}</span>
            <button class="page-action edit" title="编辑文档" @click.stop="emit('open', slug)">
              <i class="ri-edit-line"></i>
            </button>
            <button class="page-action delete" title="删除文档" @click.stop="onDelete(slug)">
              <i class="ri-delete-bin-line"></i>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="toast" class="tree-toast" :class="{ error: toast.includes('失败') }">{{ toast }}</div>
    <div v-if="saving" class="tree-saving">处理中…</div>

    <div v-if="structureDialog.show" class="tree-dialog-mask" @click.self="closeStructureDialog">
      <form class="tree-dialog" @submit.prevent="submitStructureDialog">
        <div class="tree-dialog-head">
          <strong>{{ structureDialog.title }}</strong>
          <button type="button" class="tree-dialog-close" aria-label="关闭" @click="closeStructureDialog"><i class="ri-close-line"></i></button>
        </div>
        <label class="tree-dialog-label">名称</label>
        <input v-model="structureDialog.label" class="tree-dialog-input" autofocus maxlength="80" placeholder="请输入名称" />
        <p class="tree-dialog-help">保存后会创建审核合并请求，审核通过后正式生效。</p>
        <div class="tree-dialog-actions">
          <button type="button" class="tree-dialog-cancel" @click="closeStructureDialog">取消</button>
          <button type="submit" class="tree-dialog-submit">保存</button>
        </div>
      </form>
    </div>
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
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.tree-header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
}
.tree-select-all,
.tree-batch-delete {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}
.tree-select-all:hover { border-color: var(--primary); color: var(--primary); }
.tree-batch-delete { border-color: #f1b4be; background: #fff7f8; color: #be123c; }
.tree-batch-delete:hover { background: #fff0f2; }
.tree-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}
.tree-hint {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.tree-add {
  flex: 0 0 auto;
  padding: 6px 9px;
  border: 1px solid var(--primary);
  border-radius: 6px;
  color: var(--primary);
  font-size: 12px;
  background: var(--primary-lighter);
}
.tree-add:hover { background: var(--primary); color: #fff; }
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
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-dark);
  letter-spacing: 0.01em;
  margin-bottom: 8px;
  padding: 0 4px;
  min-height: 30px;
}
.tree-toggle {
  width: 20px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  color: var(--text-tertiary);
  font-size: 16px;
}
.tree-toggle:hover { background: var(--bg-hover); color: var(--text); }
.structure-actions {
  display: inline-flex;
  gap: 2px;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.12s;
}
.section-label:hover .structure-actions,
.group-label:hover .structure-actions { opacity: 1; }
.structure-actions button {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: var(--text-tertiary);
}
.structure-actions button:hover { background: var(--bg-hover); color: var(--primary); }
.structure-actions button:last-child:hover { color: var(--red, #dc2626); }
.section-icon {
  color: var(--text-secondary);
}
.group {
  margin-bottom: 8px;
}
.group-box {
  border: 1px solid var(--border-light);
  border-radius: 6px;
  padding: 7px 10px 8px 14px;
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
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 6px;
  min-height: 27px;
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
  display: grid;
  grid-template-columns: 16px 18px minmax(0, 1fr) 112px 24px 24px;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.12s;
}
.page-check {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--primary);
  cursor: pointer;
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
  font-size: 13px;
  font-weight: 400;
  line-height: 1.35;
  min-width: 0;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-slug {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--text-secondary);
  font-family: monospace;
}
.page-action {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  flex: 0 0 24px;
  opacity: 0;
  transition: background 0.12s, color 0.12s;
}
.page-item:hover .page-action,
.page-action:focus-visible { opacity: 1; }
.page-action.delete:hover { background: var(--red-light, #fee2e2); color: var(--red, #dc2626); }
.page-action.edit:hover { background: var(--primary-light, #ede9fe); color: var(--primary, #533afd); }
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
.tree-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(25, 20, 45, .18);
}
.tree-dialog {
  width: min(380px, 100%);
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-card);
  box-shadow: 0 18px 50px rgba(25, 20, 45, .16);
}
.tree-dialog-head, .tree-dialog-actions { display: flex; align-items: center; justify-content: space-between; }
.tree-dialog-head { margin-bottom: 18px; color: var(--text); font-size: 15px; }
.tree-dialog-close { border: 0; background: transparent; color: var(--text-secondary); font-size: 18px; cursor: pointer; }
.tree-dialog-label { display: block; margin-bottom: 7px; color: var(--text-secondary); font-size: 12px; }
.tree-dialog-input { width: 100%; box-sizing: border-box; padding: 10px 11px; border: 1px solid var(--border); border-radius: 7px; color: var(--text); background: var(--bg-page); font-size: 14px; outline: none; }
.tree-dialog-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-lighter); }
.tree-dialog-help { margin: 9px 0 18px; color: var(--text-secondary); font-size: 12px; line-height: 1.5; }
.tree-dialog-actions { justify-content: flex-end; gap: 8px; }
.tree-dialog-cancel, .tree-dialog-submit { padding: 8px 14px; border-radius: 7px; font-size: 13px; cursor: pointer; }
.tree-dialog-cancel { border: 1px solid var(--border); background: transparent; color: var(--text-secondary); }
.tree-dialog-submit { border: 1px solid var(--primary); background: var(--primary); color: #fff; }
</style>
