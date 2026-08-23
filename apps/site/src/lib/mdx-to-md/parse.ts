// unified 管线：原始 MDX 字符串 → mdast AST
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import type { Root } from 'mdast'

export function parseMdx(raw: string): Root {
  const processor = unified().use(remarkParse).use(remarkMdx)
  return processor.parse(raw) as Root
}
