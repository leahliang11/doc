<script setup lang="ts">
// Playground 在后台编辑器里的预览：
// 显示一个占位卡，标注 endpoint 和功能说明
// （前台的 Playground 是交互式的 client 组件，后台预览不做真实调用）
defineProps<{
  endpoint?: string
}>()

const ENDPOINT_LABELS: Record<string, string> = {
  'chat-completions': 'POST /v1/chat/completions',
  'embeddings': 'POST /v1/embeddings',
  'moderations': 'POST /v1/moderations',
}
</script>

<template>
  <div class="pv-playground">
    <div class="pv-playground-header">
      <span class="pv-playground-badge">POST</span>
      <code class="pv-playground-path">
        {{ (endpoint && ENDPOINT_LABELS[endpoint]) || endpoint || 'API Endpoint' }}
      </code>
      <span class="pv-playground-tag">在线试用</span>
    </div>
    <div class="pv-playground-body">
      <div class="pv-playground-col">
        <div class="pv-playground-label">请求体</div>
        <div class="pv-playground-mock-editor">{ "model": "...", ... }</div>
      </div>
      <div class="pv-playground-col">
        <div class="pv-playground-label">响应</div>
        <div class="pv-playground-mock-response">点击「运行」发送请求</div>
      </div>
    </div>
    <p class="pv-playground-note">此区域在前台渲染为交互式 Playground，可真实调用 API。</p>
  </div>
</template>

<style scoped>
.pv-playground {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  margin: 16px 0;
  background: #fff;
}
.pv-playground-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}
.pv-playground-badge {
  background: #7257e8;
  color: #fff;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  font-family: monospace;
}
.pv-playground-path {
  font-size: 13px;
  color: #1e293b;
  flex: 1;
}
.pv-playground-tag {
  font-size: 11px;
  color: #7257e8;
  background: #f1effc;
  border-radius: 4px;
  padding: 2px 8px;
}
.pv-playground-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
}
.pv-playground-col {
  padding: 12px 16px;
}
.pv-playground-col:first-child {
  border-right: 1px solid #e2e8f0;
}
.pv-playground-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  margin-bottom: 6px;
}
.pv-playground-mock-editor {
  font-family: monospace;
  font-size: 12px;
  color: #64748b;
  background: #f8fafc;
  border-radius: 6px;
  padding: 8px 10px;
  min-height: 48px;
}
.pv-playground-mock-response {
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
  padding: 8px 0;
}
.pv-playground-note {
  font-size: 11px;
  color: #94a3b8;
  padding: 6px 16px;
  margin: 0;
  border-top: 1px solid #e2e8f0;
  background: #fafafa;
}
</style>
