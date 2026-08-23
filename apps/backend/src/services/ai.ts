// AI 服务（真模型版）
// 4 能力调 Joybuilder chat-completions（dogfooding JoyMaaS 模型）
// 函数签名不变，routes/ai.ts 不用改
//
// 4 能力：rewrite(改写) / complete(续写) / generate(生成) / audit(体检)
import { chat, chatStream, type ChatMessage } from './joybuilder.js'
import { logAiCall, recordMetric, JOYBUILDER_MODEL } from './ai-log.js'

export type RewriteMode = 'simplify' | 'expand' | 'fix' | 'tone'

export interface AuditIssue {
  category: string // 技术准确性 / 链接 / 标点 / 口语化
  message: string
  search?: string // 用于在编辑器定位的文本片段
}

const MODE_LABEL: Record<RewriteMode, string> = {
  simplify: '精简：去掉冗词，保留主干，不要解释',
  expand: '扩写：在原文基础上补充必要的说明，不要解释',
  fix: '纠错：修正常见标点、全半角、中英混用，不要解释',
  tone: '改语气：口语转书面，不要解释',
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

/** 选中改写：精简/扩写/纠错/改语气（非流式版，流式走 rewriteStream） */
export async function rewrite(text: string, mode: RewriteMode): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        '你是技术文档编辑。按用户指定的模式改写文本，只返回改写结果，不要任何解释或前后缀。',
    },
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

/** 改写流式版：yield 每个 chunk */
export async function* rewriteStream(
  text: string,
  mode: RewriteMode,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        '你是技术文档编辑。按用户指定的模式改写文本，只返回改写结果，不要任何解释或前后缀。',
    },
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

/** 续写补全：根据前文上下文生成后续文本 */
export async function complete(context: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        '你是技术文档编辑。根据上下文续写文档，保持风格一致，只返回续写的内容，不要复述原文，不要解释。',
    },
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
    {
      role: 'system',
      content:
        '你是技术文档编辑。根据上下文续写文档，保持风格一致，只返回续写的内容，不要复述原文，不要解释。',
    },
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

/** 从描述生成：输入描述生成整段/大纲 */
export async function generate(prompt: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        '你是 JoyMaaS 技术文档作者。根据描述生成 MDX 文档片段，可用 Callout/Steps/Params/CodeTabs/InternalOnly 组件。只返回文档内容，不要解释。',
    },
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
    {
      role: 'system',
      content:
        '你是 JoyMaaS 技术文档作者。根据描述生成 MDX 文档片段，可用 Callout/Steps/Params/CodeTabs/InternalOnly 组件。只返回文档内容，不要解释。',
    },
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

/** 文档体检：检查技术准确性/链接/标点/口语化（JSON mode 一次性返回） */
export async function audit(doc: string): Promise<AuditIssue[]> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        '你是技术文档审核员。检查文档的技术准确性、链接有效性、标点规范、口语化表达。返回 JSON，格式：{"issues":[{"category":"技术准确性|链接|标点|口语化","message":"问题描述","search":"用于定位的文本片段"}]}。无问题时返回 {"issues":[]}。',
    },
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
