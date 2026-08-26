// Fastify 服务启动
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { docsRoutes } from './routes/docs.js'
import { aiRoutes } from './routes/ai.js'
import { playgroundRoutes } from './routes/playground.js'
import { webhookRoutes } from './routes/webhook.js'
import { reviewRoutes } from './routes/review.js'
import { buildRoutes } from './routes/build.js'
import { metaRoutes } from './routes/meta.js'
import { PORT } from './config.js'

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: true, // 开发期允许所有来源（Week 4 后台在别的端口）
})

await app.register(docsRoutes)
await app.register(aiRoutes)
await app.register(playgroundRoutes)
await app.register(webhookRoutes)
await app.register(reviewRoutes)
await app.register(buildRoutes)
await app.register(metaRoutes)

app.get('/health', async () => ({ status: 'ok' }))

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
