<script setup lang="ts">
import { ref } from 'vue'
import DocList from '../components/DocList.vue'
import Editor from '../components/Editor.vue'
import ConflictDialog from '../components/ConflictDialog.vue'
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

async function onOpen(doc: DocListItem) {
  toast.value = '打开中…'
  try {
    const r = await openDoc(doc.slug)
    currentSlug.value = doc.slug
    markdown.value = r.markdown
    baseCommit.value = r.base_commit
    currentBranch.value = ''
    mode.value = 'edit'
    toast.value = ''
  } catch (e: any) {
    toast.value = '打开失败：' + e.message
  }
}

async function onSave(content: string) {
  saving.value = true
  toast.value = '保存中…'
  try {
    const r = await saveDoc(currentSlug.value, content, baseCommit.value)
    currentBranch.value = r.branch
    // base_commit 更新为最新 commit（下次保存基于这个）
    baseCommit.value = r.commit_hash
    toast.value = `已保存：commit ${r.commit_hash.slice(0, 8)}，分支 ${r.branch}`
  } catch (e: any) {
    if (e.status === 409 && e.remote_markdown) {
      conflict.value = { remoteMarkdown: e.remote_markdown, message: e.message }
      toast.value = '检测到冲突'
    } else {
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
    // 先保存确保有 draft 分支
    if (!currentBranch.value) {
      const r = await saveDoc(currentSlug.value, content, baseCommit.value)
      currentBranch.value = r.branch
      baseCommit.value = r.commit_hash
    }
    const r = await submitReview(currentSlug.value, currentBranch.value)
    mrResult.value = { iid: r.mr_iid, url: r.mr_url }
    toast.value = '已提交审核'
  } catch (e: any) {
    toast.value = '提交失败：' + e.message
  } finally {
    submitting.value = false
  }
}

function backToList() {
  mode.value = 'list'
  currentSlug.value = ''
  markdown.value = ''
  baseCommit.value = ''
  currentBranch.value = ''
  toast.value = ''
  mrResult.value = null
}

// 冲突弹窗：用我的覆盖（重新保存，base_commit 已是远端最新）
async function overwriteMine() {
  if (!conflict.value) return
  baseCommit.value = '' // 留空会触发后端用最新？不——后端要 base_commit。改为重新 open 拿最新 base
  conflict.value = null
  // 重新打开拿最新 base_commit，再让用户保存
  const r = await openDoc(currentSlug.value)
  baseCommit.value = r.base_commit
  toast.value = '已加载远端最新版本，请重新点保存'
}
// 冲突弹窗：放弃我的改动
async function discardMine() {
  if (!conflict.value) return
  markdown.value = conflict.value.remoteMarkdown
  conflict.value = null
  // 重新拿最新 base_commit
  const r = await openDoc(currentSlug.value)
  baseCommit.value = r.base_commit
  toast.value = '已放弃改动，加载远端最新版本'
}
</script>

<template>
  <div>
    <div v-if="toast" class="toast">{{ toast }}</div>

    <DocList v-if="mode === 'list'" @open="onOpen" />
    <Editor
      v-else
      :slug="currentSlug"
      :markdown="markdown"
      :base-commit="baseCommit"
      :saving="saving"
      :submitting="submitting"
      @back="backToList"
      @save="onSave"
      @submit="onSubmit"
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
