<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { openSearchPanel } from '@codemirror/search'
import MdxPreview from './preview/MdxPreview.vue'
import '../styles/preview.css'

const props = defineProps<{
  slug: string
  markdown: string
  baseCommit: string
  saving: boolean
  submitting: boolean
  saveState?: string // saving | saved | unsaved | conflict | mr
  mrInfo?: { iid: number; url: string } | null
}>()
const emit = defineEmits<{
  back: []
  save: [content: string]
  submit: [content: string]
  insertComponent: [name: string]
  contentChange: [content: string]
}>()

const editorHost = ref<HTMLElement | null>(null)
const doc = ref('') // 当前编辑器内容，驱动预览
let view: EditorView | null = null

// AI 选中改写浮菜单
const selMenu = ref<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false })
const aiLoading = ref(false)

// AI 生成抽屉 & 体检面板
const showGenerateDrawer = ref(false)
const showAuditPanel = ref(false)
const generateDesc = ref('')
const generateResult = ref('')
const generateLoading = ref(false)
const auditResult = ref<any[]>([])
const auditLoading = ref(false)

onMounted(() => {
  if (!editorHost.value) return
  doc.value = props.markdown
  view = new EditorView({
    state: EditorState.create({
      doc: props.markdown,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          { key: 'Mod-z', run: undo },
          { key: 'Mod-y', run: redo },
          { key: 'Mod-Shift-z', run: redo },
          { key: 'Mod-f', run: openSearchPanel },
          { key: 'Mod-h', run: openSearchPanel },
        ]),
        markdown(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            const content = u.state.doc.toString()
            doc.value = content
            emit('contentChange', content)
            // 选中改写：有选区时显示浮菜单
            const sel = u.state.selection.main
            if (sel.from !== sel.to) {
              const selected = u.state.doc.sliceString(sel.from, sel.to)
              if (selected.trim().length > 2) {
                const coords = view!.coordsAtPos(sel.to)
                if (coords) {
                  selMenu.value = { x: coords.right, y: coords.bottom + 4, show: true }
                }
              } else {
                selMenu.value.show = false
              }
            } else {
              selMenu.value.show = false
            }
          }
        }),
      ],
    }),
    parent: editorHost.value,
  })
})

onUnmounted(() => {
  view?.destroy()
})

// markdown prop 变化（打开新文档）时重置编辑器
watch(
  () => props.markdown,
  (newVal) => {
    if (view && view.state.doc.toString() !== newVal) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newVal },
      })
      doc.value = newVal
    }
  },
)

// 工具栏：在光标处插入语法
function insert(before: string, after = '', placeholder = '') {
  if (!view) return
  const sel = view.state.selection.main
  const selected = view.state.doc.sliceString(sel.from, sel.to) || placeholder
  const text = before + selected + after
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: text },
    selection: { anchor: sel.from + before.length, head: sel.from + before.length + selected.length },
  })
  view.focus()
}

function insertLine(prefix: string) {
  if (!view) return
  const sel = view.state.selection.main
  const line = view.state.doc.lineAt(sel.from)
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: prefix },
  })
  view.focus()
}

function getContent(): string {
  return view?.state.doc.toString() ?? ''
}

function onSave() {
  emit('save', getContent())
}
function onSubmit() {
  emit('submit', getContent())
}

// 撤销/重做/查找
function doUndo() {
  undo(view!)
  view?.focus()
}
function doRedo() {
  redo(view!)
  view?.focus()
}
function doSearch() {
  openSearchPanel(view!)
}

// ── 组件插入：光标处插入 MDX 片段 ──
function insertText(text: string, selectFrom?: number, selectTo?: number) {
  if (!view) return
  const sel = view.state.selection.main
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: text },
    selection:
      selectFrom !== undefined
        ? { anchor: sel.from + selectFrom, head: sel.from + (selectTo ?? selectFrom) }
        : { anchor: sel.from + text.length },
  })
  view.focus()
}

const componentTemplates: Record<string, () => string> = {
  Callout: () => `<Callout type="info" title="标题">\n\n提示内容\n\n</Callout>`,
  Steps: () => `<Steps>\n\n第一步\n\n第二步\n\n</Steps>`,
  InternalOnly: () => `<InternalOnly title="仅内部可见">\n\n内部内容\n\n</InternalOnly>`,
  NextSteps: () => `<NextSteps items={[\n  { title: '相关文档', description: '描述', href: '/docs/xxx' }\n]} />`,
}

function insertComponent(name: string) {
  // 简单组件直接插模板；CodeTabs/Params 弹表单
  if (name === 'CodeTabs' || name === 'Params') {
    emit('insertComponent', name)
    return
  }
  const tmpl = componentTemplates[name]?.()
  if (tmpl) insertText(tmpl)
}

// 父组件可调用：插入复杂组件（CodeTabs/Params 表单生成后的 MDX）
function insertMdx(mdx: string) {
  insertText(mdx)
}

defineExpose({ insertMdx, getContent })

// ── AI 能力（流式 SSE，边生成边显示）──

// 通用 SSE 读取：fetch + ReadableStream，每个 chunk 调 onChunk
async function streamSSE(
  url: string,
  body: Record<string, unknown>,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const parsed = JSON.parse(payload)
        if (parsed.chunk) onChunk(parsed.chunk)
        else if (parsed.error) throw new Error(parsed.error)
      } catch {
        // 半截 JSON 跳过
      }
    }
  }
}

async function aiRewriteSelection(mode: 'simplify' | 'expand' | 'fix' | 'tone') {
  if (!view) return
  const sel = view.state.selection.main
  const selected = view.state.doc.sliceString(sel.from, sel.to)
  if (!selected.trim()) return
  selMenu.value.show = false
  aiLoading.value = true
  // 流式：边收边替换选区，用占位插入 + 增量更新
  let inserted = false
  try {
    await streamSSE('/api/ai/rewrite', { text: selected, mode }, (chunk) => {
      if (!inserted) {
        view!.dispatch({
          changes: { from: sel.from, to: sel.to, insert: chunk },
          selection: { anchor: sel.from, head: sel.from + chunk.length },
        })
        inserted = true
      } else {
        // 后续 chunk 追加到光标处
        const pos = view!.state.selection.main.head
        view!.dispatch({
          changes: { from: pos, to: pos, insert: chunk },
          selection: { anchor: pos, head: pos + chunk.length },
        })
      }
    })
  } catch (e) {
    console.error('AI rewrite failed', e)
  } finally {
    aiLoading.value = false
    view?.focus()
  }
}

async function aiComplete() {
  if (!view) return
  const sel = view.state.selection.main
  // 取光标前 800 字上下文；光标在开头时用全文前 800 字
  const before =
    view.state.doc.sliceString(0, sel.from).slice(-800) ||
    view.state.doc.sliceString(0, 800)
  aiLoading.value = true
  let inserted = false
  try {
    await streamSSE('/api/ai/complete', { context: before }, (chunk) => {
      if (!inserted) {
        view!.dispatch({
          changes: { from: sel.from, to: sel.to, insert: chunk },
          selection: { anchor: sel.from, head: sel.from + chunk.length },
        })
        inserted = true
      } else {
        const pos = view!.state.selection.main.head
        view!.dispatch({
          changes: { from: pos, to: pos, insert: chunk },
          selection: { anchor: pos, head: pos + chunk.length },
        })
      }
    })
  } catch (e) {
    console.error('AI complete failed', e)
  } finally {
    aiLoading.value = false
    view?.focus()
  }
}

async function aiGenerate() {
  if (!generateDesc.value.trim()) return
  generateLoading.value = true
  generateResult.value = ''
  try {
    await streamSSE('/api/ai/generate', { prompt: generateDesc.value }, (chunk) => {
      generateResult.value += chunk
    })
  } catch (e) {
    console.error('AI generate failed', e)
  } finally {
    generateLoading.value = false
  }
}

function insertGenerateResult() {
  if (generateResult.value) {
    insertText(generateResult.value)
    showGenerateDrawer.value = false
    generateDesc.value = ''
    generateResult.value = ''
  }
}

async function aiAudit() {
  showAuditPanel.value = true
  auditLoading.value = true
  auditResult.value = []
  try {
    const res = await fetch('/api/ai/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc: getContent() }),
    })
    const data = await res.json()
    auditResult.value = data.issues || []
  } catch (e) {
    console.error('AI audit failed', e)
  } finally {
    auditLoading.value = false
  }
}

function jumpToIssue(issue: any) {
  if (!view || !issue.search) return
  // 在文档里搜索 issue.search 文本，定位光标
  const docStr = view.state.doc.toString()
  const idx = docStr.indexOf(issue.search)
  if (idx >= 0) {
    view.dispatch({
      selection: { anchor: idx, head: idx + issue.search.length },
      scrollIntoView: true,
    })
    view.focus()
  }
}

const tools = [
  { icon: 'ri-heading', title: '标题', action: () => insertLine('## ') },
  { icon: 'ri-bold', title: '粗体', action: () => insert('**', '**', '粗体') },
  { icon: 'ri-italic', title: '斜体', action: () => insert('*', '*', '斜体') },
  { icon: 'ri-link', title: '链接', action: () => insert('[', '](url)', '链接文字') },
  { icon: 'ri-code-line', title: '代码块', action: () => insert('```\n', '\n```', 'code') },
  { icon: 'ri-list-unordered', title: '列表', action: () => insertLine('- ') },
]

const componentTools = [
  { icon: 'ri-information-line', title: 'Callout 提示', name: 'Callout' },
  { icon: 'ri-list-ordered', title: 'Steps 步骤', name: 'Steps' },
  { icon: 'ri-code-s-slash-line', title: 'CodeTabs 代码页签', name: 'CodeTabs' },
  { icon: 'ri-table-line', title: 'Params 参数表', name: 'Params' },
  { icon: 'ri-lock-line', title: 'InternalOnly 仅内部', name: 'InternalOnly' },
  { icon: 'ri-rocket-line', title: 'NextSteps 下一步', name: 'NextSteps' },
]

const aiTools = [
  { icon: 'ri-magic-line', title: 'AI 续写', action: aiComplete },
  { icon: 'ri-pencil-line', title: 'AI 生成', action: () => (showGenerateDrawer.value = true) },
  { icon: 'ri-stethoscope-line', title: '文档体检', action: aiAudit },
]

const rewriteModes = [
  { key: 'simplify' as const, label: '精简' },
  { key: 'expand' as const, label: '扩写' },
  { key: 'fix' as const, label: '纠错' },
  { key: 'tone' as const, label: '改语气' },
]

// ── 双栏调宽 ──
const editWidth = ref(1)
const previewWidth = ref(1)

function startResize(e: MouseEvent) {
  e.preventDefault()
  const container = (e.target as HTMLElement).parentElement as HTMLElement
  if (!container) return
  const startX = e.clientX
  const startEdit = editWidth.value
  const startPreview = previewWidth.value
  const totalWidth = container.clientWidth
  function onMove(ev: MouseEvent) {
    const dx = ev.clientX - startX
    const ratio = dx / totalWidth
    let newEdit = startEdit + ratio * (startEdit + startPreview)
    newEdit = Math.max(0.3, Math.min(2.5, newEdit))
    const sum = startEdit + startPreview
    editWidth.value = newEdit
    previewWidth.value = sum - newEdit
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    // 持久化比例
    try {
      localStorage.setItem('editor:split', String(editWidth.value / (editWidth.value + previewWidth.value)))
    } catch {
      /* ignore */
    }
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// 恢复保存的比例
try {
  const saved = localStorage.getItem('editor:split')
  if (saved) {
    const r = parseFloat(saved)
    if (r > 0.1 && r < 0.9) {
      editWidth.value = r
      previewWidth.value = 1 - r
    }
  }
} catch {
  /* ignore */
}
</script>

<template>
  <div class="editor-page">
    <div class="editor-toolbar">
      <button class="tool-btn back-btn" @click="emit('back')">
        <i class="ri-arrow-left-line"></i> 返回列表
      </button>
      <div class="tool-divider"></div>
      <button class="tool-btn" title="撤销 (Cmd+Z)" @click="doUndo"><i class="ri-arrow-go-back-line"></i></button>
      <button class="tool-btn" title="重做 (Cmd+Shift+Z)" @click="doRedo"><i class="ri-arrow-go-forward-line"></i></button>
      <button class="tool-btn" title="查找替换 (Cmd+F)" @click="doSearch"><i class="ri-search-line"></i></button>
      <div class="tool-divider"></div>
      <button v-for="t in tools" :key="t.title" class="tool-btn" :title="t.title" @click="t.action">
        <i :class="t.icon"></i>
      </button>
      <div class="tool-divider"></div>
      <button v-for="c in componentTools" :key="c.name" class="tool-btn" :title="c.title" @click="insertComponent(c.name)">
        <i :class="c.icon"></i>
      </button>
      <div class="tool-divider"></div>
      <button v-for="a in aiTools" :key="a.title" class="tool-btn ai-btn" :title="a.title" :disabled="aiLoading" @click="a.action">
        <i :class="a.icon"></i>
      </button>
      <div class="tool-spacer"></div>
      <span class="base-commit" :title="'base: ' + baseCommit">base: {{ baseCommit.slice(0, 8) }}</span>
      <button class="btn btn-primary" :disabled="saving" @click="onSave">
        {{ saving ? '保存中…' : '保存草稿' }}
      </button>
      <button class="btn btn-primary" :disabled="submitting" @click="onSubmit">
        {{ submitting ? '提交中…' : '提交审核' }}
      </button>
    </div>
    <div class="editor-body">
      <div class="editor-pane" :style="{ flex: editWidth }">
        <div class="pane-label">编辑 · {{ slug }}</div>
        <div ref="editorHost" class="cm-host"></div>
      </div>
      <div class="resize-divider" @mousedown="startResize"></div>
      <div class="preview-pane" :style="{ flex: previewWidth }">
        <div class="pane-label">预览 · MDX 实时渲染</div>
        <div class="preview-content">
          <MdxPreview :source="doc" />
        </div>
      </div>
    </div>
    <!-- 状态条 -->
    <div class="editor-status-bar">
      <span v-if="aiLoading" class="status-ai">AI 处理中…</span>
      <span v-else-if="saveState === 'saving'" class="status-saving">保存中…</span>
      <span v-else-if="saveState === 'saved'" class="status-saved">已保存</span>
      <span v-else-if="saveState === 'conflict'" class="status-conflict">冲突！请处理</span>
      <span v-else-if="saveState === 'mr' && mrInfo" class="status-mr">
        MR #{{ mrInfo.iid }} 已创建 →
        <a :href="mrInfo.url" target="_blank">{{ mrInfo.url }}</a>
      </span>
      <span v-else class="status-unsaved">未保存更改</span>
    </div>
    <!-- AI 选中改写浮菜单 -->
    <div
      v-if="selMenu.show"
      class="ai-sel-menu"
      :style="{ left: selMenu.x + 'px', top: selMenu.y + 'px' }"
    >
      <span class="ai-sel-label">改写：</span>
      <button v-for="m in rewriteModes" :key="m.key" class="ai-sel-btn" @click="aiRewriteSelection(m.key)">{{ m.label }}</button>
    </div>
    <!-- AI 生成抽屉 -->
    <div v-if="showGenerateDrawer" class="ai-drawer-mask" @click.self="showGenerateDrawer = false">
      <div class="ai-drawer">
        <div class="ai-drawer-head">
          <span>AI 从描述生成</span>
          <button class="ai-drawer-close" @click="showGenerateDrawer = false">×</button>
        </div>
        <textarea v-model="generateDesc" class="ai-drawer-input" placeholder="描述你要写的内容，如「写一段鉴权失败 401 的排障说明」"></textarea>
        <button class="btn btn-primary" :disabled="generateLoading || !generateDesc.trim()" @click="aiGenerate">
          {{ generateLoading ? '生成中…' : '生成' }}
        </button>
        <div v-if="generateResult" class="ai-drawer-result">
          <div class="ai-drawer-result-label">生成结果（可编辑后插入）：</div>
          <textarea v-model="generateResult" class="ai-drawer-output"></textarea>
          <button class="btn btn-primary" @click="insertGenerateResult">插入到光标处</button>
        </div>
      </div>
    </div>
    <!-- 文档体检面板 -->
    <div v-if="showAuditPanel" class="ai-drawer-mask" @click.self="showAuditPanel = false">
      <div class="ai-drawer ai-audit-drawer">
        <div class="ai-drawer-head">
          <span>文档体检</span>
          <button class="ai-drawer-close" @click="showAuditPanel = false">×</button>
        </div>
        <div v-if="auditLoading" class="ai-audit-loading">体检中…</div>
        <div v-else-if="auditResult.length === 0" class="ai-audit-empty">未发现问题</div>
        <div v-else class="ai-audit-list">
          <div v-for="(issue, i) in auditResult" :key="i" class="ai-audit-item" @click="jumpToIssue(issue)">
            <span class="ai-audit-cat" :data-cat="issue.category">{{ issue.category }}</span>
            <span class="ai-audit-msg">{{ issue.message }}</span>
            <span v-if="issue.search" class="ai-audit-locate">定位 →</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  position: relative;
}
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px 8px 0 0;
  border-bottom: none;
  flex-wrap: wrap;
}
.tool-btn {
  padding: 6px 10px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 16px;
  transition: background 0.15s;
  background: transparent;
  border: none;
  cursor: pointer;
}
.tool-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text);
}
.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.ai-btn {
  color: var(--primary);
}
.back-btn {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.tool-divider {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 4px;
}
.tool-spacer {
  flex: 1;
}
.base-commit {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: ui-monospace, monospace;
  margin-right: 8px;
}
.editor-body {
  display: flex;
  flex: 1;
  border: 1px solid var(--border);
  border-top: none;
  overflow: hidden;
  background: var(--bg-card);
}
.editor-pane,
.preview-pane {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 200px;
}
.resize-divider {
  width: 4px;
  background: var(--border);
  cursor: col-resize;
  flex-shrink: 0;
}
.resize-divider:hover {
  background: var(--primary);
}
.pane-label {
  padding: 6px 16px;
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border-light);
}
.cm-host {
  flex: 1;
  overflow: auto;
  font-size: 14px;
}
.cm-host :deep(.cm-editor) {
  height: 100%;
}
.cm-host :deep(.cm-scroller) {
  font-family: ui-monospace, 'SF Mono', monospace;
}
.preview-pane {
  overflow: auto;
}
.preview-content {
  padding: 16px 24px;
  overflow: auto;
  flex: 1;
}
/* 状态条 */
.editor-status-bar {
  padding: 6px 16px;
  font-size: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 8px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-saving,
.status-ai { color: var(--text-tertiary); }
.status-saved { color: var(--success, #0a8); }
.status-unsaved { color: var(--text-tertiary); }
.status-conflict { color: var(--danger, #e00); font-weight: 500; }
.status-mr a { color: var(--primary); }
/* AI 选中改写浮菜单 */
.ai-sel-menu {
  position: fixed;
  z-index: 100;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  padding: 4px;
  display: flex;
  align-items: center;
  gap: 2px;
}
.ai-sel-label {
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 0 6px;
}
.ai-sel-btn {
  padding: 4px 10px;
  font-size: 12px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
}
.ai-sel-btn:hover {
  background: var(--primary);
  color: #fff;
}
/* AI 抽屉 */
.ai-drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
}
.ai-drawer {
  width: 480px;
  max-width: 90vw;
  background: var(--bg-card);
  height: 100%;
  padding: 20px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ai-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 500;
  color: var(--text);
}
.ai-drawer-close {
  background: transparent;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-tertiary);
  line-height: 1;
}
.ai-drawer-input,
.ai-drawer-output {
  width: 100%;
  min-height: 80px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
  background: var(--bg-card);
  color: var(--text);
}
.ai-drawer-output {
  min-height: 200px;
  font-family: ui-monospace, monospace;
  font-size: 13px;
}
.ai-drawer-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ai-drawer-result-label {
  font-size: 12px;
  color: var(--text-tertiary);
}
/* 文档体检 */
.ai-audit-drawer { width: 420px; }
.ai-audit-loading,
.ai-audit-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
}
.ai-audit-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ai-audit-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
}
.ai-audit-item:hover {
  background: var(--bg-hover);
}
.ai-audit-cat {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  flex-shrink: 0;
}
.ai-audit-cat[data-cat="技术准确性"] { background: rgba(224,0,0,0.1); color: #e00; }
.ai-audit-cat[data-cat="链接"] { background: rgba(0,112,243,0.1); color: var(--primary); }
.ai-audit-cat[data-cat="标点"] { background: rgba(245,166,35,0.1); color: #f5a623; }
.ai-audit-cat[data-cat="口语化"] { background: rgba(0,168,0,0.1); color: #0a8; }
.ai-audit-msg { flex: 1; }
.ai-audit-locate { color: var(--primary); font-size: 12px; }
</style>
