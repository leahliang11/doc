// AI 服务（真模型版）
// 4 能力调 Joybuilder chat-completions（dogfooding JoyMaaS 模型）
// W14：prompt 精调（few-shot 正反例）+ 2 个新能力（gen-params / gen-frontmatter）
import { chat, chatStream, type ChatMessage } from './joybuilder.js'
import { logAiCall, recordMetric, JOYBUILDER_MODEL } from './ai-log.js'

export type RewriteMode = 'simplify' | 'expand' | 'fix' | 'tone'

export interface AuditIssue {
  category: string // 技术准确性 / 链接 / 标点 / 口语化
  message: string
  search?: string // 用于在编辑器定位的文本片段
}

export interface FrontmatterSuggestion {
  title: string
  description: string
  category: 'quickstart' | 'api' | 'models' | 'guides' | 'troubleshooting'
  tags: string[]
}

// 记录 + 计时
function timed<T>(capability: string, prompt: string): {
  done: (response: string, ok: boolean) => void
} {
  const start = Date.now()
  return {
    done: (response, ok) => {
      const latencyMs = Date.now() - start
      recordMetric(capability, latencyMs, ok)
      logAiCall({ capability, model: JOYBUILDER_MODEL, prompt, response, latencyMs, ok })
    },
  }
}

// ────────────────────────────────────────────────────────────
// REWRITE（改写）
// ────────────────────────────────────────────────────────────

const REWRITE_SYSTEM = `你是技术文档编辑，专注于 API 和开发者文档。
按用户指定模式改写文本。只返回改写结果，不加任何解释、前缀或后缀。

【正确示例 - simplify】
输入：这个功能的话，我们可以通过搞定一些配置来啥的整一下
输出：该功能可通过完成相关配置来实现

【正确示例 - tone】
输入：跟着下面的步骤做一遍就好了
输出：按照以下步骤操作即可

【错误示例 - 不要这样做】
- 不要输出"好的，以下是改写结果："
- 不要输出"总的来说……"结尾
- 不要解释你做了哪些改动
- 不要重复原文后再给改写`

const MODE_LABEL: Record<RewriteMode, string> = {
  simplify: '精简：去掉冗词废话，保留主干，不要解释',
  expand: '扩写：在原文基础上补充必要说明和细节，保持技术准确，不要解释',
  fix: '纠错：修正标点错误、全半角混用、中英文间距不规范，不要解释',
  tone: '改语气：口语转正式书面风格，不要解释',
}

/** 选中改写（非流式） */
export async function rewrite(text: string, mode: RewriteMode): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: REWRITE_SYSTEM },
    { role: 'user', content: `模式：${MODE_LABEL[mode]}\n\n原文：\n${text}` },
  ]
  const t = timed('rewrite', text)
  try {
    const result = await chat(messages, { temperature: 0.3 })
    t.done(result, true)
    return result.trim()
  } catch (e) {
    t.done(String(e), false)
    throw e
  }
}

/** 改写流式版 */
export async function* rewriteStream(
  text: string,
  mode: RewriteMode,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: REWRITE_SYSTEM },
    { role: 'user', content: `模式：${MODE_LABEL[mode]}\n\n原文：\n${text}` },
  ]
  const t = timed('rewrite', text)
  let full = ''
  try {
    for await (const chunk of chatStream(messages, { temperature: 0.3, signal })) {
      full += chunk
      yield chunk
    }
    t.done(full, true)
  } catch (e) {
    t.done(full + String(e), false)
    throw e
  }
}

// ────────────────────────────────────────────────────────────
// COMPLETE（续写）
// ────────────────────────────────────────────────────────────

const COMPLETE_SYSTEM = `你是 JoyMaaS 技术文档编辑。根据上下文续写文档，保持风格一致。
只返回续写的内容，不复述原文，不加任何解释或前缀。

【续写原则】
- 续写内容与上文形成完整段落
- 不以"此外""总结""综上"开头
- 不重复上文已有内容
- 代码示例用 Markdown 代码块包裹

【正确示例】
上文以"...调用接口时需要在请求头中携带 API Key："结尾
续写：在 HTTP 请求的 Authorization 字段中，格式为 Bearer {your-api-key}。
建议将 API Key 存入环境变量，避免硬编码在代码中。

【错误示例】
- 不要输出"续写如下："
- 不要输出"综上所述"
- 不要重复上文内容`

/** 续写（非流式） */
export async function complete(context: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: COMPLETE_SYSTEM },
    { role: 'user', content: `上下文：\n${context}` },
  ]
  const t = timed('complete', context)
  try {
    const result = await chat(messages, { temperature: 0.4 })
    t.done(result, true)
    return result.trim()
  } catch (e) {
    t.done(String(e), false)
    throw e
  }
}

/** 续写流式版 */
export async function* completeStream(
  context: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: COMPLETE_SYSTEM },
    { role: 'user', content: `上下文：\n${context}` },
  ]
  const t = timed('complete', context)
  let full = ''
  try {
    for await (const chunk of chatStream(messages, { temperature: 0.4, signal })) {
      full += chunk
      yield chunk
    }
    t.done(full, true)
  } catch (e) {
    t.done(full + String(e), false)
    throw e
  }
}

// ────────────────────────────────────────────────────────────
// GENERATE（从描述生成）
// ────────────────────────────────────────────────────────────

const GENERATE_SYSTEM = `你是 JoyMaaS 技术文档作者。根据描述生成 MDX 文档片段。
只返回文档内容，不加任何解释。

【可用组件】
- <Callout type="info|warning|error|success" title="标题">内容</Callout>
- <Steps>步骤1\n\n步骤2</Steps>
- <Params params={[{name,type,required,description}]} />
- <CodeTabs tabs={[{label,code}]} />
- <InternalOnly>内部内容</InternalOnly>

【写作规范】
- 段落间空一行
- 代码示例用 \`\`\`语言\n代码\n\`\`\` 格式
- 操作步骤用 Steps 组件，不用 1. 2. 3.
- 注意事项用 Callout warning
- 标题用 ## 或 ###，不用 #

【错误示例 - 不要这样做】
- 不要输出"以下是生成的内容："
- 不要输出"希望对你有帮助"
- 不要用 # 一级标题`

/** 从描述生成（非流式） */
export async function generate(prompt: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: GENERATE_SYSTEM },
    { role: 'user', content: prompt },
  ]
  const t = timed('generate', prompt)
  try {
    const result = await chat(messages, { temperature: 0.5 })
    t.done(result, true)
    return result.trim()
  } catch (e) {
    t.done(String(e), false)
    throw e
  }
}

/** 生成流式版 */
export async function* generateStream(
  prompt: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: GENERATE_SYSTEM },
    { role: 'user', content: prompt },
  ]
  const t = timed('generate', prompt)
  let full = ''
  try {
    for await (const chunk of chatStream(messages, { temperature: 0.5, signal })) {
      full += chunk
      yield chunk
    }
    t.done(full, true)
  } catch (e) {
    t.done(full + String(e), false)
    throw e
  }
}

// ────────────────────────────────────────────────────────────
// AUDIT（文档体检）
// ────────────────────────────────────────────────────────────

const AUDIT_SYSTEM = `你是技术文档审核员，专注开发者 API 文档。检查文档并输出问题列表。
返回 JSON 格式：{"issues":[{"category":"...","message":"...","search":"..."}]}
无问题时返回 {"issues":[]}

【category 枚举】
- 口语化：正式文档不应出现的口语、废话
- 标点：全半角、多余标点、缺少标点
- 技术准确性：疑似错误的参数名、格式、描述
- 链接：相对路径引用、可能失效的链接

【正确检测示例】
口语化: "跟着做一遍" → message: "「跟着做一遍」建议改为「按照以下步骤操作」", search: "跟着做一遍"
标点: "api key" → message: "API Key 建议大写", search: "api key"

【常见口语化词汇（必须检测）】
整一下、搞定、跟着、做一遍、啥的、之类的、那么、就是说、其实就是、会的话`

/** 文档体检（JSON mode 一次性返回） */
export async function audit(doc: string): Promise<AuditIssue[]> {
  const messages: ChatMessage[] = [
    { role: 'system', content: AUDIT_SYSTEM },
    { role: 'user', content: `文档：\n${doc}` },
  ]
  const t = timed('audit', doc.slice(0, 500))
  try {
    const raw = await chat(messages, { jsonMode: true, temperature: 0.2 })
    const parsed = JSON.parse(raw)
    const issues: AuditIssue[] = Array.isArray(parsed.issues)
      ? parsed.issues.filter(
          (i: any) => i && typeof i.category === 'string' && typeof i.message === 'string',
        )
      : []
    t.done(raw, true)
    if (issues.length === 0) {
      issues.push({ category: '通过', message: '未检测到明显问题，可提交审核' })
    }
    return issues
  } catch (e) {
    t.done(String(e), false)
    throw e
  }
}

// ────────────────────────────────────────────────────────────
// GEN PARAMS FROM OPENAPI（新，W14）
// ────────────────────────────────────────────────────────────

/** 根据 OpenAPI schema 的参数列表，生成人话版的 <Params> MDX 片段 */
export async function genParamsFromSchema(
  endpointPath: string,
  method: string,
  params: Array<{ name: string; type: string; required: boolean; description: string }>,
): Promise<string> {
  const paramsJson = JSON.stringify(params, null, 2)
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是技术文档编辑。把 OpenAPI 参数列表转换为 JoyMaaS 文档的 <Params> 组件 MDX 代码。
只返回 MDX 代码片段，不加任何解释。

格式要求：
<Params params={[
  { name: "参数名", type: "类型", required: true/false, description: "中文描述" },
  ...
]} />

改写规则：
- 把英文技术描述改成自然、简洁的中文
- 保留参数名原样（不要翻译参数名）
- 类型保持英文（string/integer/number/boolean/array/object）
- required 字段保持布尔值`,
    },
    {
      role: 'user',
      content: `接口：${method.toUpperCase()} ${endpointPath}\n\n参数列表：\n${paramsJson}`,
    },
  ]
  const t = timed('gen-params', endpointPath)
  try {
    const result = await chat(messages, { temperature: 0.2 })
    t.done(result, true)
    return result.trim()
  } catch (e) {
    t.done(String(e), false)
    throw e
  }
}

// ────────────────────────────────────────────────────────────
// GEN FRONTMATTER（新，W14）
// ────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = 'quickstart | api | models | guides | troubleshooting'

/** 根据正文推断 frontmatter 字段 */
export async function genFrontmatter(body: string): Promise<FrontmatterSuggestion> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是 JoyMaaS 技术文档编辑。根据文档正文推断 frontmatter 元信息。
返回 JSON 格式：
{
  "title": "简短标题（10字以内）",
  "description": "一句话描述（30字以内，给搜索引擎和导航看）",
  "category": "${CATEGORY_OPTIONS}（选一个）",
  "tags": ["标签1", "标签2"]（3-5个，英文小写，如 chat, streaming, auth）
}

category 选择规则：
- quickstart：入门/快速开始
- api：具体 API 接口文档
- models：模型介绍/对比
- guides：场景指南/最佳实践/SDK 使用
- troubleshooting：问题排查/错误码`,
    },
    {
      role: 'user',
      content: `正文（前 1000 字）：\n${body.slice(0, 1000)}`,
    },
  ]
  const t = timed('gen-frontmatter', body.slice(0, 200))
  try {
    const raw = await chat(messages, { jsonMode: true, temperature: 0.3 })
    const parsed = JSON.parse(raw)
    t.done(raw, true)
    return {
      title: parsed.title ?? '',
      description: parsed.description ?? '',
      category: parsed.category ?? 'guides',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    }
  } catch (e) {
    t.done(String(e), false)
    throw e
  }
}
