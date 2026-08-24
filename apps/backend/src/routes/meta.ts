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

// 读取层级树（结构：{ sections: [{ id, label, icon, order, groups: [{id, label, order, pages}] }] }）
export function getMeta() {
  if (!fs.existsSync(META_PATH)) return { sections: [] }
  const raw = fs.readFileSync(META_PATH, 'utf-8')
  return yamlLoad(raw) ?? { sections: [] }
}

// 把新 slug 追加到指定 section/group 的 pages，并返回是否真的找到了该组
export function appendPageToMeta(slug: string, sectionId?: string, groupId?: string) {
  const meta = getMeta()
  let found = false
  if (Array.isArray(meta.sections)) {
    for (const s of meta.sections) {
      if (s.id !== sectionId) continue
      if (!Array.isArray(s.groups)) continue
      for (const g of s.groups) {
        if (g.id !== groupId) continue
        if (!Array.isArray(g.pages)) g.pages = []
        // 先查重，避免重复添加
        if (!g.pages.includes(slug)) g.pages.push(slug)
        found = true
        break
      }
      if (found) break
    }
  }
  return { meta, found }
}

// 移动文档：先在所有 groups 中移除该 slug，再追加到目标 section/group
export function movePageInMeta(slug: string, toSectionId?: string, toGroupId?: string) {
  const meta = getMeta()
  if (Array.isArray(meta.sections)) {
    for (const s of meta.sections) {
      if (!Array.isArray(s.groups)) continue
      for (const g of s.groups) {
        if (Array.isArray(g.pages)) {
          g.pages = g.pages.filter((p: string) => p !== slug)
        }
      }
    }
  }
  // 追加到目标组
  const res = appendPageToMeta(slug, toSectionId, toGroupId)
  return { meta: res.meta, found: res.found }
}

// 把 group 格式化成 yaml 字符串
export function dumpMeta(meta: unknown) {
  return yamlDump(meta, { indent: 2 })
}

// 把新 page 追加到 _meta.yaml 并直接提交到 main（供新建文档快速通道复用）
export async function appendPageAndCommitMain(slug: string, sectionId?: string, groupId?: string) {
  const { meta, found } = appendPageToMeta(slug, sectionId, groupId)
  if (!found) return { appended: false, found: false }
  const yamlText = dumpMeta(meta)
  const { commitHash } = await git.commitToMain(
    'meta',
    yamlText,
    'leah',
    'liangyuanwen.1@jd.com',
    META_PATH,
    'content-repo/content/_meta.yaml',
  )
  return { appended: true, found: true, commit_hash: commitHash }
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
    } catch (e: any) {
      request.log.error(e)
      return reply.code(500).send({ error: e.message })
    }
  })
}