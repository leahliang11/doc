<script setup lang="ts">
import { ref, computed } from 'vue'
import { createDoc, genOpenApi, aiDraftDoc, type DocListItem, type AiDraftResult } from '../api'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{
  close: []
  created: [slug: string]
  openapiGenerated: [docs: DocListItem[]]
}>()

type Tab = 'blank' | 'template' | 'ai' | 'openapi'
const tab = ref<Tab>('blank')

// 空白 / 模板 共用字段
const title = ref('')
const slug = ref('')
const template = ref<'quickstart' | 'api-reference' | 'guide'>('quickstart')
const slugEdited = ref(false)

// AI 生成字段
const aiDescription = ref('')
const aiCategoryHint = ref('guides')
const aiGenerating = ref(false)
const aiResult = ref<AiDraftResult | null>(null)
const aiTitle = ref('')
const aiSlug = ref('')
const aiError = ref('')

const CATEGORY_OPTIONS = [
  { value: 'quickstart', label: '快速开始' },
  { value: 'api', label: 'API 参考' },
  { value: 'models', label: '模型说明' },
  { value: 'guides', label: '场景指南' },
  { value: 'troubleshooting', label: '排障' },
]

function titleToSlug(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^\w一-龥-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/[一-龥]/g, '')
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
  if (tab.value === 'ai') {
    return !!aiResult.value && aiTitle.value.trim() !== '' && aiSlug.value.trim() !== ''
  }
  return title.value.trim() !== '' && slug.value.trim() !== ''
})

const submitting = ref(false)
const error = ref('')

// AI 生成草稿
async function onGenerateDraft() {
  if (!aiDescription.value.trim()) return
  aiGenerating.value = true
  aiResult.value = null
  aiError.value = ''
  try {
    const result = await aiDraftDoc({
      description: aiDescription.value.trim(),
      categoryHint: aiCategoryHint.value,
    })
    aiResult.value = result
    aiTitle.value = result.title
    aiSlug.value = result.suggestedSlug
  } catch (e: any) {
    aiError.value = e.message || 'AI 生成失败，请重试'
  } finally {
    aiGenerating.value = false
  }
}

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
    if (tab.value === 'ai' && aiResult.value) {
      const r = await createDoc({
        title: aiTitle.value.trim(),
        slug: aiSlug.value.trim(),
        content: aiResult.value.mdxContent,
      })
      emit('created', r.slug)
    } else {
      const r = await createDoc({
        title: title.value.trim(),
        slug: slug.value.trim(),
        template: tab.value === 'template' ? template.value : 'blank',
      })
      emit('created', r.slug)
    }
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
  aiDescription.value = ''
  aiResult.value = null
  aiTitle.value = ''
  aiSlug.value = ''
  aiError.value = ''
}
</script>

<template>
  <div v-if="show" class="cd-mask" @click.self="emit('close')">
    <div class="cd-dialog" :class="{ 'cd-dialog--wide': tab === 'ai' && aiResult }">
      <div class="cd-head">
        <span>新建文档</span>
        <button class="cd-close" @click="emit('close')">×</button>
      </div>

      <!-- Tab 切换 -->
      <div class="cd-tabs">
        <button :class="['cd-tab', tab === 'blank' && 'active']" @click="tab = 'blank'">空白文档</button>
        <button :class="['cd-tab', tab === 'template' && 'active']" @click="tab = 'template'">从模板</button>
        <button :class="['cd-tab', tab === 'ai' && 'active']" @click="tab = 'ai'">
          <i class="ri-sparkling-line"></i> AI 一句话生成
        </button>
        <button :class="['cd-tab', tab === 'openapi' && 'active']" @click="tab = 'openapi'">从 OpenAPI</button>
      </div>

      <div class="cd-body">
        <!-- 空白 / 模板 共用表单 -->
        <div v-if="tab === 'blank' || tab === 'template'" class="cd-form">
          <div class="cd-field">
            <label class="cd-label">标题</label>
            <input v-model="title" class="cd-input" placeholder="如：流式响应接入指南" @input="onTitleInput" />
          </div>
          <div class="cd-field">
            <label class="cd-label">slug（URL 路径）</label>
            <input v-model="slug" class="cd-input cd-mono" placeholder="如：guides/streaming" @input="onSlugInput" />
            <div class="cd-hint">只能小写字母/数字/连字符/斜杠。访问路径为 /docs/&lt;slug&gt;</div>
          </div>
          <div v-if="tab === 'template'" class="cd-field">
            <label class="cd-label">模板</label>
            <select v-model="template" class="cd-input cd-select">
              <option value="quickstart">快速开始（带步骤 + 代码示例）</option>
              <option value="api-reference">API 参考（接口说明 + 参数表）</option>
              <option value="guide">场景指南（概述 + 操作 + 注意事项）</option>
            </select>
          </div>
        </div>

        <!-- AI 一句话生成 -->
        <div v-else-if="tab === 'ai'" class="cd-ai">
          <!-- 第一步：输入描述 -->
          <div v-if="!aiResult" class="cd-ai-input-area">
            <div class="cd-field">
              <label class="cd-label">用一句话描述你想写什么</label>
              <textarea
                v-model="aiDescription"
                class="cd-input cd-ai-desc"
                placeholder="例如：如何使用 JoyMaaS 实现流式响应，让用户边生成边看到内容&#10;例如：Python SDK 快速上手，5 分钟跑通第一次调用&#10;例如：429 限流错误的原因与处理方法"
                rows="3"
              ></textarea>
            </div>
            <div class="cd-field">
              <label class="cd-label">文档类别</label>
              <select v-model="aiCategoryHint" class="cd-input cd-select">
                <option v-for="c in CATEGORY_OPTIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </div>
            <div v-if="aiError" class="cd-error">{{ aiError }}</div>
            <button
              class="btn btn-primary cd-ai-gen-btn"
              :disabled="!aiDescription.trim() || aiGenerating"
              @click="onGenerateDraft"
            >
              <i v-if="aiGenerating" class="ri-loader-4-line cd-spin"></i>
              <i v-else class="ri-sparkling-line"></i>
              {{ aiGenerating ? 'AI 生成中（约 10-15 秒）…' : '生成草稿' }}
            </button>
          </div>

          <!-- 第二步：预览 + 确认 -->
          <div v-else class="cd-ai-result">
            <div class="cd-ai-result-header">
              <span class="cd-ai-badge"><i class="ri-check-line"></i> 草稿已生成</span>
              <button class="cd-ai-regenerate" @click="aiResult = null">重新描述</button>
            </div>
            <div class="cd-form cd-ai-meta">
              <div class="cd-field">
                <label class="cd-label">标题（可修改）</label>
                <input v-model="aiTitle" class="cd-input" />
              </div>
              <div class="cd-field">
                <label class="cd-label">slug（可修改）</label>
                <input v-model="aiSlug" class="cd-input cd-mono" />
              </div>
            </div>
            <div class="cd-ai-preview">
              <div class="cd-ai-preview-label">内容预览（保存后在编辑器里继续修改）</div>
              <pre class="cd-ai-preview-content">{{ aiResult.mdxContent.slice(0, 600) }}{{ aiResult.mdxContent.length > 600 ? '\n…（更多内容）' : '' }}</pre>
            </div>
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
        <button
          v-if="tab !== 'ai' || aiResult"
          class="btn btn-primary"
          :disabled="!canSubmit || submitting"
          @click="onConfirm"
        >
          {{ tab === 'openapi' ? '立即生成' : '创建并打开编辑器' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cd-mask {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 200;
  display: flex; align-items: center; justify-content: center;
}
.cd-dialog {
  background: var(--bg-card);
  border-radius: 12px;
  width: 520px; max-width: 90vw;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}
.cd-dialog--wide { width: 700px; }
.cd-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  font-size: 15px; font-weight: 600; color: var(--text);
}
.cd-close {
  background: transparent; border: none;
  font-size: 22px; cursor: pointer;
  color: var(--text-tertiary); line-height: 1;
}
.cd-tabs {
  display: flex; border-bottom: 1px solid var(--border);
  padding: 0 20px; gap: 2px;
}
.cd-tab {
  background: transparent; border: none;
  border-bottom: 2px solid transparent;
  padding: 10px 10px; font-size: 13px;
  color: var(--text-secondary); cursor: pointer;
  display: flex; align-items: center; gap: 4px;
  white-space: nowrap;
}
.cd-tab i { font-size: 13px; color: var(--brand); }
.cd-tab.active { color: var(--text); border-bottom-color: var(--brand); font-weight: 500; }
.cd-body { padding: 16px 20px; overflow-y: auto; max-height: 60vh; }
.cd-form { display: flex; flex-direction: column; gap: 14px; }
.cd-field { display: flex; flex-direction: column; gap: 6px; }
.cd-label { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
.cd-input {
  padding: 8px 10px;
  border: 1px solid var(--border); border-radius: 6px;
  font-size: 14px; background: var(--bg-card);
  color: var(--text); font-family: inherit;
  transition: border-color 0.15s;
}
.cd-input:focus { outline: none; border-color: var(--brand); }
.cd-mono { font-family: ui-monospace, monospace; font-size: 13px; }
.cd-select { appearance: none; cursor: pointer; }
.cd-hint { font-size: 12px; color: var(--text-tertiary); }
.cd-openapi-desc { font-size: 14px; color: var(--text); margin: 0 0 8px; line-height: 1.5; }
.cd-openapi-desc code, .cd-openapi-hint { font-size: 12px; color: var(--text-tertiary); }
.cd-openapi-hint { margin: 0; }
.cd-error {
  margin-top: 12px; padding: 8px 10px;
  background: rgba(220, 38, 38, 0.08);
  border-radius: 6px; font-size: 13px; color: #dc2626;
}
.cd-foot {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 20px; border-top: 1px solid var(--border);
}
.cd-cancel {
  background: var(--bg-card); border: 1px solid var(--border); color: var(--text);
}
/* AI 生成专区 */
.cd-ai { display: flex; flex-direction: column; gap: 14px; }
.cd-ai-input-area { display: flex; flex-direction: column; gap: 14px; }
.cd-ai-desc { resize: vertical; min-height: 80px; line-height: 1.6; }
.cd-ai-gen-btn {
  align-self: flex-start;
  display: flex; align-items: center; gap: 6px;
}
.cd-spin { animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.cd-ai-result { display: flex; flex-direction: column; gap: 12px; }
.cd-ai-result-header { display: flex; align-items: center; justify-content: space-between; }
.cd-ai-badge {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--green-light); color: #16a34a;
  border-radius: 6px; padding: 3px 10px; font-size: 12px; font-weight: 600;
}
.cd-ai-regenerate {
  font-size: 12px; color: var(--text-secondary);
  background: none; border: 1px solid var(--border);
  border-radius: 5px; padding: 3px 10px; cursor: pointer;
}
.cd-ai-regenerate:hover { background: var(--bg-hover); }
.cd-ai-meta { gap: 10px; }
.cd-ai-preview { margin-top: 4px; }
.cd-ai-preview-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary); margin-bottom: 6px; }
.cd-ai-preview-content {
  background: var(--bg); border: 1px solid var(--border);
  border-radius: 6px; padding: 10px 12px;
  font-family: ui-monospace, monospace; font-size: 11.5px;
  line-height: 1.6; color: var(--text-secondary);
  white-space: pre-wrap; word-break: break-all;
  max-height: 200px; overflow-y: auto;
}
</style>
