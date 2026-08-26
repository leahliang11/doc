// AI 辅助写作路由：rewrite / complete / generate / audit + (W14) gen-params / gen-frontmatter
// rewrite/complete/generate 支持 stream:true 返回 SSE
// audit/gen-params/gen-frontmatter 用 JSON mode 一次性返回
import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'
import * as yaml from 'js-yaml'
import { fileURLToPath } from 'url'
import {
  rewrite,
  rewriteStream,
  complete,
  completeStream,
  generate,
  generateStream,
  audit,
  genParamsFromSchema,
  genFrontmatter,
  type RewriteMode,
} from '../services/ai.js'
import { getMetrics } from '../services/ai-log.js'
import { logAiSession, listAiSessions } from '../services/db.js'
import { CONTENT_REPO_PATH } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

  // ── W14 新增 ─────────────────────────────────────────────────

  // AI 会话历史（按 docSlug 查）
  app.get('/api/ai/sessions', async (request) => {
    const { docSlug, limit } = request.query as { docSlug?: string; limit?: string }
    if (!docSlug) return { sessions: [] }
    return { sessions: listAiSessions(docSlug, limit ? Number(limit) : 30) }
  })

  // 根据 OpenAPI spec 生成 <Params> MDX
  app.post('/api/ai/gen-params', async (request, reply) => {
    const { endpoint, docSlug } = request.body as {
      endpoint: string
      docSlug?: string
    }
    if (!endpoint) return reply.code(400).send({ error: '缺少 endpoint' })

    // 读 openapi.yaml，找对应 path 的参数
    const openapiPath = path.join(CONTENT_REPO_PATH, 'content-repo', 'openapi', 'openapi.yaml')
    if (!fs.existsSync(openapiPath)) {
      return reply.code(404).send({ error: '找不到 openapi.yaml' })
    }

    let spec: any
    try {
      spec = yaml.load(fs.readFileSync(openapiPath, 'utf-8'))
    } catch (e: any) {
      return reply.code(500).send({ error: `openapi.yaml 解析失败: ${e.message}` })
    }

    // 查找 path（endpoint slug → 匹配 /v1/<endpoint> 或路径含 endpoint 的）
    const normalizedEndpoint = endpoint.replace(/-/g, '/') // chat-completions → chat/completions
    let targetPath = ''
    let targetOp: any = null

    for (const [p, methods] of Object.entries(spec.paths ?? {})) {
      if (
        p.endsWith('/' + endpoint) ||
        p.endsWith('/' + normalizedEndpoint) ||
        p.includes(endpoint)
      ) {
        const ops = methods as any
        const op = ops.post ?? ops.get
        if (op) {
          targetPath = p
          targetOp = op
          break
        }
      }
    }

    if (!targetOp) {
      return reply.code(404).send({ error: `找不到 endpoint: ${endpoint}` })
    }

    // 提取参数
    const schema =
      targetOp.requestBody?.content?.['application/json']?.schema ?? {}
    const properties: Record<string, any> = schema.properties ?? {}
    const required: string[] = schema.required ?? []

    const params = Object.entries(properties).map(([name, prop]: [string, any]) => ({
      name,
      type: prop.type ?? 'string',
      required: required.includes(name),
      description: prop.description ?? '',
    }))

    if (params.length === 0) {
      return reply.code(404).send({ error: `${endpoint} 没有找到请求参数` })
    }

    try {
      const mdx = await genParamsFromSchema(targetPath, 'POST', params)
      if (docSlug) {
        logAiSession({
          docSlug,
          action: 'gen-params',
          prompt: `endpoint: ${endpoint}`,
          response: mdx.slice(0, 500),
        })
      }
      return { mdx }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // 根据正文推断 frontmatter
  app.post('/api/ai/gen-frontmatter', async (request, reply) => {
    const { body: docBody, docSlug } = request.body as {
      body: string
      docSlug?: string
    }
    if (!docBody) return reply.code(400).send({ error: '缺少 body' })
    try {
      const suggestion = await genFrontmatter(docBody)
      if (docSlug) {
        logAiSession({
          docSlug,
          action: 'gen-frontmatter',
          prompt: docBody.slice(0, 200),
          response: JSON.stringify(suggestion),
        })
      }
      return { suggestion }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })
}
