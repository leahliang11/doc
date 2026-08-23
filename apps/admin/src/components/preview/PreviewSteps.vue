<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'

const props = defineProps<{
  childrenHtml?: string
}>()

const mdInline = new MarkdownIt({ html: true, breaks: false })

// Steps 的 children 是多个块（步骤）。支持两种写法：
// 1. <div>步骤</div> <div>步骤</div>（手写包裹）→ 每个顶层 div 一个步骤
//    注意：markdown-it 对含 <div> 的输入不解析 div 内的 markdown（**粗体** 不渲染），
//    所以对 div 的 innerHTML 再走一次 markdown-it
// 2. markdown 有序/无序列表 1. 2. 3. → markdown-it 渲染成 <ol>/<ul><li>，每个 <li> 一个步骤
const steps = computed(() => {
  if (!props.childrenHtml) return []
  const tmp = document.createElement('div')
  tmp.innerHTML = props.childrenHtml
  const blocks: string[] = []

  // 如果整体是一个 <ol>/<ul>，按 <li> 拆分（markdown 列表写法）
  const list = tmp.querySelector(':scope > ol, :scope > ul')
  if (list) {
    Array.from(list.children).forEach((li) => {
      blocks.push((li as HTMLElement).innerHTML)
    })
    return blocks
  }

  // 否则按顶层节点分块（<div>/<p>/<pre> 等）
  Array.from(tmp.children).forEach((child) => {
    const el = child as HTMLElement
    // <div> 包裹的步骤：innerHTML 再走 markdown-it（让 **粗体**/`代码` 等渲染）
    // 去掉行首缩进（markdown-it 把 ≥4 空格缩进当代码块）+ trim
    if (el.tagName === 'DIV') {
      const dedented = el.innerHTML
        .split('\n')
        .map((l) => l.replace(/^\s{0,4}/, ''))
        .join('\n')
        .trim()
      blocks.push(mdInline.render(dedented))
    } else {
      blocks.push(el.outerHTML)
    }
  })
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
