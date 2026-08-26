// gaps.ts — 文档缺口管理路由
// GET  /api/gaps            列出所有缺口
// POST /api/gaps/run        手动触发聚类
// POST /api/gaps/generate   手动触发自动生成（演示用）
// POST /api/gaps/:id/dismiss 忽略一个缺口
// POST /api/debug/seed-gaps  演示用：注入假 query 到 ask_sessions
import type { FastifyInstance } from 'fastify'
import { listAllGaps, dismissGap, db } from '../services/db.js'
import { runClusterJob } from '../services/cluster.js'
import { runAutoGenJob } from '../services/auto-gen.js'

export async function gapsRoutes(app: FastifyInstance): Promise<void> {
  // 列出所有文档缺口
  app.get('/api/gaps', async (request) => {
    const { status } = request.query as { status?: string }
    if (status && status !== 'all') {
      const rows = db.prepare(`SELECT * FROM doc_gaps WHERE status = ? ORDER BY query_count DESC`).all(status)
      return { gaps: rows }
    }
    return { gaps: listAllGaps(100) }
  })

  // 手动触发聚类（不等定时器）
  app.post('/api/gaps/run-cluster', async () => {
    const result = await runClusterJob()
    return { ok: true, ...result }
  })

  // 手动触发自动生成（演示用，最多生 2 篇避免太慢）
  app.post('/api/gaps/generate', async (_, reply) => {
    try {
      const result = await runAutoGenJob(2)
      return { ok: true, ...result }
    } catch (e: any) {
      return reply.code(500).send({ error: e.message })
    }
  })

  // 忽略缺口
  app.post('/api/gaps/:id/dismiss', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      dismissGap(Number(id))
      return { ok: true }
    } catch (e: any) {
      return reply.code(500).send({ error: e.message })
    }
  })

  // ── 演示种子：注入假 ask_sessions 零结果数据 ──────────────────
  // 调用后立刻能演示"零结果 → 聚类 → 候选"的完整链路
  app.post('/api/debug/seed-gaps', async () => {
    const seeds = [
      // 组 1：关于 streaming 流式
      '如何使用流式返回',
      '怎么做 streaming 流式响应',
      'stream 模式怎么接收',
      '流式 SSE 怎么用',
      // 组 2：关于多模态/图片
      '支持图片识别吗',
      '如何发送图片给模型',
      '多模态接口怎么调用',
      // 组 3：关于 SDK
      'Python SDK 怎么安装',
      'SDK 使用方法',
      'python 客户端库',
    ]

    // 插入 ask_sessions
    const stmt = db.prepare(
      `INSERT INTO ask_sessions (session_id, query, audience, result_none) VALUES (?, ?, 'external', 1)`,
    )
    for (const q of seeds) {
      for (let i = 0; i < 2; i++) {
        // 每个 query 插 2 次，确保满足 query_count >= 3 阈值
        stmt.run(`demo-${Date.now()}-${Math.random()}`, q)
      }
    }

    // 立即聚类
    const clusterResult = await runClusterJob()
    return { ok: true, seeded: seeds.length, ...clusterResult }
  })
}
