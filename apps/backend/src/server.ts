// Fastify 服务启动
import Fastify from 'fastify'
import cors from '@fastify/cors'
import crypto from 'node:crypto'
import { docsRoutes } from './routes/docs.js'
import { aiRoutes } from './routes/ai.js'
import { playgroundRoutes } from './routes/playground.js'
import { askRoutes } from './routes/ask.js'
import { gapsRoutes } from './routes/gaps.js'
import { startClusterScheduler } from './services/cluster.js'
import { webhookRoutes } from './routes/webhook.js'
import { reviewRoutes } from './routes/review.js'
import { buildRoutes } from './routes/build.js'
import { metaRoutes } from './routes/meta.js'
import { ADMIN_PASSWORD, ADMIN_TOKEN, ADMIN_USERNAME, CORS_ORIGINS, PORT } from './config.js'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: process.env.NODE_ENV === 'production' ? CORS_ORIGINS : true,
})

const PUBLIC_API_PATHS = new Set([
  '/api/admin/login',
  '/api/ask',
  '/api/ask/feedback',
  '/api/playground/run',
  '/api/webhook/gitlab',
  '/api/webhook/github',
])

function safeTokenEqual(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// 后台 API 默认关闭匿名访问。Ask / Playground / webhook 保持公开，各自走自己的保护策略。
app.addHook('onRequest', async (request, reply) => {
  const pathname = request.url.split('?')[0]
  if (!pathname.startsWith('/api/') || PUBLIC_API_PATHS.has(pathname)) return

  const authorization = request.headers.authorization ?? ''
  const candidate = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''
  if (!candidate || !safeTokenEqual(candidate, ADMIN_TOKEN)) {
    return reply.code(401).send({ error: '后台访问令牌无效或已过期' })
  }
})

app.get('/api/admin/session', async () => ({ ok: true }))

app.post('/api/admin/login', async (request, reply) => {
  const { username, password } = request.body as { username?: string; password?: string }
  if (!ADMIN_PASSWORD) {
    return reply.code(503).send({ error: '后台账号密码尚未配置，请联系管理员' })
  }
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return reply.code(401).send({ error: '账号或密码不正确' })
  }
  return { token: ADMIN_TOKEN }
})

await app.register(docsRoutes)
await app.register(aiRoutes)
await app.register(playgroundRoutes)
await app.register(askRoutes)
await app.register(gapsRoutes)
await app.register(webhookRoutes)
await app.register(reviewRoutes)
await app.register(buildRoutes)
await app.register(metaRoutes)

app.get('/health', async () => ({ status: 'ok' }))

// 启动文档缺口聚类调度器（6h 定时）
startClusterScheduler((msg) => app.log.info(msg))

const start = async () => {
  try {
    await app.listen({ host: '0.0.0.0', port: PORT })
    app.log.info(`后端服务启动：http://localhost:${PORT}`)
  } catch (e) {
    app.log.error(e)
    process.exit(1)
  }
}

start()
