// 遍历 mdast AST，把 5 个白名单组件节点替换为纯 Markdown（以 html 节点注入）
import { visit } from 'unist-util-visit'
import { toMarkdown } from 'mdast-util-to-markdown'
import type { Root, Node, Parent } from 'mdast'
import type { Audience } from './types.ts'
import { evaluateExpression } from './props-evaluator.ts'
import {
  calloutToMarkdown,
  stepsToMarkdown,
  codeTabsToMarkdown,
  paramsToMarkdown,
  internalOnlyToMarkdown,
  nextStepsToMarkdown,
} from './converters.ts'

// 白名单组件名
const WHITELIST = new Set([
  'Callout',
  'Steps',
  'CodeTabs',
  'Params',
  'InternalOnly',
  'NextSteps',
])

// mdast-util-to-markdown 的序列化选项
const mdSerializeOptions = {
  bullet: '-',           // 无序列表用 - 而非默认 *
  fences: true,
  emphasis: '*',
}

// 把一个节点的子树序列化成 Markdown 字符串（用于 children 内容）
function serializeChildren(children: Node[]): string {
  const fragment = { type: 'root', children } as unknown as Root
  return toMarkdown(fragment, mdSerializeOptions)
}

// 清理 children Markdown 里无语义的 <div> 标签（div 在 Markdown 里无语义）
function stripDivTags(md: string): string {
  // 移除 <div> 和 </div>（含可能的属性 <div class="...">）
  return md.replace(/<\/?div[^>]*>/g, '')
}

// 提取 JSX 节点的 props
function extractProps(node: MdxJsxElement): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const attr of node.attributes ?? []) {
    if (attr.type === 'mdxJsxAttribute') {
      const name = attr.name
      const value = attr.value
      if (value === null || value === undefined) {
        props[name] = true
        continue
      }
      if (typeof value === 'string') {
        props[name] = value
      } else if (typeof value === 'object' && value !== null && 'type' in value) {
        // mdxJsxAttributeValueExpression：value.value 是 JS 源码字符串（如 "[{label:'cURL',...}]"）
        const expr = value as { value?: unknown }
        const code = expr.value
        if (typeof code === 'string') {
          try {
            props[name] = evaluateExpression(code)
          } catch (e) {
            props[name] = undefined
          }
        }
      }
    }
  }
  return props
}

// mdast JSX 元素节点的最小类型（mdast-util-mdx-jsx 的类型在运行时用不到，这里只取用到的字段）
interface MdxJsxAttribute {
  type: 'mdxJsxAttribute'
  name: string
  value:
    | string
    | null
    | { type: string; value?: unknown }
    | undefined
}
interface MdxJsxElement extends Node {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement'
  name: string
  attributes?: MdxJsxAttribute[]
  children: Node[]
}

// 构造一个 html 节点（注入转换后的 Markdown 字符串）
function htmlNode(value: string): Node {
  return { type: 'html', value } as unknown as Node
}

export function transform(tree: Root, audience: Audience): Root {
  // 先递归处理深层组件：从最深的叶子 JSX 开始替换，避免父级序列化 children 时遇到未转换的 JSX 节点
  // visit 默认是深度优先（先访问父再访问子），这里用反向遍历：先转换内层再转换外层
  visit(tree, (node, index, parent) => {
    if (!parent || typeof index !== 'number') return
    const jsx = node as unknown as MdxJsxElement
    if (jsx.type !== 'mdxJsxFlowElement' && jsx.type !== 'mdxJsxTextElement') return
    if (!jsx.name) return

    // 先把 children 当作子树递归 transform（转换内层组件），再序列化
    const childRoot = { type: 'root', children: jsx.children ?? [] } as unknown as Root
    transform(childRoot, audience)
    const childrenMd = stripDivTags(serializeChildren(childRoot.children))

    // 非白名单 JSX 节点（如 <div>）：解包，用 children 文本替换（去掉标签外壳）
    if (!WHITELIST.has(jsx.name)) {
      const parentAsParent = parent as Parent
      parentAsParent.children[index] = htmlNode(childrenMd)
      return
    }

    const componentName = jsx.name

    let md = ''
    try {
      const props = extractProps(jsx)
      switch (componentName) {
        case 'Callout':
          md = calloutToMarkdown(
            props as never,
            childrenMd,
          )
          break
        case 'Steps':
          md = stepsToMarkdown(props as never, childrenMd)
          break
        case 'CodeTabs':
          md = codeTabsToMarkdown(props as never)
          break
        case 'Params':
          md = paramsToMarkdown(props as never)
          break
        case 'InternalOnly':
          md = internalOnlyToMarkdown(props as never, childrenMd, audience)
          break
        case 'NextSteps':
          md = nextStepsToMarkdown(props as never)
          break
      }
    } catch (e) {
      md = `<!-- mdx-to-md: failed to parse <${componentName}> props -->`
    }

    // 用 html 节点替换原 JSX 节点
    const parentAsParent = parent as Parent
    parentAsParent.children[index] = htmlNode(md)
  })
  return tree
}
