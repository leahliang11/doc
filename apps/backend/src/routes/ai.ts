// AI 辅助写作路由：rewrite / complete / generate / audit
// 当前走 services/ai.ts 的 mock 实现，后接真模型只改 services/ai.ts
import type { FastifyInstance } from 'fastify'
import { rewrite, complete, generate, audit, type RewriteMode } from '../services/ai.js'

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  // 选中改写
  app.post('/api/ai/rewrite', async (request, reply) => {
    const { text, mode } = request.body as { text: string; mode: RewriteMode }
    if (!text || !mode) {
      return reply.code(400).send({ error: '缺少 text 或 mode' })
    }
    try {
      const result = await rewrite(text, mode)
      return { text: result }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // 续写补全
  app.post('/api/ai/complete', async (request, reply) => {
    const { context } = request.body as { context: string }
    if (!context) {
      return reply.code(400).send({ error: '缺少 context' })
    }
    try {
      const result = await complete(context)
      return { text: result }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // 从描述生成
  app.post('/api/ai/generate', async (request, reply) => {
    const { prompt } = request.body as { prompt: string; length?: string; style?: string }
    if (!prompt) {
      return reply.code(400).send({ error: '缺少 prompt' })
    }
    try {
      const result = await generate(prompt)
      return { text: result }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // 文档体检
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
}
