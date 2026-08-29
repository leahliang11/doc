// 文档层级配置：读写 content-repo/content/_meta.yaml
// GET /api/meta  → 读 _meta.yaml 返回 JSON
// PUT /api/meta  → 接收整棵层级树，保存 + 走 draft 分支 commit + push + 建 MR
//
// 同时导出 getMeta / updateMetaPages，供 docs.ts 的 create 复用。
import type { FastifyInstance } from 'fastify'
import path from 'path'
import fs from 'fs'
import { load as yamlLoad, dump as yamlDump } from 'js-yaml'
import * as git from '../services/git.js'
import * as gitlab from '../services/gitlab.js'
import { CONTENT_REPO_PATH } from '../config.js'

const META_PATH = path.join(CONTENT_REPO_PATH, 'content-repo', 'content', '_meta.yaml')

interface MetaGroup {
  id: string
  pages?: string[]
  [key: string]: unknown
}

interface MetaSection {
  id: string
  groups?: MetaGroup[]
  [key: string]: unknown
}

interface MetaDocument {
  sections: MetaSection[]
}

// 读取层级树（结构：{ sections: [{ id, label, icon, order, groups: [{id, label, order, pages}] }] }）
export function getMeta(): MetaDocument {
  if (!fs.existsSync(META_PATH)) return { sections: [] }
  const raw = fs.readFileSync(META_PATH, 'utf-8')
  const parsed = yamlLoad(raw)
  if (!parsed || typeof parsed !== 'object' || !('sections' in parsed)) return { sections: [] }
  const sections = (parsed as { sections?: unknown }).sections
  return { ...(parsed as object), sections: Array.isArray(sections) ? sections as MetaSection[] : [] }
}

function appendPage(meta: MetaDocument, slug: string, sectionId?: string, groupId?: string) {
  let found = false
  for (const section of meta.sections) {
    if (section.id !== sectionId || !Array.isArray(section.groups)) continue
    for (const group of section.groups) {
      if (group.id !== groupId) continue
      if (!Array.isArray(group.pages)) group.pages = []
      if (!group.pages.includes(slug)) group.pages.push(slug)
      found = true
      break
    }
    if (found) break
  }
  return found
}

// 把新 slug 追加到指定 section/group 的 pages，并返回是否真的找到了该组
export function appendPageToMeta(slug: string, sectionId?: string, groupId?: string) {
  const meta = getMeta()
  const found = appendPage(meta, slug, sectionId, groupId)
  return { meta, found }
}

// 移动文档：先在所有 groups 中移除该 slug，再追加到目标 section/group
export function movePageInMeta(slug: string, toSectionId?: string, toGroupId?: string) {
  const meta = getMeta()
  for (const section of meta.sections) {
    if (!Array.isArray(section.groups)) continue
    for (const group of section.groups) {
      if (Array.isArray(group.pages)) {
        group.pages = group.pages.filter((page) => page !== slug)
      }
    }
  }
  const found = appendPage(meta, slug, toSectionId, toGroupId)
  return { meta, found }
}

// 从所有分组移除文档，供删除文档时同步清理导航。
export function removePageFromMeta(slug: string) {
  const meta = getMeta()
  let removed = false
  for (const section of meta.sections) {
    if (!Array.isArray(section.groups)) continue
    for (const group of section.groups) {
      if (!Array.isArray(group.pages)) continue
      const next = group.pages.filter((page) => page !== slug)
      if (next.length !== group.pages.length) removed = true
      group.pages = next
    }
  }
  return { meta, removed }
}

// 把 group 格式化成 yaml 字符串
export function dumpMeta(meta: unknown) {
  return yamlDump(meta, { indent: 2 })
}

// 走 draft 分支保存 yaml 文本并建 MR
export async function saveMetaViaDraft(yamlText: string) {
  const { commitHash, branch } = await git.writeAnyFileToDraft(
    META_PATH,
    'content-repo/content/_meta.yaml',
    yamlText,
    'docs-meta: update navigation hierarchy',
    'leah',
    'liangyuanwen.1@jd.com',
  )
  const mr = await gitlab.createMR(branch, 'docs-meta: 更新文档层级结构（by leah）')
  return { commit_hash: commitHash, branch, mr_iid: mr.iid, mr_url: mr.webUrl }
}

export async function metaRoutes(app: FastifyInstance): Promise<void> {
  // 获取当前层级树
  app.get('/api/meta', async () => getMeta())

  // 保存层级树（整体覆盖）：走 draft 分支 + MR
  app.put('/api/meta', async (request, reply) => {
    const body = request.body as { sections?: unknown[] }
    if (!Array.isArray(body?.sections)) {
      return reply.code(400).send({ error: '缺少 sections 数组' })
    }
    try {
      const result = await saveMetaViaDraft(dumpMeta({ sections: body.sections }))
      return result
    } catch (e: unknown) {
      request.log.error(e)
      return reply.code(500).send({ error: e instanceof Error ? e.message : String(e) })
    }
  })
}
