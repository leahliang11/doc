// Playground 代理路由
// POST /api/playground/run → 代调 Joybuilder，SSE 流式回流
// 前端不接触 API Key；Key 在后端 .env 里，用服务级 Key 统一代调
// IP 维度频控：10 req/min（内存 Map，重启清空，够用于演示）
import type { FastifyInstance } from 'fastify'
import { JOYBUILDER_API_KEY, JOYBUILDER_BASE_URL } from '../config.js'

// ────────────────────────────────────────────────────────────
// 白名单：Playground 只允许代调这三个 endpoint
// ────────────────────────────────────────────────────────────
const ENDPOINT_MAP: Record<string, string> = {
  'chat-completions': `${JOYBUILDER_BASE_URL}/chat/completions`,
  'embeddings': `${JOYBUILDER_BASE_URL}/embeddings`,
  'moderations': `${JOYBUILDER_BASE_URL}/moderations`,
}

// ────────────────────────────────────────────────────────────
// IP 频控：10 req/min，内存 Map<ip, {count, windowStart}>
// ────────────────────────────────────────────────────────────
const RATE_LIMIT = 10          // req per window
const WINDOW_MS = 60 * 1000   // 1 分钟

interface RateBucket {
  count: number
  windowStart: number
}
const rateBuckets = new Map<string, RateBucket>()

function checkRate(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (bucket.count >= RATE_LIMIT) return false
  bucket.count++
  return true
}

// 定期清理过期 bucket（避免 Map 无限增长）
setInterval(() => {
  const now = Date.now()
  for (const [ip, bucket] of rateBuckets) {
    if (now - bucket.windowStart > WINDOW_MS * 2) rateBuckets.delete(ip)
  }
}, WINDOW_MS * 2)

// ────────────────────────────────────────────────────────────
// SSE helper（和 ai.ts 保持一致）
// ────────────────────────────────────────────────────────────
function startSSE(reply: any): void {
  reply.raw.setHeader('Content-Type', 'text/event-stream')
  reply.raw.setHeader('Cache-Control', 'no-cache')
  reply.raw.setHeader('Connection', 'keep-alive')
  reply.raw.setHeader('Access-Control-Allow-Origin', '*')
  reply.raw.flushHeaders?.()
}

function writeSSE(reply: any, event: string, data: unknown): void {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export async function playgroundRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/playground/run
   * body: { endpoint: string, body: object }
   * response: SSE stream
   *   event: chunk  data: { text: string }
   *   event: done   data: { latencyMs: number }
   *   event: error  data: { message: string, status?: number }
   */
  app.post('/api/playground/run', async (request, reply) => {
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      request.ip ||
      'unknown'

    // 频控
    if (!checkRate(ip)) {
      return reply.code(429).send({ error: '请求过于频繁，请 1 分钟后再试' })
    }

    const { endpoint, body } = request.body as {
      endpoint?: string
      body?: unknown
    }

    // 参数校验
    if (!endpoint || typeof endpoint !== 'string') {
      return reply.code(400).send({ error: 'endpoint 不能为空' })
    }
    const targetUrl = ENDPOINT_MAP[endpoint]
    if (!targetUrl) {
      return reply.code(400).send({
        error: `不支持的 endpoint: ${endpoint}，允许值: ${Object.keys(ENDPOINT_MAP).join(', ')}`,
      })
    }
    if (!body || typeof body !== 'object') {
      return reply.code(400).send({ error: 'body 不能为空' })
    }

    const startTime = Date.now()

    // 强制 stream: true，Playground 总是 SSE
    const proxyBody: Record<string, unknown> = {
      ...(body as Record<string, unknown>),
      stream: true,
    }

    startSSE(reply)

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${JOYBUILDER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(proxyBody),
      })

      // 非 200：一次性错误
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        let errJson: Record<string, unknown> | null = null
        try { errJson = JSON.parse(errText) } catch { /* 忽略 */ }
        writeSSE(reply, 'error', {
          status: res.status,
          message: errJson ?? errText.slice(0, 300) || `HTTP ${res.status}`,
        })
        reply.raw.end()
        return
      }

      if (!res.body) {
        writeSSE(reply, 'error', { message: 'Joybuilder 响应 body 为空' })
        reply.raw.end()
        return
      }

      // embeddings / moderations 本身不是流式，但我们请求了 stream:true
      // 部分接口会直接一次性返回；用通用 SSE 解析，兼容非流式响应
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') {
            writeSSE(reply, 'done', { latencyMs: Date.now() - startTime })
            reply.raw.end()
            return
          }
          try {
            const chunk = JSON.parse(payload)
            // chat/completions stream delta
            const delta = chunk?.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta.length > 0) {
              writeSSE(reply, 'chunk', { text: delta })
              continue
            }
            // embeddings / moderations 一次性 JSON（包在 SSE 里）
            if (chunk?.data || chunk?.results || chunk?.object) {
              writeSSE(reply, 'chunk', { text: JSON.stringify(chunk, null, 2) })
            }
          } catch {
            // 跳过无法解析的行
          }
        }
      }

      // 没收到 [DONE] 但 body 已读完
      writeSSE(reply, 'done', { latencyMs: Date.now() - startTime })
      reply.raw.end()
    } catch (e: any) {
      writeSSE(reply, 'error', { message: e.message ?? 'Unknown error' })
      reply.raw.end()
    }
  })
}
