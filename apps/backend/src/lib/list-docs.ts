// 列出所有文档：扫 content-repo/content 目录，解析 frontmatter
import fs from 'fs'
import path from 'path'
import { CONTENT_REPO_PATH } from '../config.js'
import { parseFrontmatter } from './frontmatter.js'

const CONTENT_DIR = path.join(CONTENT_REPO_PATH, 'content-repo', 'content')

export interface DocListItem {
  slug: string
  title: string
  category: string
  status: string
  updated: string
}

export function listDocs(): DocListItem[] {
  const items: DocListItem[] = []
  if (!fs.existsSync(CONTENT_DIR)) return items

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        walk(full)
      } else if (e.isFile() && e.name.endsWith('.mdx')) {
        const relPath = path.relative(CONTENT_DIR, full).replace(/\.mdx$/, '')
        // slug：quickstart/index → quickstart；api/chat-completions → api/chat-completions
        const slug = relPath.replace(/\/index$/, '')
        const raw = fs.readFileSync(full, 'utf-8')
        const { frontmatter } = parseFrontmatter(raw)
        items.push({
          slug,
          title: (frontmatter.title as string) || slug,
          category: (frontmatter.category as string) || '',
          status: (frontmatter.status as string) || 'draft',
          updated: (frontmatter.updated as string) || '',
        })
      }
    }
  }
  walk(CONTENT_DIR)
  return items
}
