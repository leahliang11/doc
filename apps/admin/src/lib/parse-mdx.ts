// MDX 源分段解析：把 MDX 源切成「普通 markdown 段」和「组件块」
// 组件块抽取 props（轻量解析），供 Vue 预览组件渲染
// 容错：解析失败的组件块标记为 error，降级显示原文

export type Segment =
  | { type: 'markdown'; raw: string }
  | { type: 'component'; name: string; props: Record<string, any>; children: string; raw: string; error?: string }

const COMPONENT_NAMES = ['Callout', 'Steps', 'CodeTabs', 'Params', 'InternalOnly', 'NextSteps']

/**
 * 解析 MDX 源为段数组
 * 策略：正则匹配顶层 `<Component ...>...</Component>` 或 `<Component .../>`，
 * 匹配区间外的走 markdown 段，区间内的走组件段。
 * 嵌套同名组件不处理（前台 6 组件无嵌套同名场景）。
 */
export function parseMdx(raw: string): Segment[] {
  const segments: Segment[] = []
  let i = 0
  const len = raw.length

  while (i < len) {
    // 找下一个组件起始
    const next = findNextComponent(raw, i)
    if (next === -1) {
      // 剩余全是 markdown
      const md = raw.slice(i)
      if (md.trim()) segments.push({ type: 'markdown', raw: md })
      break
    }

    // 组件前的 markdown
    if (next > i) {
      const md = raw.slice(i, next)
      if (md.trim()) segments.push({ type: 'markdown', raw: md })
    }

    // 解析组件块
    const parsed = parseComponentAt(raw, next)
    if (!parsed) {
      // 解析失败，把 `<` 当普通字符，前进 1
      const md = raw.slice(next, next + 1)
      if (md.trim()) segments.push({ type: 'markdown', raw: md })
      i = next + 1
      continue
    }

    if (parsed.error) {
      segments.push({
        type: 'component',
        name: parsed.name,
        props: {},
        children: '',
        raw: parsed.raw,
        error: parsed.error,
      })
    } else {
      segments.push({
        type: 'component',
        name: parsed.name,
        props: parsed.props,
        children: parsed.children,
        raw: parsed.raw,
      })
    }
    i = next + parsed.raw.length
  }

  return segments
}

function findNextComponent(raw: string, from: number): number {
  // 找下一个 `<Name`，Name 是 6 个组件之一
  for (let i = from; i < raw.length; i++) {
    if (raw[i] !== '<') continue
    // 尝试匹配组件名
    for (const name of COMPONENT_NAMES) {
      if (raw.slice(i + 1, i + 1 + name.length) === name) {
        // 确认后面是空白、> 或 /
        const after = raw[i + 1 + name.length]
        if (after === ' ' || after === '>' || after === '/' || after === '\t' || after === '\n') {
          return i
        }
      }
    }
  }
  return -1
}

function parseComponentAt(
  raw: string,
  start: number,
): { name: string; props: Record<string, any>; children: string; raw: string; error?: string } | null {
  // 从 start（指向 `<`）解析一个组件
  // 先匹配组件名
  let name = ''
  for (const n of COMPONENT_NAMES) {
    if (raw.slice(start + 1, start + 1 + n.length) === n) {
      name = n
      break
    }
  }
  if (!name) return null

  // 找标签结束位置（第一个 >），但要处理 props 里的引号
  let j = start + 1 + name.length
  let propsStr = ''
  let selfClosing = false
  let tagEnd = -1

  // 扫描到标签闭合 >
  while (j < raw.length) {
    const ch = raw[j]
    if (ch === '"' || ch === "'") {
      // 跳过引号内容
      const quote = ch
      j++
      while (j < raw.length && raw[j] !== quote) j++
      j++
      continue
    }
    if (ch === '/' && raw[j + 1] === '>') {
      selfClosing = true
      tagEnd = j + 1
      break
    }
    if (ch === '>') {
      tagEnd = j
      break
    }
    j++
  }
  if (tagEnd === -1) return { name, props: {}, children: '', raw: raw.slice(start), error: '标签未闭合' }

  propsStr = raw.slice(start + 1 + name.length, tagEnd - (selfClosing ? 1 : 0)).trim()
  const props = parseProps(propsStr)

  if (selfClosing) {
    return { name, props, children: '', raw: raw.slice(start, tagEnd + 1) }
  }

  // 非自闭合，找对应的 `</Name>`
  const closeTag = `</${name}>`
  const closeIdx = raw.indexOf(closeTag, tagEnd + 1)
  if (closeIdx === -1) {
    return { name, props, children: '', raw: raw.slice(start, tagEnd + 1), error: `未找到 ${closeTag} 闭合标签` }
  }

  const children = raw.slice(tagEnd + 1, closeIdx)
  const fullRaw = raw.slice(start, closeIdx + closeTag.length)
  return { name, props, children, raw: fullRaw }
}

/**
 * 轻量解析 props 字符串
 * 支持：type="warning" title="标题" collapsible tabs={[...]} items={[...]} params={[...]}
 * 字符串值、布尔值、数组对象（用 JSON.parse，props 写法本身是类 JSON）
 */
function parseProps(propsStr: string): Record<string, any> {
  const props: Record<string, any> = {}
  if (!propsStr) return props

  // 逐个匹配 key="value" / key='value' / key={value}
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(propsStr)) !== null) {
    const key = m[1]
    const val = m[2] ?? m[3] ?? m[4] ?? ''
    if (m[4] !== undefined) {
      // {expr} 形式，尝试 JSON.parse（数组/对象/布尔/数字）
      props[key] = parseJsExpr(m[4])
    } else {
      // 字符串形式
      props[key] = val
    }
  }
  return props
}

function parseJsExpr(expr: string): any {
  const trimmed = expr.trim()
  // 布尔
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  // 数字
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10)
  // 数组/对象：尝试 JSON.parse（把单引号转双引号，键名补引号）
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      // 简单处理：单引号→双引号
      const jsonish = trimmed
        .replace(/'/g, '"')
        .replace(/(\w+):/g, '"$1":')
      return JSON.parse(jsonish)
    } catch {
      return trimmed
    }
  }
  return trimmed
}
