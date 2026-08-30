// GitLab/Coding 与 GitHub webhook 接收：把代码平台状态同步到审核队列。
import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import { WEBHOOK_SECRET } from '../config.js'
import {
  createReviewTask,
  createReviewTaskWithKind,
  findReviewTaskByMrIid,
  updateReviewTaskStatus,
  recordBuildNeed,
} from '../services/db.js'

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/webhook/gitlab', async (request, reply) => {
    if (process.env.NODE_ENV === 'production' && !WEBHOOK_SECRET) {
      request.log.error('生产环境未配置 WEBHOOK_SECRET，拒绝接收 webhook')
      return reply.code(503).send({ error: 'webhook secret is not configured' })
    }
    // 1. 校验 X-Gitlab-Token（生产必填；本地 WEBHOOK_SECRET 留空则跳过校验）
    if (WEBHOOK_SECRET) {
      const token = request.headers['x-gitlab-token']
      if (token !== WEBHOOK_SECRET) {
        request.log.warn({ token }, 'webhook token 校验失败')
        return reply.code(401).send({ error: 'invalid webhook token' })
      }
    }

    const body = request.body as any
    const objectKind = body?.object_kind

    try {
      // 2. 按事件类型分发
      if (objectKind === 'merge_requests') {
        await handleMergeRequests(body, request)
      } else if (objectKind === 'push') {
        // push 到 main → 记 build_tasks（不自动 spawn 构建，手动/CI 触发）
        const ref = body?.ref || ''
        if (ref.includes('main')) {
          const id = recordBuildNeed('push', ref)
          request.log.info({ ref, id }, 'push 到 main，记 build_tasks')
        } else {
          request.log.info({ ref }, 'push 非 main 分支，忽略')
        }
      } else {
        request.log.info({ objectKind }, '未处理的 webhook 事件类型')
      }

      // webhook 必须 200，否则 Coding 重试
      return reply.code(200).send({ status: 'ok' })
    } catch (e: any) {
      request.log.error(e, 'webhook 处理异常')
      // 即使异常也返回 200，避免 Coding 无限重试（错误已记日志）
      return reply.code(200).send({ status: 'error', message: e.message })
    }
  })

  // GitHub webhook：pull_request 与 push 事件。
  // GitHub 的签名使用 HMAC-SHA256；本地调试也支持 x-github-token，便于 curl 验证链路。
  app.post('/api/webhook/github', async (request, reply) => {
    if (process.env.NODE_ENV === 'production' && !WEBHOOK_SECRET) {
      request.log.error('生产环境未配置 WEBHOOK_SECRET，拒绝接收 GitHub webhook')
      return reply.code(503).send({ error: 'webhook secret is not configured' })
    }

    const body = request.body as any
    if (WEBHOOK_SECRET && !verifyGitHubWebhook(request, body)) {
      request.log.warn('GitHub webhook 签名校验失败')
      return reply.code(401).send({ error: 'invalid webhook signature' })
    }

    const event = firstHeader(request.headers['x-github-event'])
    try {
      if (event === 'pull_request') {
        await handleGitHubPullRequest(body, request)
      } else if (event === 'push') {
        await handleGitHubPush(body, request)
      } else {
        request.log.info({ event }, '未处理的 GitHub webhook 事件类型')
      }

      // webhook 必须尽快返回 2xx，否则 GitHub 会重试。
      return reply.code(200).send({ status: 'ok' })
    } catch (e: any) {
      request.log.error(e, 'GitHub webhook 处理异常')
      // 业务异常已经写日志；返回 200 避免平台无限重试同一事件。
      return reply.code(200).send({ status: 'error', message: e.message })
    }
  })
}

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function verifyGitHubWebhook(request: any, body: any): boolean {
  const token = firstHeader(request.headers['x-github-token'])
  if (token && safeEqual(token, WEBHOOK_SECRET)) return true

  const signature = firstHeader(request.headers['x-hub-signature-256'])
  if (!signature.startsWith('sha256=')) return false
  // Fastify 已将 JSON 解析为对象；对等价 JSON 重新序列化后计算签名。
  // GitHub payload 使用紧凑 JSON，正常情况下与 JSON.stringify 结果一致。
  const digest = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(body ?? ''))
    .digest('hex')
  return safeEqual(signature.slice('sha256='.length), digest)
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

async function handleGitHubPullRequest(body: any, request: any): Promise<void> {
  const action = body?.action
  const pr = body?.pull_request
  if (!pr?.number) return

  const targetBranch = pr.base?.ref
  if (targetBranch !== 'main') {
    request.log.info({ targetBranch, number: pr.number }, 'PR 目标分支非 main，忽略')
    return
  }

  const iid = Number(pr.number)
  const existing = findReviewTaskByMrIid(iid)
  const sourceBranch = pr.head?.ref || ''
  const submitter = pr.user?.login || pr.user?.name || 'unknown'

  if (action === 'opened' || action === 'reopened') {
    if (existing) {
      // reopened 代表重新进入审核；opened 重复事件保持幂等。
      if (action === 'reopened' && existing.status !== 'pending') {
        updateReviewTaskStatus(existing.id, 'pending', undefined, 'GitHub PR 已重新打开，等待审核')
      }
      request.log.info({ iid }, 'GitHub PR 已存在审核任务，跳过重复创建')
      return
    }
    const slug = parseSlugFromBranch(sourceBranch)
    createReviewTaskWithKind({
      source: 'github_pr',
      sourceKind: 'engineer',
      slug,
      branch: sourceBranch,
      mrIid: iid,
      submitter,
    })
    request.log.info({ iid, slug, sourceBranch, submitter }, 'GitHub PR open 写入 review_tasks')
    return
  }

  if (action === 'closed') {
    if (!existing) {
      request.log.info({ iid }, 'GitHub PR 关闭但未找到对应审核任务')
      return
    }
    if (pr.merged === true) {
      updateReviewTaskStatus(existing.id, 'merged', undefined, 'GitHub PR 已合入 main')
      request.log.info({ iid, taskId: existing.id }, 'GitHub PR merge 更新 review_tasks 为 merged')
    } else {
      updateReviewTaskStatus(existing.id, 'rejected', undefined, 'GitHub PR 已关闭')
      request.log.info({ iid, taskId: existing.id }, 'GitHub PR close 更新 review_tasks 为 rejected')
    }
    return
  }

  request.log.info({ action, iid }, 'GitHub PR 事件暂不处理')
}

async function handleGitHubPush(body: any, request: any): Promise<void> {
  const ref = body?.ref || ''
  if (ref === 'refs/heads/main' || ref.endsWith('/main')) {
    const id = recordBuildNeed('github_push', ref)
    request.log.info({ ref, id }, 'GitHub push 到 main，记 build_tasks')
  } else {
    request.log.info({ ref }, 'GitHub push 非 main 分支，忽略')
  }
}

// 处理 merge_requests 事件
async function handleMergeRequests(body: any, request: any): Promise<void> {
  const attrs = body?.object_attributes
  if (!attrs) return

  const action = attrs.action // open | merge | close | reopen | update
  const iid = attrs.iid
  const sourceBranch = attrs.source_branch
  const targetBranch = attrs.target_branch
  const title = attrs.title
  const user = body?.user

  // 只关心目标分支是 main 的 MR（内容变更走 main）
  if (targetBranch !== 'main') {
    request.log.info({ targetBranch, iid }, 'MR 目标分支非 main，忽略')
    return
  }

  if (action === 'open') {
    // 去重：同一 MR iid 已有记录则跳过
    const existing = findReviewTaskByMrIid(iid)
    if (existing) {
      request.log.info({ iid }, 'MR open webhook 重复，跳过')
      return
    }
    const slug = parseSlugFromBranch(sourceBranch)
    const submitter = user?.name || user?.username || 'unknown'
    createReviewTask({
      source: 'gitlab_mr',
      slug,
      branch: sourceBranch,
      mrIid: iid,
      submitter,
    })
    request.log.info({ iid, slug, sourceBranch, submitter }, 'MR open 写入 review_tasks')
    return
  }

  if (action === 'merge') {
    // MR 合入 main：更新对应 review_task 状态为 merged
    const task = findReviewTaskByMrIid(iid)
    if (task) {
      updateReviewTaskStatus(task.id, 'merged', undefined, 'MR 已合入 main')
      request.log.info({ iid, taskId: task.id }, 'MR merge 更新 review_tasks 为 merged')
    }
    return
  }

  if (action === 'close') {
    // MR 关闭（未合并）：更新为 rejected
    const task = findReviewTaskByMrIid(iid)
    if (task) {
      updateReviewTaskStatus(task.id, 'rejected', undefined, 'MR 已关闭')
      request.log.info({ iid, taskId: task.id }, 'MR close 更新 review_tasks 为 rejected')
    }
    return
  }

  // update / reopen 暂不处理
  request.log.info({ action, iid }, 'MR 事件暂不处理')
}

// 从分支名解析 slug
// draft/quickstart-1787xxx → quickstart
// feature/quickstart-fix → quickstart（取 / 后到 - 前）
// quickstart-update → quickstart（取到 - 前）
// 取不到就用整个分支名
function parseSlugFromBranch(branch: string): string {
  // 去掉前缀到 /
  let rest = branch
  const slashIdx = rest.lastIndexOf('/')
  if (slashIdx >= 0) rest = rest.slice(slashIdx + 1)
  // 去掉时间戳后缀（-数字结尾）
  rest = rest.replace(/-\d+$/, '')
  // 去掉 -update / -fix 等后缀到第一个 -
  const dashIdx = rest.indexOf('-')
  if (dashIdx >= 0) rest = rest.slice(0, dashIdx)
  return rest || branch
}
