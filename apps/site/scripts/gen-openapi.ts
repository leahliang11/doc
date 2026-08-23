// OpenAPI → MDX 生成器
// 读 content-repo/openapi/openapi.yaml，遍历 paths，每个 operation 生成一篇 content/api/<slug>.mdx
// 生成器注入 Params / CodeTabs / Callout / InternalOnly 组件，source=openapi
// 幂等：覆盖 source=openapi 的同名文件；绝不碰 source=manual（手写保护）
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'

const ROOT = path.resolve(__dirname, '../../..')
const OPENAPI_PATH = path.join(ROOT, 'content-repo/openapi/openapi.yaml')
const CONTENT_API_DIR = path.join(ROOT, 'content-repo/content/api')

interface SchemaProperty {
  type: string
  description?: string
  default?: string
  example?: string
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
  parameters?: any[]
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

// 转义 mdx 里反引号代码块内的反引号
function escapeBackticks(s: string): string {
  return s.replace(/`/g, '\\`')
}

// 属性 → Params 数组项的 mdx 片段
function propToParam(name: string, prop: SchemaProperty, required: boolean): string {
  const type = prop.type || 'string'
  const req = required ? 'true' : 'false'
  const def = prop.default !== undefined ? `, default: '${prop.default}'` : ''
  const desc = (prop.description || '').replace(/'/g, "\\'")
  return `  { name: '${name}', type: '${type}', required: ${req}${def}, description: '${desc}' }`
}

// schema.properties → Params 组件 mdx
function schemaToParams(schema: Schema | undefined): string {
  if (!schema || !schema.properties) return ''
  const requiredSet = new Set(schema.required || [])
  const items = Object.entries(schema.properties).map(([name, prop]) =>
    propToParam(name, prop, requiredSet.has(name)),
  )
  if (items.length === 0) return ''
  return `<Params params={[\n${items.join(',\n')}\n]} />`
}

// x-codeSamples → CodeTabs
function codeSamplesToTabs(samples: CodeSample[] | undefined): string {
  if (!samples || samples.length === 0) return ''
  const tabs = samples.map((s) => {
    const code = escapeBackticks(s.code.trim())
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

// /v1/embeddings → api/embeddings
function deriveSlug(url: string): string {
  let s = url.replace(/^\/v\d+\//, '') // 去 /v1/
  s = s.replace(/^\/+|\/+$/g, '') // 去首尾斜杠
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

function main(): void {
  if (!fs.existsSync(OPENAPI_PATH)) {
    console.error(`openapi.yaml 不存在：${OPENAPI_PATH}`)
    process.exit(1)
  }
  const spec = yaml.load(fs.readFileSync(OPENAPI_PATH, 'utf-8')) as Spec
  if (!spec.paths) {
    console.error('openapi.yaml 无 paths')
    process.exit(1)
  }

  fs.mkdirSync(CONTENT_API_DIR, { recursive: true })

  let generated = 0
  let skipped = 0
  for (const [url, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const slug = deriveSlug(url)
      const fileName = slug.replace(/^api\//, '') + '.mdx'
      const outPath = path.join(CONTENT_API_DIR, fileName)

      // manual 保护
      const existing = getExistingSource(outPath)
      if (existing === 'manual') {
        console.warn(`跳过 ${fileName}（source=manual 手写，不覆盖）`)
        skipped++
        continue
      }

      const mdx = operationToMdx(method, url, op)
      fs.writeFileSync(outPath, mdx, 'utf-8')
      console.log(`生成 ${fileName}（slug=${slug}）`)
      generated++
    }
  }

  console.log(`\n完成：生成 ${generated} 篇，跳过 ${skipped} 篇`)
}

main()
