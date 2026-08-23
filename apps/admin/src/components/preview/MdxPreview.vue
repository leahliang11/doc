<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import { parseMdx, type Segment } from '../../lib/parse-mdx'
import PreviewCallout from './PreviewCallout.vue'
import PreviewSteps from './PreviewSteps.vue'
import PreviewCodeTabs from './PreviewCodeTabs.vue'
import PreviewParams from './PreviewParams.vue'
import PreviewInternalOnly from './PreviewInternalOnly.vue'
import PreviewNextSteps from './PreviewNextSteps.vue'

const props = defineProps<{
  source: string
}>()

const md = new MarkdownIt({
  html: true,
  breaks: false,
  linkify: true,
  typographer: false,
})

// 渲染普通 markdown 段为 HTML
function renderMarkdown(raw: string): string {
  if (!raw.trim()) return ''
  return md.render(raw)
}

// 渲染组件 children（内部 markdown）为 HTML
function renderChildren(children: string): string {
  return md.render(children || '')
}

const segments = computed<Segment[]>(() => {
  if (!props.source) return []
  try {
    return parseMdx(props.source)
  } catch (e: any) {
    return [{ type: 'markdown', raw: props.source }]
  }
})

// 暴露给父组件用于 AI 文档体检（拿段位置）
defineExpose({
  getSegments: () => segments.value,
})
</script>

<template>
  <div class="mdx-preview">
    <div class="prose-doc">
      <template v-for="(seg, i) in segments" :key="i">
        <!-- 普通 markdown 段 -->
        <div v-if="seg.type === 'markdown'" v-html="renderMarkdown(seg.raw)"></div>

        <!-- 组件段：解析失败降级 -->
        <div v-else-if="seg.error" class="pv-parse-error">
          <div>⚠️ 组件「{{ seg.name }}」语法可能有误：{{ seg.error }}</div>
          <pre class="pv-parse-error-code">{{ seg.raw }}</pre>
        </div>

        <!-- 组件段：路由到对应预览组件 -->
        <PreviewCallout
          v-else-if="seg.name === 'Callout'"
          :variant="seg.props.variant || seg.props.type"
          :title="seg.props.title"
          :children-html="renderChildren(seg.children)"
        />
        <PreviewSteps
          v-else-if="seg.name === 'Steps'"
          :children-html="renderChildren(seg.children)"
        />
        <PreviewCodeTabs
          v-else-if="seg.name === 'CodeTabs'"
          :tabs="seg.props.tabs"
        />
        <PreviewParams
          v-else-if="seg.name === 'Params'"
          :params="seg.props.params"
        />
        <PreviewInternalOnly
          v-else-if="seg.name === 'InternalOnly'"
          :collapsible="seg.props.collapsible"
          :title="seg.props.title"
          :children-html="renderChildren(seg.children)"
        />
        <PreviewNextSteps
          v-else-if="seg.name === 'NextSteps'"
          :items="seg.props.items"
        />
      </template>
    </div>
  </div>
</template>
