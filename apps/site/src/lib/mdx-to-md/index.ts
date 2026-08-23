// mdx-to-md 主函数：原始 MDX 字符串 → 纯 Markdown
import { toMarkdown } from 'mdast-util-to-markdown'
import { parseMdx } from './parse.ts'
import { transform } from './transform.ts'
import type { Audience } from './types.ts'

const serializeOptions = { bullet: '-', fences: true, emphasis: '*' }

export function mdxToMarkdown(raw: string, audience: Audience = 'external'): string {
  const tree = parseMdx(raw)
  transform(tree, audience)
  return toMarkdown(tree, serializeOptions)
}

export type { Audience } from './types.ts'
export {
  calloutToMarkdown,
  stepsToMarkdown,
  codeTabsToMarkdown,
  paramsToMarkdown,
  internalOnlyToMarkdown,
  nextStepsToMarkdown,
} from './converters.ts'
