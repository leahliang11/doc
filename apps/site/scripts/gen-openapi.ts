// OpenAPI → MDX 生成器
// 读 content-repo/openapi/openapi.yaml，遍历 paths，每个 operation 生成一篇 content/api/<slug>.mdx
// 生成器注入 Params / CodeTabs / Callout / InternalOnly 组件，source=openapi
// 幂等：覆盖 source=openapi 的同名文件；绝不碰 source=manual（手写保护）
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'

// ROOT：优先用环境变量（供后端 dynamic import 调用），否则用 __dirname 推导
const ROOT = process.env.DOCS_ROOT || path.resolve(__dirname, '../../..')
const OPENAPI_PATH = path.join(ROOT, 'content-repo/openapi/openapi.yaml')
const CONTENT_API_DIR = path.join(ROOT, 'content-repo/content/api')

interface SchemaProperty {
  type: string
  description?: string
  default?: string
  example?: string
  properties?: Record<string, SchemaProperty>
  items?: { schema?: SchemaProperty }
  enum?: string[]
}
interface Schema {
  type?: string
  required?: string[]
  properties?: Record<string, SchemaProperty>
}
interface CodeSample {
  label: string
  code: string
}
interface Operation {
  operationId?: string
  summary?: string
  description?: string
  parameters?: unknown[]
  requestBody?: {
    required?: boolean
    content?: Record<string, { schema?: Schema }>
  }
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: Schema }> }>
  'x-codeSamples'?: CodeSample[]
  'x-callout'?: { variant?: string; title?: string; body?: string }
  'x-internal'?: { body?: string }
}
type Spec = {
  paths?: Record<string, Record<string, Operation>>
}

// 代码示例嵌入 MDX 模板字符串前，必须同时转义反引号和 `${...}`。
// 否则示例里的 process.env 会在文档页面渲染时被当成真实表达式执行。
function escapeTemplateLiteral(s: string): string {
  return s.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

// 属性 → Params 数组项的 mdx 片段（name 可含点路径，如 choices[].message）
function propToParam(name: string, prop: SchemaProperty, required: boolean): string {
  const type = prop.type || 'string'
  const req = required ? 'true' : 'false'
  const def = prop.default !== undefined ? `, default: '${prop.default}'` : ''
  // enum 追加可选值（边界 4.4 修复）
  let desc = prop.description || ''
  if (prop.enum && prop.enum.length > 0) {
    const enumStr = `可选值: ${prop.enum.join(' / ')}`
    desc = desc ? `${desc}。${enumStr}` : enumStr
  }
  desc = desc.replace(/'/g, "\\'")
  return `  { name: '${name}', type: '${type}', required: ${req}${def}, description: '${desc}' }`
}

const MAX_DEPTH = 3 // 递归防爆

// 递归展开 schema.properties → Params 行数组（点路径扁平化）
// - object 有 properties：递归，object 自身不列行
// - object 无 properties（如 usage 只有一句描述）：保留为 object 一行
// - array items 是 object：递归，用 parent[].child 前缀
// - array items 是 primitive：保留为 array 一行
// - 叶子节点：输出一行
function schemaToParamRows(schema: Schema | undefined, prefix: string, depth: number): string[] {
  if (!schema || !schema.properties || depth > MAX_DEPTH) return []
  const requiredSet = new Set(schema.required || [])
  const rows: string[] = []
  for (const [name, prop] of Object.entries(schema.properties)) {
    const full = prefix ? `${prefix}.${name}` : name
    const required = requiredSet.has(name)
    if (prop.type === 'object' && prop.properties) {
      // 嵌套 object 递归
      rows.push(...schemaToParamRows(prop, full, depth + 1))
    } else if (
      prop.type === 'array' &&
      prop.items?.schema?.properties &&
      depth + 1 <= MAX_DEPTH
    ) {
      // array items 是 object：递归，前缀加 []
      rows.push(...schemaToParamRows(prop.items.schema, `${full}[]`, depth + 1))
    } else {
      // 叶子节点 / object 无 properties / array of primitive：输出一行
      rows.push(propToParam(full, prop, required))
    }
  }
  return rows
}

// schema → Params 组件 mdx
function schemaToParams(schema: Schema | undefined): string {
  const rows = schemaToParamRows(schema, '', 0)
  if (rows.length === 0) return ''
  return `<Params params={[\n${rows.join(',\n')}\n]} />`
}

// x-codeSamples → CodeTabs
function codeSamplesToTabs(samples: CodeSample[] | undefined): string {
  if (!samples || samples.length === 0) return ''
  const tabs = samples.map((s) => {
    const code = escapeTemplateLiteral(s.code.trim())
    return `  { label: '${s.label}', code: \`${code}\` }`
  })
  return `<CodeTabs tabs={[\n${tabs.join(',\n')}\n]} />`
}

// operation → mdx 全文
function operationToMdx(method: string, url: string, op: Operation): string {
  const slug = deriveSlug(url)
  const title = op.summary || op.operationId || url
  const description = op.description || ''
  const today = new Date().toISOString().slice(0, 10)

  const parts: string[] = []
  // frontmatter
  parts.push('---')
  parts.push(`title: ${escapeYaml(title)}`)
  parts.push(`description: ${escapeYaml(description)}`)
  parts.push(`slug: ${slug}`)
  parts.push('category: api')
  parts.push('audience: external')
  parts.push(`updated: ${today}`)
  parts.push('status: published')
  parts.push('owner: leah')
  parts.push('ai_readable: true')
  parts.push('source: openapi')
  parts.push('---')
  parts.push('')

  // 接口概述
  parts.push('## 接口概述')
  parts.push('')
  parts.push('```')
  parts.push(`${method.toUpperCase()} ${url}`)
  parts.push('```')
  if (description) {
    parts.push(description)
    parts.push('')
  }

  // Callout（x-callout）
  if (op['x-callout']) {
    const c = op['x-callout']
    parts.push(`<Callout variant="${c.variant || 'info'}"${c.title ? ` title="${c.title}"` : ''}>`)
    parts.push('')
    if (c.body) parts.push(c.body)
    parts.push('')
    parts.push('</Callout>')
    parts.push('')
  }

  // 请求参数
  const reqSchema = op.requestBody?.content?.['application/json']?.schema
  if (reqSchema) {
    parts.push('## 请求参数')
    parts.push('')
    parts.push(schemaToParams(reqSchema))
    parts.push('')
  }

  // 请求示例
  if (op['x-codeSamples']) {
    parts.push('## 请求示例')
    parts.push('')
    parts.push(codeSamplesToTabs(op['x-codeSamples']))
    parts.push('')
  }

  // 响应参数
  const respSchema = op.responses?.['200']?.content?.['application/json']?.schema
  if (respSchema) {
    parts.push('## 响应参数')
    parts.push('')
    parts.push(schemaToParams(respSchema))
    parts.push('')
    parts.push('响应示例见 [快速开始](/docs/quickstart)。')
    parts.push('')
  }

  // InternalOnly（x-internal）
  if (op['x-internal']) {
    parts.push('<InternalOnly>')
    parts.push('')
    if (op['x-internal'].body) parts.push(op['x-internal'].body)
    parts.push('')
    parts.push('</InternalOnly>')
    parts.push('')
  }

  return parts.join('\n')
}

// /v1/embeddings → api/embeddings；/v1/chat/completions → api/chat-completions（多级路径用连字符，和手写文件名对齐）
function deriveSlug(url: string): string {
  let s = url.replace(/^\/v\d+\//, '') // 去 /v1/
  s = s.replace(/^\/+|\/+$/g, '') // 去首尾斜杠
  s = s.replace(/\//g, '-') // 多级路径连字符
  return `api/${s}`
}

function escapeYaml(s: string): string {
  // 含冒号/特殊字符的值用双引号包
  if (/[:#\[\]{}&*!|>'"%@`]/.test(s) || s.includes('\n')) {
    return `"${s.replace(/"/g, '\\"')}"`
  }
  return s
}

// 读取已有文件 source 字段（判断是否 manual 保护）
function getExistingSource(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf-8')
  const m = content.match(/^---\n[\s\S]*?source:\s*(\w+)/m)
  return m ? m[1] : null
}

export function main(): void {
  if (!fs.existsSync(OPENAPI_PATH)) {
    throw new Error(`openapi.yaml 不存在：${OPENAPI_PATH}`)
  }
  const spec = yaml.load(fs.readFileSync(OPENAPI_PATH, 'utf-8')) as Spec
  if (!spec.paths) {
    throw new Error('openapi.yaml 无 paths')
  }

  fs.mkdirSync(CONTENT_API_DIR, { recursive: true })

  let generated = 0
  const skipped = 0
  for (const [url, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const slug = deriveSlug(url)
      const fileName = slug.replace(/^api\//, '') + '.mdx'
      const outPath = path.join(CONTENT_API_DIR, fileName)

      // manual 保护：手写文件不覆盖，旁路输出 .gen.mdx 供对比
      const existing = getExistingSource(outPath)
      const mdx = operationToMdx(method, url, op)
      if (existing === 'manual') {
        const genName = fileName.replace(/\.mdx$/, '.gen.mdx')
        const genPath = path.join(CONTENT_API_DIR, genName)
        fs.writeFileSync(genPath, mdx, 'utf-8')
        console.warn(`对比模式：${fileName} 是手写，生成版写到 ${genName}`)
        generated++
        continue
      }

      fs.writeFileSync(outPath, mdx, 'utf-8')
      console.log(`生成 ${fileName}（slug=${slug}）`)
      generated++
    }
  }

  console.log(`\n完成：生成 ${generated} 篇，跳过 ${skipped} 篇`)
}

// 仅在直接运行时执行（被 import 时不自动跑）
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
