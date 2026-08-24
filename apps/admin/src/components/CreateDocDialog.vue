<script setup lang="ts">
import { ref, computed } from 'vue'
import { createDoc, genOpenApi, type DocListItem } from '../api'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{
  close: []
  created: [slug: string]
  openapiGenerated: [docs: DocListItem[]]
}>()

type Tab = 'blank' | 'template' | 'openapi'
const tab = ref<Tab>('blank')

const title = ref('')
const slug = ref('')
const template = ref<'quickstart' | 'api-reference' | 'guide'>('quickstart')
const slugEdited = ref(false)

// 标题 → slug 自动生成（中文转拼音首字母 + 空格/特殊字符 → 连字符）
function titleToSlug(t: string): string {
  // 简单策略：非字母数字 → 连字符，小写，去首尾连字符
  // 中文标题会变成空，用户需手动填 slug
  return t
    .toLowerCase()
    .replace(/[^\w一-龥-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/[一-龥]/g, '') // 中文先去掉，用户手动填
}

function onTitleInput() {
  if (!slugEdited.value) {
    slug.value = titleToSlug(title.value)
  }
}

function onSlugInput() {
  slugEdited.value = true
}

const canSubmit = computed(() => {
  if (tab.value === 'openapi') return true
  return title.value.trim() !== '' && slug.value.trim() !== ''
})

const submitting = ref(false)
const error = ref('')

async function onConfirm() {
  error.value = ''
  if (tab.value === 'openapi') {
    submitting.value = true
    try {
      const r = await genOpenApi()
      emit('openapiGenerated', r.docs)
      emit('close')
      reset()
    } catch (e: any) {
      error.value = e.message
    } finally {
      submitting.value = false
    }
    return
  }

  if (!canSubmit.value) return
  submitting.value = true
  try {
    const r = await createDoc({
      title: title.value.trim(),
      slug: slug.value.trim(),
      template: tab.value === 'template' ? template.value : 'blank',
    })
    emit('created', r.slug)
    emit('close')
    reset()
  } catch (e: any) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}

function reset() {
  title.value = ''
  slug.value = ''
  slugEdited.value = false
  tab.value = 'blank'
  error.value = ''
}
</script>

<template>
  <div v-if="show" class="cd-mask" @click.self="emit('close')">
    <div class="cd-dialog">
      <div class="cd-head">
        <span>新建文档</span>
        <button class="cd-close" @click="emit('close')">×</button>
      </div>

      <!-- Tab 切换 -->
      <div class="cd-tabs">
        <button :class="['cd-tab', tab === 'blank' && 'active']" @click="tab = 'blank'">空白文档</button>
        <button :class="['cd-tab', tab === 'template' && 'active']" @click="tab = 'template'">从模板</button>
        <button :class="['cd-tab', tab === 'openapi' && 'active']" @click="tab = 'openapi'">从 OpenAPI 生成</button>
      </div>

      <div class="cd-body">
        <!-- 空白 / 模板 共用表单 -->
        <div v-if="tab === 'blank' || tab === 'template'" class="cd-form">
          <div class="cd-field">
            <label class="cd-label">标题</label>
            <input v-model="title" class="cd-input" placeholder="如：快速开始" @input="onTitleInput" />
          </div>
          <div class="cd-field">
            <label class="cd-label">slug（URL 路径）</label>
            <input v-model="slug" class="cd-input cd-mono" placeholder="如：quickstart 或 api/xxx" @input="onSlugInput" />
            <div class="cd-hint">只能小写字母/数字/连字符/斜杠。访问路径为 /docs/&lt;slug&gt;</div>
          </div>
          <div v-if="tab === 'template'" class="cd-field">
            <label class="cd-label">模板</label>
            <select v-model="template" class="cd-input cd-select">
              <option value="quickstart">quickstart（带步骤 + 代码示例）</option>
              <option value="api-reference">api-reference（接口参考）</option>
              <option value="guide">guide（场景指南）</option>
            </select>
            <div class="cd-hint">模板内容会复制为新文档，你可在此基础上改</div>
          </div>
        </div>

        <!-- OpenAPI 生成 -->
        <div v-else class="cd-openapi">
          <p class="cd-openapi-desc">
            扫描 <code>openapi.yaml</code> 全量生成 API 文档。已生成的会覆盖（幂等），手写文档不会被动。
          </p>
          <p class="cd-openapi-hint">生成的文档落在 content/api/ 目录，分类为「API 参考」。</p>
        </div>

        <div v-if="error" class="cd-error">{{ error }}</div>
      </div>

      <div class="cd-foot">
        <button class="btn cd-cancel" @click="emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="!canSubmit || submitting" @click="onConfirm">
          {{ tab === 'openapi' ? '立即生成' : '创建并打开' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cd-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cd-dialog {
  background: var(--bg-card);
  border-radius: 8px;
  width: 520px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
}
.cd-close {
  background: transparent;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: var(--text-tertiary);
  line-height: 1;
}
.cd-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  padding: 0 20px;
}
.cd-tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}
.cd-tab.active {
  color: var(--text);
  border-bottom-color: var(--primary);
  font-weight: 500;
}
.cd-body {
  padding: 16px 20px;
}
.cd-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cd-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cd-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}
.cd-input {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-card);
  color: var(--text);
  font-family: inherit;
}
.cd-mono {
  font-family: ui-monospace, monospace;
  font-size: 13px;
}
.cd-select {
  appearance: none;
  cursor: pointer;
}
.cd-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}
.cd-openapi-desc {
  font-size: 14px;
  color: var(--text);
  margin: 0 0 8px;
  line-height: 1.5;
}
.cd-openapi-desc code,
.cd-openapi-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}
.cd-openapi-hint {
  margin: 0;
}
.cd-error {
  margin-top: 12px;
  padding: 8px 10px;
  background: rgba(220, 38, 38, 0.08);
  border-radius: 6px;
  font-size: 13px;
  color: #dc2626;
}
.cd-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}
.cd-cancel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text);
}
</style>
