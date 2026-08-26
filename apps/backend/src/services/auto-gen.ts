// auto-gen.ts — 文档缺口自动生成草稿
// 流程：doc_gap → AI 生 MDX 草稿 → git 建分支 → push → 建 MR → 更新 doc_gaps 状态
import fs from 'fs'
import path from 'path'
import simpleGit from 'simple-git'
import { chat } from './joybuilder.js'
import { createMR } from './gitlab.js'
import { db, updateGapStatus, createReviewTaskWithKind, listPendingGaps } from './db.js'
import { CONTENT_REPO_PATH, JOYBUILDER_MODEL } from '../config.js'

const CONTENT_DIR = path.join(CONTENT_REPO_PATH, 'content-repo', 'content')
const git = simpleGit({ baseDir: CONTENT_REPO_PATH })

// 生成草稿 MDX
async function generateDraftMdx(query: string, queryCount: number): Promise<{
  slug: string
  mdx: string
}> {
  const today = new Date().toISOString().slice(0, 10)

  const prompt = `用户在文档站反复搜索了「${query}」（${queryCount} 次），但没有找到相关文档。
请为 JoyMaaS 文档站生成一篇对应的 MDX 文档草稿。

要求：
1. frontmatter 包含 title、description、slug（英文小写连字符）、category（quickstart/api/models/guides/troubleshooting 选一）、status: draft、updated: ${today}
2. 文档结构：概述段落 → 主要内容（可用 Steps/Callout/Params 组件）→ 相关链接
3. 内容基于 JoyMaaS 是模型即服务平台（API 调用、模型选型、鉴权、限流等）的背景来写
4. 只返回 MDX 内容（从 --- 开始），不加任何解释

示例格式：
---
title: XXX
description: 一句话描述
slug: xxx-yyy
category: guides
status: draft
updated: ${today}
---

## 概述
...`

  const result = await chat(
    [
      { role: 'system', content: '你是 JoyMaaS 技术文档作者。只输出 MDX 文档内容。' },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.4 },
  )

  // 从生成结果提取 slug
  const slugMatch = result.match(/^slug:\s*(.+)$/m)
  const slug = slugMatch
    ? `guides/${slugMatch[1].trim().replace(/[^a-z0-9-]/g, '-')}`
    : `guides/auto-${Date.now()}`

  return { slug, mdx: result.trim() }
}

// 推送分支 + 建 MR（一次最多处理 3 个 gap，避免卡住）
export async function runAutoGenJob(maxGaps = 3): Promise<{
  generated: number
  errors: string[]
}> {
  const pendingGaps = listPendingGaps(3).slice(0, maxGaps)
  if (pendingGaps.length === 0) return { generated: 0, errors: [] }

  const errors: string[] = []
  let generated = 0

  for (const gap of pendingGaps) {
    try {
      // 标记为生成中，防止重复触发
      updateGapStatus(gap.id, 'drafting')

      // AI 生草稿
      const { slug, mdx } = await generateDraftMdx(gap.representative_query, gap.query_count)

      // 建分支
      const branchDate = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const branch = `auto/gen-${branchDate}-${gap.cluster_hash}`

      await git.fetch()
      await git.checkout('main')
      await git.pull('origin', 'main')
      await git.checkoutLocalBranch(branch)

      // 写文件
      const fileName = slug.split('/').pop() + '.mdx'
      const dirPath = path.join(CONTENT_DIR, 'guides')
      fs.mkdirSync(dirPath, { recursive: true })
      const filePath = path.join(dirPath, fileName)
      fs.writeFileSync(filePath, mdx, 'utf-8')

      // commit
      await git.add(filePath)
      await git.commit(
        `docs: auto-generate draft for "${gap.representative_query}"\n\n触发信号：${gap.query_count} 次用户搜索「${gap.representative_query}」未命中文档\n生成工具：JoyMaaS 智能运营层 W16`,
        { '--author': 'JoyMaaS Bot <bot@joymaas.com>' },
      )

      // push
      await git.push('origin', branch, ['--set-upstream'])

      // 建 MR
      const mr = await createMR(
        branch,
        `[自动生成] ${gap.representative_query} - 文档草稿`,
      )

      // 写 review_tasks
      createReviewTaskWithKind({
        source: 'auto',
        sourceKind: 'auto',
        slug: slug,
        branch,
        mrIid: mr.iid,
        submitter: 'joymaas-bot',
      })

      // 更新 doc_gaps
      updateGapStatus(gap.id, 'mr-created', mr.iid, slug)
      generated++

      // 回到 main
      await git.checkout('main')
    } catch (e: any) {
      errors.push(`gap #${gap.id} (${gap.representative_query}): ${e.message}`)
      // 失败回退状态
      updateGapStatus(gap.id, 'pending')
      try { await git.checkout('main') } catch { /* ignore */ }
    }
  }

  return { generated, errors }
}
