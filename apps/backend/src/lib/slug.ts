// slug → content 文件路径解析
// 规则：先试 <slug>.mdx，再试 <slug>/index.mdx
// 如 'api/chat-completions' → content-repo/content/api/chat-completions.mdx
//    'quickstart' → content-repo/content/quickstart/index.mdx

import path from 'path'
import fs from 'fs'
import { CONTENT_REPO_PATH } from '../config.js'

const CONTENT_DIR = path.join(CONTENT_REPO_PATH, 'content-repo', 'content')

export function slugToFilePath(slug: string): string {
  // 先试 <slug>.mdx
  const direct = path.join(CONTENT_DIR, `${slug}.mdx`)
  if (fs.existsSync(direct)) return direct
  // 再试 <slug>/index.mdx
  const index = path.join(CONTENT_DIR, slug, 'index.mdx')
  if (fs.existsSync(index)) return index
  throw new Error(`文档不存在：slug=${slug}（试过 ${slug}.mdx 和 ${slug}/index.mdx）`)
}

// 相对于仓库根的路径（用于 git add / git log）
export function slugToGitPath(slug: string): string {
  const abs = slugToFilePath(slug)
  return path.relative(CONTENT_REPO_PATH, abs)
}
