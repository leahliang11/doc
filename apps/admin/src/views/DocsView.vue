<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import DocList from '../components/DocList.vue'
import Editor from '../components/Editor.vue'
import ConflictDialog from '../components/ConflictDialog.vue'
import ComponentInsertDialog from '../components/ComponentInsertDialog.vue'
import { openDoc, saveDoc, submitReview, type DocListItem } from '../api'

const mode = ref<'list' | 'edit'>('list')
const currentSlug = ref('')
const markdown = ref('')
const baseCommit = ref('')
const currentBranch = ref('')
const saving = ref(false)
const submitting = ref(false)
const toast = ref('')
const conflict = ref<{ remoteMarkdown: string; message: string } | null>(null)
const mrResult = ref<{ iid: number; url: string } | null>(null)

// 组件插入弹窗
const insertDialog = ref<{ show: boolean; component: 'CodeTabs' | 'Params' | null }>({
  show: false,
  component: null,
})

// 编辑器实例引用（用于插入复杂组件生成的 MDX）
const editorRef = ref<InstanceType<typeof Editor> | null>(null)

// 脏状态 + 自动保存草稿
const dirty = ref(false)
const lastSavedContent = ref('')
const saveState = ref<'unsaved' | 'saving' | 'saved' | 'conflict' | 'mr'>('unsaved')
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

function onContentChange(content: string) {
  // 自动保存草稿到 localStorage（防抖 3s）
  if (content === lastSavedContent.value) {
    dirty.value = false
    if (saveState.value !== 'mr' && saveState.value !== 'conflict') saveState.value = 'saved'
    return
  }
  dirty.value = true
  if (saveState.value !== 'mr' && saveState.value !== 'conflict') saveState.value = 'unsaved'
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(`draft:${currentSlug.value}`, content)
    } catch {
      /* ignore */
    }
  }, 3000)
}

// 离开拦截
function beforeUnloadHandler(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnloadHandler))
onUnmounted(() => window.removeEventListener('beforeunload', beforeUnloadHandler))

async function onOpen(doc: DocListItem) {
  // 脏状态确认
  if (dirty.value && !confirm('有未保存的改动，确认切换文档？')) return
  toast.value = '打开中…'
  try {
    const r = await openDoc(doc.slug)
    currentSlug.value = doc.slug
    markdown.value = r.markdown
    baseCommit.value = r.base_commit
    currentBranch.value = ''
    lastSavedContent.value = r.markdown
    dirty.value = false
    saveState.value = 'saved'
    mode.value = 'edit'
    toast.value = ''
  } catch (e: any) {
    toast.value = '打开失败：' + e.message
  }
}

// 新建文档后自动打开
async function onCreated(slug: string) {
  toast.value = '文档已创建，打开中…'
  await onOpen({ slug, title: '', category: '', status: 'draft', updated: '' })
}

async function onSave(content: string) {
  saving.value = true
  saveState.value = 'saving'
  toast.value = '保存中…'
  try {
    const r = await saveDoc(currentSlug.value, content, baseCommit.value)
    currentBranch.value = r.branch
    baseCommit.value = r.commit_hash
    lastSavedContent.value = content
    dirty.value = false
    saveState.value = 'saved'
    toast.value = `已保存：commit ${r.commit_hash.slice(0, 8)}，分支 ${r.branch}`
    // 清理草稿
    try { localStorage.removeItem(`draft:${currentSlug.value}`) } catch { /* ignore */ }
  } catch (e: any) {
    if (e.status === 409 && e.remote_markdown) {
      conflict.value = { remoteMarkdown: e.remote_markdown, message: e.message }
      saveState.value = 'conflict'
      toast.value = '检测到冲突'
    } else {
      saveState.value = 'unsaved'
      toast.value = '保存失败：' + e.message
    }
  } finally {
    saving.value = false
  }
}

async function onSubmit(content: string) {
  submitting.value = true
  toast.value = '提交审核中…'
  try {
    if (!currentBranch.value) {
      const r = await saveDoc(currentSlug.value, content, baseCommit.value)
      currentBranch.value = r.branch
      baseCommit.value = r.commit_hash
      lastSavedContent.value = content
      dirty.value = false
    }
    const r = await submitReview(currentSlug.value, currentBranch.value)
    mrResult.value = { iid: r.mr_iid, url: r.mr_url }
    saveState.value = 'mr'
    toast.value = '已提交审核'
  } catch (e: any) {
    toast.value = '提交失败：' + e.message
  } finally {
    submitting.value = false
  }
}

// 组件插入：Editor 发出 insertComponent 事件（CodeTabs/Params 弹表单）
function onInsertComponent(name: string) {
  if (name === 'CodeTabs' || name === 'Params') {
    insertDialog.value = { show: true, component: name }
  }
}
// 表单确认插入
function onInsertMdx(mdx: string) {
  editorRef.value?.insertMdx(mdx)
}

function backToList() {
  if (dirty.value && !confirm('有未保存的改动，确认返回列表？')) return
  mode.value = 'list'
  currentSlug.value = ''
  markdown.value = ''
  baseCommit.value = ''
  currentBranch.value = ''
  toast.value = ''
  mrResult.value = null
  dirty.value = false
  saveState.value = 'unsaved'
}

// 冲突弹窗：用我的覆盖（重新 open 拿最新 base，再保存）
async function overwriteMine() {
  if (!conflict.value) return
  conflict.value = null
  const r = await openDoc(currentSlug.value)
  baseCommit.value = r.base_commit
  saveState.value = 'unsaved'
  toast.value = '已加载远端最新版本，请重新点保存'
}
async function discardMine() {
  if (!conflict.value) return
  markdown.value = conflict.value.remoteMarkdown
  conflict.value = null
  const r = await openDoc(currentSlug.value)
  baseCommit.value = r.base_commit
  lastSavedContent.value = r.markdown
  dirty.value = false
  saveState.value = 'saved'
  toast.value = '已放弃改动，加载远端最新版本'
}
</script>

<template>
  <div>
    <div v-if="toast" class="toast">{{ toast }}</div>

    <DocList v-if="mode === 'list'" @open="onOpen" @created="onCreated" />
    <Editor
      v-else
      ref="editorRef"
      :slug="currentSlug"
      :markdown="markdown"
      :base-commit="baseCommit"
      :saving="saving"
      :submitting="submitting"
      :save-state="saveState"
      :mr-info="mrResult"
      @back="backToList"
      @save="onSave"
      @submit="onSubmit"
      @insert-component="onInsertComponent"
      @content-change="onContentChange"
    />

    <ComponentInsertDialog
      :show="insertDialog.show"
      :component="insertDialog.component"
      @close="insertDialog = { show: false, component: null }"
      @insert="onInsertMdx"
    />

    <ConflictDialog
      v-if="conflict"
      :message="conflict.message"
      @overwrite="overwriteMine"
      @discard="discardMine"
    />

    <!-- MR 结果弹窗 -->
    <div v-if="mrResult" class="modal-mask" @click="mrResult = null">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <i class="ri-checkbox-circle-line modal-icon"></i>
          <span>已提交审核</span>
        </div>
        <p class="modal-body">合并请求 #{{ mrResult.iid }} 已创建：</p>
        <a :href="mrResult.url" target="_blank" class="modal-link">{{ mrResult.url }}</a>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="mrResult = null">关闭</button>
          <button class="btn" @click="backToList">返回列表</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 200;
  background: var(--text);
  color: #fff;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  box-shadow: var(--shadow-md);
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}
.modal {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 24px;
  min-width: 420px;
  box-shadow: var(--shadow-lg);
}
.modal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}
.modal-icon {
  color: var(--green);
  font-size: 22px;
}
.modal-body {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.modal-link {
  display: block;
  color: var(--primary);
  font-size: 13px;
  word-break: break-all;
  padding: 8px 12px;
  background: var(--primary-lighter);
  border-radius: 6px;
  margin-bottom: 16px;
}
.modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
