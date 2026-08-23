<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  show: boolean
  component: 'CodeTabs' | 'Params' | null
}>()
const emit = defineEmits<{
  close: []
  insert: [mdx: string]
}>()

// CodeTabs 填参
const tabs = ref<{ label: string; code: string }[]>([
  { label: 'cURL', code: 'curl https://api.example.com/v1/chat/completions \\\n  -H "Authorization: Bearer $API_KEY"' },
])

// Params 填参
const params = ref<{
  name: string
  type: string
  required: boolean
  default: string
  description: string
}[]>([
  { name: 'model', type: 'string', required: true, default: '', description: '模型名称' },
])

function addTab() {
  tabs.value.push({ label: '语言', code: '' })
}
function removeTab(i: number) {
  tabs.value.splice(i, 1)
}

function addParam() {
  params.value.push({ name: '', type: 'string', required: false, default: '', description: '' })
}
function removeParam(i: number) {
  params.value.splice(i, 1)
}

// 生成 MDX
const generatedMdx = computed(() => {
  if (props.component === 'CodeTabs') {
    const tabsStr = tabs.value
      .filter((t) => t.label && t.code)
      .map((t) => `  { label: '${t.label}', code: \`${t.code}\` }`)
      .join(',\n')
    return `<CodeTabs tabs={[\n${tabsStr}\n]} />`
  }
  if (props.component === 'Params') {
    const paramsStr = params.value
      .filter((p) => p.name)
      .map(
        (p) =>
          `  { name: '${p.name}', type: '${p.type}', required: ${p.required}, default: '${p.default}', description: '${p.description}' }`,
      )
      .join(',\n')
    return `<Params params={[\n${paramsStr}\n]} />`
  }
  return ''
})

function confirm() {
  if (generatedMdx.value) {
    emit('insert', generatedMdx.value)
    emit('close')
  }
}
</script>

<template>
  <div v-if="show" class="cid-mask" @click.self="emit('close')">
    <div class="cid-dialog">
      <div class="cid-head">
        <span>插入{{ component === 'CodeTabs' ? '代码页签 CodeTabs' : '参数表 Params' }}</span>
        <button class="cid-close" @click="emit('close')">×</button>
      </div>

      <!-- CodeTabs 填参 -->
      <div v-if="component === 'CodeTabs'" class="cid-body">
        <div v-for="(tab, i) in tabs" :key="i" class="cid-row cid-tab-row">
          <input v-model="tab.label" class="cid-input cid-label-input" placeholder="标签（如 cURL/Python）" />
          <textarea v-model="tab.code" class="cid-input cid-code-input" placeholder="代码内容"></textarea>
          <button class="cid-remove" @click="removeTab(i)" title="删除">×</button>
        </div>
        <button class="cid-add" @click="addTab">+ 添加页签</button>
      </div>

      <!-- Params 填参 -->
      <div v-if="component === 'Params'" class="cid-body">
        <div class="cid-params-head">
          <span class="cid-ph-name">参数名</span>
          <span class="cid-ph-type">类型</span>
          <span class="cid-ph-req">必填</span>
          <span class="cid-ph-default">默认值</span>
          <span class="cid-ph-desc">说明</span>
          <span></span>
        </div>
        <div v-for="(p, i) in params" :key="i" class="cid-row cid-param-row">
          <input v-model="p.name" class="cid-input" placeholder="model" />
          <input v-model="p.type" class="cid-input" placeholder="string" />
          <label class="cid-checkbox"><input type="checkbox" v-model="p.required" /></label>
          <input v-model="p.default" class="cid-input" placeholder="-" />
          <input v-model="p.description" class="cid-input" placeholder="说明" />
          <button class="cid-remove" @click="removeParam(i)" title="删除">×</button>
        </div>
        <button class="cid-add" @click="addParam">+ 添加参数</button>
      </div>

      <!-- 预览生成的 MDX -->
      <div class="cid-preview">
        <div class="cid-preview-label">生成 MDX：</div>
        <pre class="cid-preview-code">{{ generatedMdx }}</pre>
      </div>

      <div class="cid-foot">
        <button class="btn cid-cancel" @click="emit('close')">取消</button>
        <button class="btn btn-primary" :disabled="!generatedMdx" @click="confirm">插入</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cid-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cid-dialog {
  background: var(--bg-card);
  border-radius: 8px;
  width: 680px;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cid-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
}
.cid-close {
  background: transparent;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: var(--text-tertiary);
  line-height: 1;
}
.cid-body {
  padding: 16px 20px;
  overflow: auto;
  flex: 1;
}
.cid-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
}
.cid-tab-row {
  flex-direction: column;
  align-items: stretch;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.cid-label-input { width: 100%; }
.cid-code-input { width: 100%; min-height: 70px; font-family: ui-monospace, monospace; font-size: 13px; }
.cid-tab-row .cid-remove {
  align-self: flex-end;
}
.cid-input {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
  background: var(--bg-card);
  color: var(--text);
  font-family: inherit;
}
.cid-param-row .cid-input { flex: 1; min-width: 0; }
.cid-param-row .cid-input:first-child { flex: 0.8; font-family: ui-monospace, monospace; }
.cid-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
.cid-checkbox input { margin: 0; }
.cid-remove {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--danger, #e00);
  padding: 0 4px;
  line-height: 1;
}
.cid-add {
  background: transparent;
  border: 1px dashed var(--border);
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
}
.cid-add:hover { border-color: var(--primary); color: var(--primary); }
.cid-params-head {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: var(--text-tertiary);
  padding: 0 0 4px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.cid-params-head span { flex: 1; }
.cid-params-head .cid-ph-name { flex: 0.8; }
.cid-params-head .cid-ph-req { flex: 0 0 40px; text-align: center; }
.cid-preview {
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg-hover);
}
.cid-preview-label {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}
.cid-preview-code {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
.cid-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}
.cid-cancel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text);
}
</style>