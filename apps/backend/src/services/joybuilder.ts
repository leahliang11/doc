// Joybuilder chat 客户端（标准 OpenAI Chat 兼容格式）
// dogfooding：用自家 JoyMaaS 模型做文档 AI 助手
//
// 端点：{JOYBUILDER_BASE_URL}/chat/completions
// 模型：默认 DeepSeek-V4-Flash（最快最干净），env 可换
import { JOYBUILDER_API_KEY, JOYBUILDER_BASE_URL, JOYBUILDER_MODEL } from '../config.js'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  stream?: boolean
  jsonMode?: boolean // response_format: { type: 'json_object' }
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal // 支持取消
}

const ENDPOINT = `${JOYBUILDER_BASE_URL}/chat/completions`

/** 非流式：返回 message.content（jsonMode 时返回 parsed JSON） */
export async function chat(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> {
  const body: Record<string, unknown> = {
    model: JOYBUILDER_MODEL,
    messages,
    stream: false,
  }
  if (opts.jsonMode) body.response_format = { type: 'json_object' }
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${JOYBUILDER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Joybuilder HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error(`Joybuilder 返回格式异常: ${JSON.stringify(data).slice(0, 200)}`)
  }
  return content
}

/** 流式：async generator，yield 每个 chunk 的 delta.content */
export async function* chatStream(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): AsyncGenerator<string> {
  const body: Record<string, unknown> = {
    model: JOYBUILDER_MODEL,
    messages,
    stream: true,
  }
  if (opts.jsonMode) body.response_format = { type: 'json_object' }
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${JOYBUILDER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  })
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Joybuilder HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE 以 \n\n 分隔事件
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const chunk = JSON.parse(payload)
        const delta = chunk?.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta.length > 0) yield delta
      } catch {
        // 单行 JSON 解析失败跳过（可能是半截 chunk）
      }
    }
  }
}
