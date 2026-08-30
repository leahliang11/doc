// 审核 API：列表 / 详情 / diff / 通过(merge) / 驳回(close) / 发布记录 / 工作台 / 待办
import type { FastifyInstance } from 'fastify'
import {
  listReviewTasks,
  getReviewTask,
  updateReviewTaskStatus,
  listPublishedReviews,
  countMergedThisWeek,
  recentReviewTasks,
  countPendingBuildTasks,
} from '../services/db.js'
import { listBuildTasks } from '../services/db.js'
import { getDiff } from '../services/git.js'
import { mergeMR, closeMR, getMRStatus } from '../services/gitlab.js'
import { listDocs } from '../lib/list-docs.js'
import { getMetrics } from '../services/ai-log.js'

// Week 8 登录前，审核者硬编码
const REVIEWER = 'leah'

export async function reviewRoutes(app: FastifyInstance): Promise<void> {
  // 列表：?status=pending|approved|rejected|merged|all（默认 pending）
  app.get('/api/review-tasks', async (request) => {
    const { status } = request.query as { status?: string }
    return listReviewTasks(status || 'pending')
  })

  // 单条详情
  app.get('/api/review-tasks/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const task = getReviewTask(Number(id))
    if (!task) return reply.code(404).send({ error: '审核任务不存在' })
    return task
  })

  // diff：该分支相对 main 的内容改动
  app.get('/api/review-tasks/:id/diff', async (request, reply) => {
    const { id } = request.params as { id: string }
    const task = getReviewTask(Number(id))
    if (!task) return reply.code(404).send({ error: '审核任务不存在' })
    try {
      const diff = await getDiff(task.branch)
      return { diff, branch: task.branch }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: '获取 diff 失败：' + e.message })
    }
  })

  // 通过：合并 Pull Request + 更新状态。
  // 合并 API 返回后再次查询实际状态，避免平台接受请求但尚未真正合入。
  app.post('/api/review-tasks/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string }
    const task = getReviewTask(Number(id))
    if (!task) return reply.code(404).send({ error: '审核任务不存在' })
    if (task.status !== 'pending') {
      return reply.code(400).send({ error: `该任务已处理（${task.status}）` })
    }
    if (!task.mr_iid) {
      return reply.code(400).send({ error: '该任务无 Pull Request 编号，无法合并' })
    }
    try {
      await mergeMR(task.mr_iid)
      // 查实际状态，确认代码是否真的合入。
      const status = await getMRStatus(task.mr_iid)
      if (status.state === 'merged') {
        updateReviewTaskStatus(task.id, 'merged', REVIEWER, '审核通过，已合入 main')
        return { status: 'merged', mr_iid: task.mr_iid, merge_status: status.mergeStatus }
      } else {
        // 调用链通了但平台没真合（评审规则拦住）
        updateReviewTaskStatus(
          task.id,
          'pending',
          REVIEWER,
          `已调用合并 API，但 Pull Request 未合入（state=${status.state}, merge_status=${status.mergeStatus}）。请检查分支保护规则或冲突。`,
        )
        return reply.code(409).send({
          status: 'merge_pending',
          mr_iid: task.mr_iid,
          merge_status: status.mergeStatus,
          message: '合并 API 已调用，但 Pull Request 尚未实际合入。请检查分支保护规则或冲突。',
        })
      }
    } catch (e: any) {
      request.log.error(e)
      // merge 调用本身报错（如 403 权限），仍算调用链通，但如实记录
      updateReviewTaskStatus(
        task.id,
        'pending',
        REVIEWER,
        `merge 调用报错：${e.message}`,
      )
      return reply.code(500).send({ error: '合并 Pull Request 失败：' + e.message })
    }
  })

  // 驳回：关闭 Pull Request + 更新状态 + 记录评论
  app.post('/api/review-tasks/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { comment } = request.body as { comment?: string }
    const task = getReviewTask(Number(id))
    if (!task) return reply.code(404).send({ error: '审核任务不存在' })
    if (task.status !== 'pending') {
      return reply.code(400).send({ error: `该任务已处理（${task.status}）` })
    }
    if (!task.mr_iid) {
      return reply.code(400).send({ error: '该任务无 Pull Request 编号，无法关闭' })
    }
    try {
      await closeMR(task.mr_iid)
      updateReviewTaskStatus(task.id, 'rejected', REVIEWER, comment || '审核驳回')
      return { status: 'rejected', mr_iid: task.mr_iid }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: '关闭 Pull Request 失败：' + e.message })
    }
  })

  // 发布记录：分页查已 merged
  app.get('/api/publish', async (request) => {
    const { page = '1', pageSize = '20' } = request.query as { page?: string; pageSize?: string }
    const p = Math.max(1, Number(page) || 1)
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20))
    const { items, total } = listPublishedReviews(p, ps)
    return { items, total, page: p, pageSize: ps }
  })

  // 工作台统计
  app.get('/api/dashboard/stats', async () => {
    const allDocs = listDocs()
    const pending = listReviewTasks('pending')
    const publishedThisWeek = countMergedThisWeek()
    const recentEdits = recentReviewTasks(5)
    const buildPending = countPendingBuildTasks()

    // AI 调用数：汇总各能力 count
    let aiCallsThisWeek = 0
    try {
      const m = getMetrics()
      aiCallsThisWeek = Object.values(m).reduce((s, v) => s + (v.count || 0), 0)
    } catch {
      /* ai-log 可能没数据 */
    }

    return {
      docsTotal: allDocs.length,
      pendingReview: pending.length,
      publishedThisWeek,
      aiCallsThisWeek,
      buildPending,
      recentEdits,
    }
  })

  // 待办：4 分组（conflicts/aiWarnings P0 降级空）
  app.get('/api/todos', async () => {
    const pendingReviews = listReviewTasks('pending')
    const buildPending = listBuildTasks('pending')
    return {
      pendingReviews,
      conflicts: [], // P0 降级：draft 分支冲突检测复杂，见审核队列
      aiWarnings: [], // P0 降级：不持久化 AI 结果
      buildPending,
    }
  })
}
