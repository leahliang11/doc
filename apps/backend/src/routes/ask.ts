// Ask JoyMaaS 路由
// POST /api/ask → 文档问答，SSE 流式回答
// 长上下文策略：把全部已发布文档塞入 system prompt（10-30 篇，约 30-80KB，Joybuilder Pro 上下文够）
// 升级路径：内容到 100+ 篇时再换 RAG + embedding
import type { FastifyInstance } from 'fastify'
import { fileURLToPath } from 'url'
import fs from 'fs'
import path from 'path'
import { chatStream } from '../services/joybuilder.js'
import { createAskSession, updateAskSession, setAskUseful } from '../services/db.js'
import { buildDocsSystemContext, loadDocsContext } from '../services/docs-content.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROMPT_TEMPLATE = fs.readFileSync(
  path.join(__dirname, '../prompts/ask-system.md'),
  'utf-8',
)

// resultNone 判定关键词
const RESULT_NONE_PHRASES = [
  '文档里没有找到',
  '没有找到相关',
  '没有相关内容',
  '文档中没有',
  '文档没有提到',
  '不在文档范围',
  '建议联系售前',
]

function isResultNone(answer: string): boolean {
  const lower = answer.toLowerCase()
  return RESULT_NONE_PHRASES.some((p) => lower.includes(p) || answer.includes(p))
}

// SSE helper
function writeSSE(reply: any, event: string, data: unknown): void {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export async function askRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/ask
   * body: { query, audience?, pageSlug?, sessionId }
   * response: SSE stream
   *   event: chunk → data: { text }
   *   event: done  → data: { resultNone, latencyMs }
   *   event: error → data: { message }
   */
  app.post('/api/ask', async (request, reply) => {
    const { query, audience = 'external', pageSlug, sessionId } = request.body as {
      query: string
      audience?: 'external' | 'internal'
      pageSlug?: string
      sessionId: string
    }

    if (!query?.trim()) {
      return reply.code(400).send({ error: 'query 不能为空' })
    }
    if (!sessionId) {
      return reply.code(400).send({ error: 'sessionId 不能为空' })
    }

    // 记录会话（answer 后续补写）
    const sessionDbId = createAskSession({
      sessionId,
      query: query.trim(),
      audience,
      pageSlug,
    })

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders?.()

    const startTime = Date.now()
    let fullAnswer = ''

    try {
      // 构建 system prompt（按受众选全文上下文）
      const docsContext = buildDocsSystemContext(audience)

      // 当前页面上下文（如有）
      let pageContext = '（用户未在特定文档页面）'
      if (pageSlug) {
        const allDocs = loadDocsContext(audience)
        const currentDoc = allDocs.find(
          (d) => d.slug === pageSlug || d.slug.endsWith('/' + pageSlug),
        )
        if (currentDoc) {
          pageContext = `用户当前在「${currentDoc.title}」页面（${currentDoc.category} / ${pageSlug}）`
        }
      }

      const systemPrompt = PROMPT_TEMPLATE
        .replace('{{PAGE_CONTEXT}}', pageContext)
        .replace('{{DOCS_CONTEXT}}', docsContext)

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: query.trim() },
      ]

      // 流式回答
      for await (const chunk of chatStream(messages, { temperature: 0.3 })) {
        fullAnswer += chunk
        writeSSE(reply, 'chunk', { text: chunk })
      }

      const resultNone = isResultNone(fullAnswer)
      const latencyMs = Date.now() - startTime
      writeSSE(reply, 'done', { resultNone, latencyMs })

      // 异步写回 DB（不阻塞 SSE）
      try {
        updateAskSession(sessionDbId, fullAnswer, resultNone)
      } catch {
        // 忽略写 DB 失败，不影响用户
      }
    } catch (e: any) {
      writeSSE(reply, 'error', { message: e.message ?? '服务异常，请稍后重试' })
    } finally {
      reply.raw.end()
    }
  })

  /**
   * POST /api/ask/feedback
   * body: { sessionId, useful: boolean }
   * 用户点👍/👎 后调用
   */
  app.post('/api/ask/feedback', async (request, reply) => {
    const { sessionId, useful } = request.body as {
      sessionId: string
      useful: boolean
    }
    if (!sessionId) return reply.code(400).send({ error: 'sessionId 不能为空' })
    try {
      setAskUseful(sessionId, useful)
      return { ok: true }
    } catch (e: any) {
      return reply.code(500).send({ error: e.message })
    }
  })
}
