// 简单 frontmatter 解析（提取 --- 之间的 YAML，转成对象）
// 不引 yaml 库，只处理本项目用到的 string/list/bool 字段

export interface ParsedDoc {
  frontmatter: Record<string, unknown>
  body: string // 含组件标签的 MDX 正文（不含 frontmatter）
}

export function parseFrontmatter(raw: string): ParsedDoc {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: raw }
  }
  const fmText = match[1]
  const body = match[2]
  const frontmatter: Record<string, unknown> = {}
  for (const line of fmText.split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    let value: unknown = m[2]
    // list: [a, b, c]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((s) => s.trim())
    } else if (value === 'true') {
      value = true
    } else if (value === 'false') {
      value = false
    }
    frontmatter[key] = value
  }
  return { frontmatter, body }
}
