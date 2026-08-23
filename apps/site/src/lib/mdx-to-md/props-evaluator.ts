// 受限 ESTree 求值器
// 只处理 ArrayExpression / ObjectExpression / Literal 三种节点，
// 用于求值 CodeTabs 的 tabs={[...]} 和 Params 的 params={[...]} 这类 JS 对象数组字面量。
// 不引入 eval / Function 构造器，安全无副作用。遇到不支持的节点类型抛明确错误。

import { parse as acornParse } from 'acorn'

// ESTree 节点的最小类型定义（只用到的部分）
interface EstreeLiteral {
  type: 'Literal'
  value: string | number | boolean | null
}
interface EstreeProperty {
  type: 'Property'
  key: { type: 'Identifier' | 'Literal'; name?: string; value?: string | number }
  value: EstreeNode
}
interface EstreeObjectExpression {
  type: 'ObjectExpression'
  properties: EstreeProperty[]
}
interface EstreeArrayExpression {
  type: 'ArrayExpression'
  elements: (EstreeNode | null)[]
}
type EstreeNode =
  | EstreeLiteral
  | EstreeObjectExpression
  | EstreeArrayExpression
  | { type: string; [key: string]: unknown }

export function evaluateEstree(node: EstreeNode): unknown {
  switch (node.type) {
    case 'Literal':
      return (node as EstreeLiteral).value
    case 'ObjectExpression': {
      const obj: Record<string, unknown> = {}
      for (const prop of (node as EstreeObjectExpression).properties) {
        const key =
          prop.key.type === 'Identifier'
            ? prop.key.name!
            : String(prop.key.value)
        obj[key] = evaluateEstree(prop.value)
      }
      return obj
    }
    case 'ArrayExpression':
      return (node as EstreeArrayExpression).elements.map((el) =>
        el === null ? null : evaluateEstree(el),
      )
    default:
      throw new Error(
        `mdx-to-md: unsupported ESTree node type "${node.type}"（只支持 Literal/ObjectExpression/ArrayExpression）`,
      )
  }
}

// 从 JS 源码字符串求值（用于 JSX expression 属性，如 items={[{...}]}）
// remark-mdx 在此版本下把 expression 属性的 value 存为源码字符串，需自行用 acorn 解析成 ESTree。
export function evaluateExpression(code: string): unknown {
  // 包一层括号保证解析成表达式
  const ast = acornParse(`(${code})`, {
    ecmaVersion: 2022,
    sourceType: 'module',
  }) as unknown as { body: Array<{ expression: EstreeNode }> }
  const expr = ast.body[0].expression
  return evaluateEstree(expr)
}

