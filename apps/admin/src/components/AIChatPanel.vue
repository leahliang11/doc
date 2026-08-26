<script setup lang="ts">
// AI 会话历史面板（W14 新增）
// 展示当前文档的历史 AI 交互，倒序排列
// 后端：GET /api/ai/sessions?docSlug=xxx
import { ref, watch, onMounted } from 'vue'

interface AiSession {
  id: number
  doc_slug: string
  action: string
  prompt: string
  response: string
  latency_ms: number | null
  ok: number
  created_at: string
}

const props = defineProps<{
  docSlug: string
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  reuse: [text: string]
}>()

const sessions = ref<AiSession[]>([])
const loading = ref(false)

const ACTION_LABELS: Record<string, string> = {
  rewrite: '改写',
  complete: '续写',
  generate: '生成',
  audit: '体检',
  'gen-params': '生成参数表',
  'gen-frontmatter': '推断元信息',
}

async function load() {
  if (!props.docSlug) return
  loading.value = true
  try {
    const res = await fetch(`/api/ai/sessions?docSlug=${encodeURIComponent(props.docSlug)}&limit=30`)
    const data = await res.json()
    sessions.value = data.sessions ?? []
  } catch {
    sessions.value = []
  } finally {
    loading.value = false
  }
}

watch(() => [props.visible, props.docSlug], ([visible]) => {
  if (visible) load()
})

onMounted(() => {
  if (props.visible) load()
})

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const h = d.getHours().toString().padStart(2, '0')
    const m = d.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  } catch {
    return iso
  }
}

function truncate(s: string, n = 60): string {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}
</script>

<template>
  <div class="acp-panel" :class="{ 'acp-panel--hidden': !visible }">
    <div class="acp-header">
      <span class="acp-title">AI 写作历史</span>
      <button class="acp-close" @click="emit('close')">×</button>
    </div>

    <div class="acp-body">
      <div v-if="loading" class="acp-loading">加载中…</div>
      <div v-else-if="sessions.length === 0" class="acp-empty">
        暂无历史记录。使用 AI 能力后，记录将出现在这里。
      </div>

      <div v-else class="acp-list">
        <div
          v-for="s in sessions"
          :key="s.id"
          class="acp-item"
          :class="{ 'acp-item--fail': !s.ok }"
        >
          <div class="acp-item-header">
            <span class="acp-action">{{ ACTION_LABELS[s.action] ?? s.action }}</span>
            <span class="acp-time">{{ formatTime(s.created_at) }}</span>
            <span v-if="s.latency_ms" class="acp-latency">{{ s.latency_ms }}ms</span>
            <span v-if="!s.ok" class="acp-fail-badge">失败</span>
          </div>
          <div v-if="s.prompt" class="acp-prompt">{{ truncate(s.prompt) }}</div>
          <div v-if="s.response" class="acp-response">{{ truncate(s.response, 120) }}</div>
          <button
            v-if="s.response && s.ok"
            class="acp-reuse-btn"
            @click="emit('reuse', s.response)"
            title="复用此结果，插入到光标处"
          >
            复用
          </button>
        </div>
      </div>
    </div>

    <div class="acp-footer">
      <button class="acp-refresh-btn" :disabled="loading" @click="load">
        {{ loading ? '加载中…' : '刷新' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.acp-panel {
  display: flex;
  flex-direction: column;
  width: 320px;
  border-left: 1px solid var(--border);
  background: var(--bg-card);
  height: 100%;
  transition: width 0.2s ease;
  overflow: hidden;
}
.acp-panel--hidden {
  width: 0;
  border: none;
  overflow: hidden;
}
.acp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.acp-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.acp-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  color: var(--text-secondary);
  padding: 0 4px;
  line-height: 1;
}
.acp-close:hover { color: var(--text-primary); }
.acp-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.acp-loading, .acp-empty {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 16px 8px;
  text-align: center;
}
.acp-list { display: flex; flex-direction: column; gap: 6px; }
.acp-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--bg-page);
  position: relative;
}
.acp-item--fail { border-color: var(--error-border, #fca5a5); background: #fff5f5; }
.acp-item-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.acp-action {
  font-size: 11px;
  font-weight: 600;
  background: var(--brand-soft);
  color: var(--brand);
  border-radius: 4px;
  padding: 1px 6px;
}
.acp-time { font-size: 11px; color: var(--text-tertiary); margin-left: auto; }
.acp-latency { font-size: 10px; color: var(--text-tertiary); }
.acp-fail-badge {
  font-size: 10px;
  color: #dc2626;
  background: #fee2e2;
  border-radius: 4px;
  padding: 1px 5px;
}
.acp-prompt {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 3px;
  white-space: pre-wrap;
  word-break: break-all;
}
.acp-response {
  font-size: 12px;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 80px;
  overflow: hidden;
}
.acp-reuse-btn {
  margin-top: 6px;
  font-size: 11px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  color: var(--brand);
  transition: background 0.1s;
}
.acp-reuse-btn:hover { background: var(--brand-soft); }
.acp-footer {
  border-top: 1px solid var(--border);
  padding: 6px 8px;
  flex-shrink: 0;
}
.acp-refresh-btn {
  font-size: 11px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
  color: var(--text-secondary);
  width: 100%;
}
.acp-refresh-btn:hover:not(:disabled) { background: var(--bg-muted); }
.acp-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
