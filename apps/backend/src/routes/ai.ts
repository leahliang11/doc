// AI 辅助写作路由：rewrite / complete / generate / audit
// rewrite/complete/generate 支持 stream:true 返回 SSE（边生成边显示）
// audit 用 JSON mode 一次性返回；加 GET /api/ai/metrics 读延迟监控
import type { FastifyInstance } from 'fastify'
import {
  rewrite,
  rewriteStream,
  complete,
  completeStream,
  generate,
  generateStream,
  audit,
  type RewriteMode,
} from '../services/ai.js'
import { getMetrics } from '../services/ai-log.js'

/** SSE helper：把 async generator 转成 text/event-stream */
async function streamSSE(
  reply: any,
  gen: AsyncGenerator<string>,
): Promise<void> {
  reply.raw.setHeader('Content-Type', 'text/event-stream')
  reply.raw.setHeader('Cache-Control', 'no-cache')
  reply.raw.setHeader('Connection', 'keep-alive')
  reply.raw.flushHeaders?.()
  try {
    for await (const chunk of gen) {
      reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`)
    }
    reply.raw.write('data: [DONE]\n\n')
  } catch (e: any) {
    reply.raw.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
  } finally {
    reply.raw.end()
  }
}

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  // 选中改写
  app.post('/api/ai/rewrite', async (request, reply) => {
    const { text, mode, stream } = request.body as {
      text: string
      mode: RewriteMode
      stream?: boolean
    }
    if (!text || !mode) {
      return reply.code(400).send({ error: '缺少 text 或 mode' })
    }
    try {
      if (stream) {
        // 流式不传 request.signal（Fastify reply 开始发送后 signal 会 abort）
        return streamSSE(reply, rewriteStream(text, mode))
      }
      const result = await rewrite(text, mode)
      return { text: result }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // 续写补全
  app.post('/api/ai/complete', async (request, reply) => {
    const { context, stream } = request.body as {
      context: string
      stream?: boolean
    }
    if (!context) {
      return reply.code(400).send({ error: '缺少 context' })
    }
    try {
      if (stream) {
        return streamSSE(reply, completeStream(context))
      }
      const result = await complete(context)
      return { text: result }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // 从描述生成
  app.post('/api/ai/generate', async (request, reply) => {
    const { prompt, stream } = request.body as {
      prompt: string
      stream?: boolean
    }
    if (!prompt) {
      return reply.code(400).send({ error: '缺少 prompt' })
    }
    try {
      if (stream) {
        return streamSSE(reply, generateStream(prompt))
      }
      const result = await generate(prompt)
      return { text: result }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // 文档体检（JSON mode 一次性返回）
  app.post('/api/ai/audit', async (request, reply) => {
    const { doc } = request.body as { doc: string }
    if (!doc) {
      return reply.code(400).send({ error: '缺少 doc' })
    }
    try {
      const issues = await audit(doc)
      return { issues }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // 延迟监控
  app.get('/api/ai/metrics', async () => {
    return { metrics: getMetrics() }
  })
}
