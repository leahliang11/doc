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
    if (ch === '"' || ch === "'" || ch === '`') {
      // 跳过引号/模板字符串内容（含转义）
      const quote = ch
      j++
      while (j < raw.length) {
        if (raw[j] === '\\' && j + 1 < raw.length) { j += 2; continue }
        if (raw[j] === quote) break
        j++
      }
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
 * 重要：{expr} 里的数组/对象可能跨多行且嵌套大括号，用括号配平扫描，不用 [^}]* 正则
 */
function parseProps(propsStr: string): Record<string, any> {
  const props: Record<string, any> = {}
  if (!propsStr) return props

  let i = 0
  while (i < propsStr.length) {
    // 跳过空白
    while (i < propsStr.length && /\s/.test(propsStr[i])) i++
    if (i >= propsStr.length) break

    // 读 key（字母数字下划线）
    let key = ''
    while (i < propsStr.length && /[\w-]/.test(propsStr[i])) {
      key += propsStr[i]
      i++
    }
    if (!key) {
      i++ // 跳过无法识别的字符
      continue
    }

    // 跳过空白
    while (i < propsStr.length && /\s/.test(propsStr[i])) i++
    // 期望 =
    if (propsStr[i] !== '=') continue
    i++ // 跳过 =
    while (i < propsStr.length && /\s/.test(propsStr[i])) i++

    if (propsStr[i] === '"' || propsStr[i] === "'") {
      // 字符串值 "..." 或 '...'
      const quote = propsStr[i]
      i++ // 跳过开引号
      let val = ''
      while (i < propsStr.length && propsStr[i] !== quote) {
        // 处理转义（简化：只处理 \\ 和 \{quote\}）
        if (propsStr[i] === '\\' && i + 1 < propsStr.length) {
          val += propsStr[i + 1]
          i += 2
          continue
        }
        val += propsStr[i]
        i++
      }
      i++ // 跳过闭引号
      props[key] = val
    } else if (propsStr[i] === '{') {
      // {expr} 形式：括号配平找完整表达式（支持嵌套 {} 和字符串内的 }）
      let depth = 0
      let inStr: string | null = null
      let start = i + 1
      i++ // 跳过 {
      while (i < propsStr.length) {
        const ch = propsStr[i]
        if (inStr) {
          if (ch === '\\') {
            i += 2
            continue
          }
          if (ch === inStr) inStr = null
          i++
          continue
        }
        if (ch === '"' || ch === "'" || ch === '`') {
          inStr = ch
          i++
          continue
        }
        if (ch === '{') depth++
        else if (ch === '}') {
          if (depth === 0) {
            i++ // 跳过 }
            break
          }
          depth--
        }
        i++
      }
      const expr = propsStr.slice(start, i - 1)
      props[key] = parseJsExpr(expr)
    } else if (propsStr.slice(i, i + 4) === 'true') {
      props[key] = true
      i += 4
    } else if (propsStr.slice(i, i + 5) === 'false') {
      props[key] = false
      i += 5
    } else {
      // 无法识别的值，跳过这个 key
      break
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
  // 数组/对象：用 Function 求值 JS 字面量
  // 但要先处理反引号模板字符串：`${x}` 在 Function 里会执行插值（浏览器无 process 等），
  // MDX 里 code 字段的反引号字符串是字面量（不插值），要转成普通字符串字面量
  if (trimmed.startsWith('[') || trimmed.startsWith('{') || trimmed.startsWith('`')) {
    try {
      const safe = escapeTemplateStrings(trimmed)
      // eslint-disable-next-line no-new-func
      return new Function('return (' + safe + ')')()
    } catch {
      return trimmed
    }
  }
  return trimmed
}

/**
 * 把 expr 里的字符串字面量（反引号/单引号/双引号）统一转成 JSON 双引号字符串
 * 反引号模板字符串的 `${x}` 不插值，作为字面量保留
 * 这样 new Function 求值时不会执行插值（避免 process 未定义等错误）
 */
function escapeTemplateStrings(expr: string): string {
  let out = ''
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === '`' || ch === '"' || ch === "'") {
      const q = ch
      i++
      let str = ''
      while (i < expr.length && expr[i] !== q) {
        if (expr[i] === '\\' && i + 1 < expr.length) {
          // 转义序列：按 JS 字符串规则解析（\n→换行 \t→tab \"→" 等）
          const next = expr[i + 1]
          if (next === 'n') str += '\n'
          else if (next === 't') str += '\t'
          else if (next === 'r') str += '\r'
          else str += next // \x → x（字面）
          i += 2
          continue
        }
        str += expr[i]
        i++
      }
      i++ // 跳过闭引号
      out += JSON.stringify(str)
    } else {
      out += ch
      i++
    }
  }
  return out
}
