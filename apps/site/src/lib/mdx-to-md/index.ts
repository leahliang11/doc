// mdx-to-md 主函数：原始 MDX 字符串 → 纯 Markdown
import { toMarkdown } from 'mdast-util-to-markdown'
import { parseMdx } from './parse'
import { transform } from './transform'
import type { Audience } from './types'

const serializeOptions = { bullet: '-', fences: true, emphasis: '*' } as const

export function mdxToMarkdown(raw: string, audience: Audience = 'external'): string {
  const tree = parseMdx(raw)
  transform(tree, audience)
  return toMarkdown(tree, serializeOptions)
}

export type { Audience } from './types'
export {
  calloutToMarkdown,
  stepsToMarkdown,
  codeTabsToMarkdown,
  paramsToMarkdown,
  internalOnlyToMarkdown,
  nextStepsToMarkdown,
} from './converters'
