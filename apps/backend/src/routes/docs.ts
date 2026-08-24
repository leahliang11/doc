// 文档 API 路由：list / open / save / submit-review
import type { FastifyInstance } from 'fastify'
import * as git from '../services/git.js'
import * as gitlab from '../services/gitlab.js'
import { recordEditSession, createReviewTask } from '../services/db.js'
import { parseFrontmatter } from '../lib/frontmatter.js'
import { listDocs } from '../lib/list-docs.js'

export async function docsRoutes(app: FastifyInstance): Promise<void> {
  // 列出所有文档
  app.get('/api/docs', async () => {
    return listDocs()
  })

  // 打开文档：git pull（失败跳过）+ 读 mdx + 记 base_commit
  app.post('/api/docs/open', async (request, reply) => {
    const { slug, user } = request.body as { slug: string; user: string }
    if (!slug) return reply.code(400).send({ error: '缺少 slug' })

    try {
      // git pull 拉最新（云机访问 coding 不通时会超时失败，跳过不影响读本地内容）
      // SKIP_PULL=true 时直接跳过（云机部署用，避免每次开文档等 pull 超时）
      const skipPull = process.env.SKIP_PULL === 'true'
      if (!skipPull) {
        await Promise.race([
          git.pull(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('pull timeout')), 3000)),
        ]).catch(() => {
          request.log.warn('git pull 失败/超时，用本地内容')
        })
      }
      const raw = git.readFile(slug)
      const baseCommit = await git.getHeadCommit()
      recordEditSession(slug, user || 'unknown', baseCommit)

      const { frontmatter, body } = parseFrontmatter(raw)
      return { markdown: body, frontmatter, base_commit: baseCommit }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // 保存文档：冲突检测 + draft 分支 + commit + push
  app.post('/api/docs/save', async (request, reply) => {
    const { slug, markdown, base_commit, user } = request.body as {
      slug: string
      markdown: string
      base_commit: string
      user: { name: string; email: string }
    }
    if (!slug || !markdown || !base_commit) {
      return reply.code(400).send({ error: '缺少 slug/markdown/base_commit' })
    }

    try {
      // 冲突检测
      const conflict = await git.hasConflictSince(base_commit, slug)
      if (conflict) {
        const remoteContent = await git.getRemoteFileAtMain(slug)
        return reply.code(409).send({
          error: '文档已被他人修改，请查看差异或用你的覆盖',
          remote_markdown: remoteContent,
        })
      }

      // 切 draft 分支 + 写 + commit + push
      await git.createDraftBranch(slug)
      const { commitHash, branch } = await git.writeAndCommit(
        slug,
        markdown,
        user?.name || 'unknown',
        user?.email || 'unknown@example.com',
      )
      return { commit_hash: commitHash, branch }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // 提交审核：gitbeaker 创建 MR + 写 review_tasks
  app.post('/api/docs/submit-review', async (request, reply) => {
    const { slug, branch, submitter, title } = request.body as {
      slug: string
      branch: string
      submitter: string
      title?: string
    }
    if (!slug || !branch) {
      return reply.code(400).send({ error: '缺少 slug/branch' })
    }

    try {
      const mrTitle = title || `docs: ${slug} 待审核（by ${submitter || 'unknown'}）`
      const { iid, webUrl } = await gitlab.createMR(branch, mrTitle)
      createReviewTask({
        source: 'web',
        slug,
        branch,
        mrIid: iid,
        submitter: submitter || 'unknown',
      })
      return { mr_iid: iid, mr_url: webUrl }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })
}
