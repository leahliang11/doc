// 5 个组件的 Markdown 转换纯函数
// 输入：组件 props + children 已序列化的 Markdown 字符串
// 输出：该组件对应的纯 Markdown 字符串

import type {
  CalloutProps,
  CodeTabsProps,
  ParamsProps,
  NextStepsProps,
  Audience,
} from './types'

// Callout variant → GFM alert type
const calloutVariantMap: Record<NonNullable<CalloutProps['variant']>, string> = {
  info: 'NOTE',
  warning: 'WARNING',
  danger: 'CAUTION',
  success: 'TIP',
}

// 把多行文本转成 GFM alert 的引用块（每行加 "> " 前缀）
function toBlockquote(text: string, alertType: string, title?: string): string {
  const header = title ? `> [!${alertType}] ${title}` : `> [!${alertType}]`
  const bodyLines = text.split('\n')
  const body = bodyLines.map((line) => (line.trim() === '' ? '>' : `> ${line}`)).join('\n')
  return `${header}\n${body}`
}

export function calloutToMarkdown(
  props: CalloutProps,
  childrenMd: string,
): string {
  const variant = props.variant ?? 'info'
  const alertType = calloutVariantMap[variant] ?? 'NOTE'
  return toBlockquote(childrenMd, alertType, props.title)
}

// Steps：children 是 <div> 包裹的多块，每块转成一个有序列表项
// childrenMd 里 <div> 已被清理掉，块之间用空行分隔
export function stepsToMarkdown(_props: Record<string, never>, childrenMd: string): string {
  const trimmed = childrenMd.trim()
  if (trimmed === '') return ''
  // 按空行分隔的块拆成步骤
  const blocks = trimmed
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b !== '')
  if (blocks.length === 0) return ''
  return blocks
    .map((block, i) => {
      // 多行块：首行用 "1. "，后续行缩进 3 空格对齐
      const lines = block.split('\n')
      const first = `${i + 1}. ${lines[0]}`
      const rest = lines.slice(1).map((l) => `   ${l}`).join('\n')
      return rest ? `${first}\n${rest}` : first
    })
    .join('\n\n')
}

// CodeTabs：全部语言展开成多个代码块
export function codeTabsToMarkdown(props: CodeTabsProps): string {
  const tabs = props.tabs ?? []
  if (tabs.length === 0) return ''
  return tabs
    .map((tab) => {
      const lang = inferLang(tab.label)
      return `#### ${tab.label}\n\n\`\`\`${lang}\n${tab.code}\n\`\`\``
    })
    .join('\n\n')
}

// 根据语言标签推断 fenced code 的语言标识
function inferLang(label: string): string {
  const l = label.toLowerCase().trim()
  if (l === 'curl') return 'bash'
  if (l === 'node' || l === 'node.js') return 'javascript'
  if (l === 'go') return 'go'
  if (l === 'java') return 'java'
  if (l === 'python') return 'python'
  return ''
}

// Params：标准 Markdown 表格
export function paramsToMarkdown(props: ParamsProps): string {
  const params = props.params ?? []
  const header = '| 参数名 | 类型 | 必填 | 默认值 | 说明 |'
  const separator = '|---|---|---|---|---|'
  const rows = params.map((p) => {
    const required = p.required ? '是' : '否'
    const def = p.default ?? '-'
    // 说明里若含换行，压成空格，避免破坏表格
    const desc = (p.description ?? '').replace(/\n/g, ' ')
    return `| ${p.name} | ${p.type} | ${required} | ${def} | ${desc} |`
  })
  if (rows.length === 0) return `${header}\n${separator}`
  return `${header}\n${separator}\n${rows.join('\n')}`
}

// InternalOnly：external 整块过滤，internal 返回原文
export function internalOnlyToMarkdown(
  _props: Record<string, never>,
  childrenMd: string,
  audience: Audience,
): string {
  if (audience === 'external') return ''
  return childrenMd
}

// NextSteps：转链接列表（Agent 友好，和 llms.txt 一致）
// - [标题](href): 描述
export function nextStepsToMarkdown(props: NextStepsProps): string {
  const items = props.items ?? []
  if (items.length === 0) return ''
  return items
    .map((item) => `- [${item.title}](${item.href}): ${item.description}`)
    .join('\n')
}
