<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  childrenHtml?: string
}>()

// Steps 的 children 是多个块（步骤），前台用 React.Children.map 按子元素分。
// 后台预览：childrenHtml 是 markdown-it 渲染后的 HTML，按 <p> 或空行分块成步骤。
const steps = computed(() => {
  if (!props.childrenHtml) return []
  // 用临时容器解析，按顶层子节点分块
  const tmp = document.createElement('div')
  tmp.innerHTML = props.childrenHtml
  const blocks: string[] = []
  // 按顶层节点切分（每个 <p>/<pre>/<ul> 等是一个步骤块）
  Array.from(tmp.children).forEach((child) => {
    blocks.push((child as HTMLElement).outerHTML)
  })
  // 如果没有子节点（纯文本），整体作为一个步骤
  if (blocks.length === 0 && props.childrenHtml.trim()) {
    blocks.push(props.childrenHtml)
  }
  return blocks
})
</script>

<template>
  <ol class="pv-steps">
    <li v-for="(step, i) in steps" :key="i" class="pv-steps-item">
      <span class="pv-steps-num">{{ i + 1 }}</span>
      <div class="pv-steps-content" v-html="step"></div>
    </li>
  </ol>
</template>
