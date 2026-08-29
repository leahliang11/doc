// 文档 API 路由：list / open / save / submit-review / create / delete / gen-openapi
import type { FastifyInstance } from 'fastify'
import path from 'path'
import fs from 'fs'
import * as git from '../services/git.js'
import * as gitlab from '../services/gitlab.js'
import { recordEditSession, createReviewTask } from '../services/db.js'
import { parseFrontmatter } from '../lib/frontmatter.js'
import { listDocs } from '../lib/list-docs.js'
import { CONTENT_REPO_PATH, SITE_DIR } from '../config.js'
import { appendPageToMeta, dumpMeta, saveMetaViaDraft, movePageInMeta, removePageFromMeta } from './meta.js'

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
    const { slug, markdown, base_commit, branch: existingBranch, user } = request.body as {
      slug: string
      markdown: string
      base_commit: string
      branch?: string
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
      if (existingBranch) await git.checkoutDraftBranch(existingBranch)
      else await git.createDraftBranch(slug)
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

  // 新建文档：文档与导航写入同一个 draft 分支，并立即创建 MR，禁止绕过审核写 main。
  app.post('/api/docs/create', async (request, reply) => {
    const { title, slug, template, content, sectionId, groupId, user } = request.body as {
      title: string
      slug: string
      template?: string
      content?: string   // AI 生成的完整 MDX（传了则直接用，不走模板）
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
      // content 优先；否则走模板
      const mdxContent = content?.trim() || getTemplateContent(template, title, slug)
      const files = [{ absoluteFilePath: abs, gitPath, content: mdxContent }]
      const metaRes = appendPageToMeta(slug, sectionId, groupId)
      if (metaRes.found) {
        files.push({
          absoluteFilePath: path.join(CONTENT_REPO_PATH, 'content-repo', 'content', '_meta.yaml'),
          gitPath: 'content-repo/content/_meta.yaml',
          content: dumpMeta(metaRes.meta),
        })
      }
      const { commitHash, branch } = await git.writeFilesToDraft(
        slug,
        files,
        `docs: create ${slug}`,
        user?.name || 'unknown',
        user?.email || 'unknown@example.com',
      )
      const mrTitle = `docs: ${slug} 新建文档待审核（by ${user?.name || 'unknown'}）`
      const { iid, webUrl } = await gitlab.createMR(branch, mrTitle)
      createReviewTask({ source: 'web', slug, branch, mrIid: iid, submitter: user?.name || 'unknown' })
      const parsed = parseFrontmatter(mdxContent)
      return {
        slug,
        commit_hash: commitHash,
        branch,
        mr_iid: iid,
        mr_url: webUrl,
        markdown: parsed.body,
        frontmatter: parsed.frontmatter,
        meta: { appended: metaRes.found },
      }
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

  // 删除文档：文档文件和导航引用一起进入 draft 分支，提交 MR 后才会影响线上。
  app.post('/api/docs/delete', async (request, reply) => {
    const { slug, user } = request.body as {
      slug: string
      user?: { name?: string; email?: string }
    }
    if (!slug) return reply.code(400).send({ error: '缺少 slug' })
    if (!isValidSlug(slug)) return reply.code(400).send({ error: 'slug 不合法' })

    try {
      // 先确认文档存在；git.readFile 同时复用现有的 slug 解析规则。
      git.readFile(slug)
      // slugToGitPath 能正确处理 <slug>.mdx 与 <slug>/index.mdx 两种布局。
      const docAbs = (() => {
        const direct = path.join(CONTENT_REPO_PATH, 'content-repo', 'content', `${slug}.mdx`)
        return fs.existsSync(direct) ? direct : path.join(CONTENT_REPO_PATH, 'content-repo', 'content', slug, 'index.mdx')
      })()
      const docGitPath = path.relative(CONTENT_REPO_PATH, docAbs)
      const { meta, removed } = removePageFromMeta(slug)
      const metaPath = path.join(CONTENT_REPO_PATH, 'content-repo', 'content', '_meta.yaml')
      const filesToWrite = removed
        ? [{ absoluteFilePath: metaPath, gitPath: 'content-repo/content/_meta.yaml', content: dumpMeta(meta) }]
        : []
      const result = await git.deleteFilesToDraft(
        [{ absoluteFilePath: docAbs, gitPath: docGitPath }],
        filesToWrite,
        `docs: delete ${slug}`,
        user?.name || 'unknown',
        user?.email || 'unknown@example.com',
      )
      const mr = await gitlab.createMR(result.branch, `docs: ${slug} 删除文档待审核（by ${user?.name || 'unknown'}）`)
      createReviewTask({ source: 'web', slug, branch: result.branch, mrIid: mr.iid, submitter: user?.name || 'unknown' })
      return { slug, commit_hash: result.commitHash, branch: result.branch, mr_iid: mr.iid, mr_url: mr.webUrl }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })

  // 从 OpenAPI 全量生成：dynamic import gen-openapi 的 main()
  // sandbox 下 spawn/exec 找不到 shell，改在进程内直接调用生成器函数
  // AI 一句话生成文档草稿（W17 新增）
  // 输入：一句描述（如"写一篇流式响应接入指南"）
  // 输出：完整 MDX 内容 + frontmatter 推断（title/slug/category/description）
  app.post('/api/docs/ai-draft', async (request, reply) => {
    const { description, categoryHint } = request.body as {
      description: string
      categoryHint?: string
    }
    if (!description?.trim()) {
      return reply.code(400).send({ error: '缺少 description' })
    }

    try {
      // 1. 用 AI 生成正文（复用 services/ai.ts 的 generate 函数）
      const { generate, genFrontmatter } = await import('../services/ai.js')
      const today = new Date().toISOString().slice(0, 10)

      const genPrompt = `
请为 JoyMaaS 文档站生成一篇完整的 MDX 文档正文（不含 frontmatter）。

文档主题：${description}
文档类别提示：${categoryHint ?? '场景指南'}
今天日期：${today}

要求：
- 正文直接从 ## 二级标题开始（不要写 # 一级标题）
- 结构清晰，包含概述段落 + 主体内容（可使用 Callout/Steps/CodeTabs/Params 组件）
- 代码示例使用中文注释，Python 或 curl 为主
- 如果是 API 类文档，包含 <Playground> 组件占位（如 <Playground endpoint="chat-completions" />）
- 末尾加 <NextSteps> 相关链接组件
- 只返回文档正文，不要 frontmatter
`.trim()

      const bodyContent = await generate(genPrompt)

      // 2. 根据正文推断 frontmatter
      const fm = await genFrontmatter(description + '\n\n' + bodyContent)

      // 3. 构造完整 MDX
      const safeCategory = fm.category ?? categoryHint ?? 'guides'
      const slugSuffix = fm.title
        ? fm.title.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-|-$/g, '').replace(/[一-龥]+/g, '')
        : `draft-${Date.now()}`
      const suggestedSlug = `${safeCategory}/${slugSuffix || `draft-${Date.now()}`}`

      const fullMdx = `---
title: ${fm.title || description.slice(0, 30)}
description: ${fm.description || description}
slug: ${suggestedSlug}
category: ${safeCategory}
status: draft
audience: external
ai_readable: true
updated: ${today}
source: manual
---

${bodyContent.trim()}
`

      return {
        title: fm.title || description.slice(0, 30),
        suggestedSlug,
        category: safeCategory,
        description: fm.description || description,
        tags: fm.tags || [],
        mdxContent: fullMdx,
      }
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: 'AI 生成失败：' + e.message })
    }
  })

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
