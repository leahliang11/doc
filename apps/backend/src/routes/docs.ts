// 文档 API 路由：list / open / save / submit-review / create / gen-openapi
import type { FastifyInstance } from 'fastify'
import path from 'path'
import fs from 'fs'
import * as git from '../services/git.js'
import * as gitlab from '../services/gitlab.js'
import { recordEditSession, createReviewTask } from '../services/db.js'
import { parseFrontmatter } from '../lib/frontmatter.js'
import { listDocs } from '../lib/list-docs.js'
import { CONTENT_REPO_PATH, SITE_DIR } from '../config.js'
import { dumpMeta, saveMetaViaDraft, appendPageAndCommitMain, movePageInMeta } from './meta.js'

// slug 合法性校验：小写字母/数字/连字符/斜杠，禁 .. 和绝对路径防穿越
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9/-]*$/.test(slug) && !slug.includes('..') && !slug.startsWith('/')
}

// 新建文档的文件路径（文件不存在，用 <slug>.mdx 或 <slug>/index.mdx 规则）
function resolveNewFilePath(slug: string): { abs: string; gitPath: string } {
  const CONTENT_DIR = path.join(CONTENT_REPO_PATH, 'content-repo', 'content')
  const abs = slug.includes('/')
    ? path.join(CONTENT_DIR, `${slug}.mdx`)
    : path.join(CONTENT_DIR, slug, 'index.mdx')
  const gitPath = path.relative(CONTENT_REPO_PATH, abs)
  return { abs, gitPath }
}

// 模板内容
function getTemplateContent(template: string | undefined, title: string, slug: string): string {
  const today = new Date().toISOString().slice(0, 10)
  if (template === 'quickstart') {
    const templatePath = path.join(CONTENT_REPO_PATH, 'content-repo', 'content', 'quickstart', 'index.mdx')
    if (fs.existsSync(templatePath)) {
      let content = fs.readFileSync(templatePath, 'utf-8')
      content = content.replace(/^title: .*/m, `title: ${title}`)
      content = content.replace(/^slug: .*/m, `slug: ${slug}`)
      return content
    }
  }
  return `---
title: ${title}
description: ${title}
slug: ${slug}
category: guides
audience: external
updated: ${today}
status: draft
owner: leah
ai_readable: true
source: manual
---

# ${title}

开始写文档。
`
}

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

  // 新建文档：写文件 + commit 到 main + push
  app.post('/api/docs/create', async (request, reply) => {
    const { title, slug, template, sectionId, groupId, user } = request.body as {
      title: string
      slug: string
      template?: string
      sectionId?: string
      groupId?: string
      user: { name: string; email: string }
    }
    if (!title || !slug) {
      return reply.code(400).send({ error: '缺少 title/slug' })
    }
    if (!isValidSlug(slug)) {
      return reply.code(400).send({ error: 'slug 不合法（只能小写字母/数字/连字符/斜杠）' })
    }

    const { abs, gitPath } = resolveNewFilePath(slug)
    if (fs.existsSync(abs)) {
      return reply.code(409).send({ error: `文档已存在：${slug}` })
    }

    try {
      const mdxContent = getTemplateContent(template, title, slug)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      // 写文件 + commit main + push（绕过双通道，P0 新建走快速通道）
      const { commitHash } = await git.commitToMain(
        slug,
        mdxContent,
        user?.name || 'unknown',
        user?.email || 'unknown@example.com',
        abs,
        gitPath,
      )
      // 若指定了 section/group，同步把新 slug 追加进 _meta.yaml（同样直降 main 快速通道）
      const metaRes = await appendPageAndCommitMain(slug, sectionId, groupId)
      return { slug, commit_hash: commitHash, meta: metaRes }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // 移动文档：把 slug 从 A 分组移到 B 分组（走 draft 分支 + MR 审核，复用 meta PUT 流程）
  app.post('/api/docs/move', async (request, reply) => {
    const { slug, fromSectionId, fromGroupId, toSectionId, toGroupId } = request.body as {
      slug: string
      fromSectionId?: string
      fromGroupId?: string
      toSectionId?: string
      toGroupId?: string
    }
    if (!slug) {
      return reply.code(400).send({ error: '缺少 slug' })
    }

    try {
      // 先在所有组移除该 slug，再追加到目标组（movePageInMeta 内部调用 getMeta）
      const { meta, found } = movePageInMeta(slug, toSectionId, toGroupId)
      const result = await saveMetaViaDraft(dumpMeta(meta))
      return { ...result, appended: found }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // 从 OpenAPI 全量生成：dynamic import gen-openapi 的 main()
  // sandbox 下 spawn/exec 找不到 shell，改在进程内直接调用生成器函数
  app.post('/api/docs/gen-openapi', async (request, reply) => {
    try {
      // gen-openapi 用 DOCS_ROOT 定位根，内部拼 ROOT/content-repo/...，所以 ROOT = CONTENT_REPO_PATH（=doc 根）
      process.env.DOCS_ROOT = CONTENT_REPO_PATH
      // dynamic import site 的生成器（tsx 运行时支持 .ts import）
      const genPath = path.resolve(SITE_DIR, 'scripts', 'gen-openapi.ts')
      const mod = await import(`file://${genPath}`)
      mod.main()
      return { generated: true, docs: listDocs() }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: '生成失败：' + e.message })
    }
  })
}
