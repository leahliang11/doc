<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import MarkdownIt from 'markdown-it'

const props = defineProps<{
  slug: string
  markdown: string
  baseCommit: string
  saving: boolean
  submitting: boolean
}>()
const emit = defineEmits<{
  back: []
  save: [content: string]
  submit: [content: string]
}>()

const editorHost = ref<HTMLElement | null>(null)
const preview = ref('')
let view: EditorView | null = null

const md = new MarkdownIt({ html: true, breaks: false })

function updatePreview(docText: string) {
  preview.value = md.render(docText)
}

onMounted(() => {
  if (!editorHost.value) return
  view = new EditorView({
    state: EditorState.create({
      doc: props.markdown,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) updatePreview(u.state.doc.toString())
        }),
      ],
    }),
    parent: editorHost.value,
  })
  updatePreview(props.markdown)
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
      updatePreview(newVal)
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

const tools = [
  { icon: 'ri-heading', title: '标题', action: () => insertLine('## ') },
  { icon: 'ri-bold', title: '粗体', action: () => insert('**', '**', '粗体') },
  { icon: 'ri-italic', title: '斜体', action: () => insert('*', '*', '斜体') },
  { icon: 'ri-link', title: '链接', action: () => insert('[', '](url)', '链接文字') },
  { icon: 'ri-code-line', title: '代码块', action: () => insert('```\n', '\n```', 'code') },
  { icon: 'ri-list-unordered', title: '列表', action: () => insertLine('- ') },
]
</script>

<template>
  <div class="editor-page">
    <div class="editor-toolbar">
      <button class="tool-btn back-btn" @click="emit('back')">
        <i class="ri-arrow-left-line"></i> 返回列表
      </button>
      <div class="tool-divider"></div>
      <button v-for="t in tools" :key="t.title" class="tool-btn" :title="t.title" @click="t.action">
        <i :class="t.icon"></i>
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
      <div class="editor-pane">
        <div class="pane-label">编辑 · {{ slug }}</div>
        <div ref="editorHost" class="cm-host"></div>
      </div>
      <div class="preview-pane">
        <div class="pane-label">预览</div>
        <div class="preview-content" v-html="preview"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
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
}
.tool-btn {
  padding: 6px 10px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 16px;
  transition: background 0.15s;
}
.tool-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
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
  border-radius: 0 0 8px 8px;
  overflow: hidden;
  background: var(--bg-card);
}
.editor-pane,
.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.editor-pane {
  border-right: 1px solid var(--border);
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
  font-size: 14px;
  line-height: 1.7;
  color: var(--text);
}
.preview-content :deep(h1) {
  font-size: 22px;
  margin: 16px 0 8px;
}
.preview-content :deep(h2) {
  font-size: 18px;
  margin: 16px 0 8px;
}
.preview-content :deep(h3) {
  font-size: 15px;
  margin: 12px 0 6px;
}
.preview-content :deep(p) {
  margin: 0 0 10px;
}
.preview-content :deep(pre) {
  background: var(--bg-hover);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
}
.preview-content :deep(code) {
  font-family: ui-monospace, monospace;
}
.preview-content :deep(ul),
.preview-content :deep(ol) {
  padding-left: 20px;
  margin: 0 0 10px;
}
.preview-content :deep(a) {
  color: var(--primary);
}
</style>
