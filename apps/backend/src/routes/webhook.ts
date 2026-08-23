// GitLab webhook 接收：merge_requests 事件写 review_tasks（工程师通道）
// 京东 Coding 是 GitLab 衍生，payload 结构见 docs/coding-integration.md
import type { FastifyInstance } from 'fastify'
import { WEBHOOK_SECRET } from '../config.js'
import {
  createReviewTask,
  findReviewTaskByMrIid,
  updateReviewTaskStatus,
} from '../services/db.js'

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/webhook/gitlab', async (request, reply) => {
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
        // push 事件 Week 6 处理（触发构建），本周只 ack
        request.log.info({ ref: body?.ref }, 'push webhook 收到（Week 6 处理）')
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
