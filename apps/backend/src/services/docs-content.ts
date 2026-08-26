// docs-content.ts — 读 content-repo 所有 MDX，拼成供 Ask JoyMaaS 用的纯文本上下文
// 策略：
//   1. 只取 status=published + audience!=internal + ai_readable!=false 的文档（external 受众）
//   2. 简单去除 MDX 组件标签（保留组件内文字），保留 frontmatter 元信息
//   3. 每次调用都重新读文件（内容少，热更新，无需缓存）
//   internal 版：所有已发布文档，含 InternalOnly 内容
import fs from 'fs'
import path from 'path'
import { CONTENT_REPO_PATH } from '../config.js'
import { parseFrontmatter } from '../lib/frontmatter.js'

const CONTENT_DIR = path.join(CONTENT_REPO_PATH, 'content-repo', 'content')

const CATEGORY_LABELS: Record<string, string> = {
  quickstart: '快速开始',
  api: 'API 参考',
  models: '模型说明',
  guides: '场景指南',
  troubleshooting: '排障',
}

/**
 * 简单 MDX→纯文本：去掉组件开闭标签但保留 children 文本
 * 不引 unified/remark，避免平台原生模块问题
 */
function mdxToPlainText(body: string, audience: 'external' | 'internal' = 'external'): string {
  let text = body

  // InternalOnly：external 视角整块去掉（单行或多行自闭合/闭合形式）
  if (audience === 'external') {
    // 多行 <InternalOnly ...>...</InternalOnly>
    text = text.replace(/<InternalOnly[\s\S]*?<\/InternalOnly>/gm, '')
    // 自闭合 <InternalOnly ... />
    text = text.replace(/<InternalOnly[^>]*\/>/g, '')
  }

  // 去掉其他组件的开闭标签，保留内容
  // 先去自闭合标签（<X ... />）—— 只去标签不去内容（自闭合无 children）
  text = text.replace(/<[A-Z][A-Za-z]*[^>]*\/>/g, '')
  // 去普通开标签 <X ...>
  text = text.replace(/<[A-Z][A-Za-z]*(?:\s[^>]*)?>(?!\s*\n\s*<)/g, '')
  // 去闭标签 </X>
  text = text.replace(/<\/[A-Z][A-Za-z]*>/g, '')

  // 去掉 MDX 注释
  text = text.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  // 多空行压缩
  text = text.replace(/\n{3,}/g, '\n\n').trim()
  return text
}

interface DocContext {
  slug: string
  title: string
  category: string
  description: string
  text: string
}

/**
 * 读取所有符合受众条件的文档，返回结构化列表
 */
export function loadDocsContext(audience: 'external' | 'internal' = 'external'): DocContext[] {
  if (!fs.existsSync(CONTENT_DIR)) return []

  const docs: DocContext[] = []

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        walk(full)
      } else if (e.isFile() && e.name.endsWith('.mdx')) {
        const raw = fs.readFileSync(full, 'utf-8')
        const { frontmatter, body } = parseFrontmatter(raw)

        // 过滤：只取已发布
        if (frontmatter.status !== 'published') continue
        // external 视角过滤内部文档
        if (audience === 'external' && frontmatter.audience === 'internal') continue
        // ai_readable=false 的跳过
        if (frontmatter.ai_readable === false) continue

        const relPath = path.relative(CONTENT_DIR, full).replace(/\.mdx$/, '')
        const slug = relPath.replace(/\/index$/, '')

        docs.push({
          slug,
          title: (frontmatter.title as string) || slug,
          category: (frontmatter.category as string) || '',
          description: (frontmatter.description as string) || '',
          text: mdxToPlainText(body, audience),
        })
      }
    }
  }
  walk(CONTENT_DIR)
  return docs
}

/**
 * 拼完整上下文字符串（供塞入 system prompt）
 */
export function buildDocsSystemContext(audience: 'external' | 'internal' = 'external'): string {
  const docs = loadDocsContext(audience)
  if (docs.length === 0) return '（暂无已发布文档）'

  const lines: string[] = [
    '# JoyMaaS 文档（全部内容）',
    '',
    '以下是 JoyMaaS 模型即服务平台的完整文档，按分类整理：',
    '',
  ]

  // 按分类分组
  const grouped: Record<string, typeof docs> = {}
  for (const doc of docs) {
    if (!grouped[doc.category]) grouped[doc.category] = []
    grouped[doc.category].push(doc)
  }

  const catOrder = ['quickstart', 'api', 'models', 'guides', 'troubleshooting']
  const sortedCats = Object.keys(grouped).sort((a, b) => {
    const ia = catOrder.indexOf(a)
    const ib = catOrder.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  for (const cat of sortedCats) {
    lines.push(`## ${CATEGORY_LABELS[cat] || cat}`)
    lines.push('')
    for (const doc of grouped[cat]) {
      lines.push(`### ${doc.title}`)
      if (doc.description) lines.push(`> ${doc.description}`)
      lines.push('')
      lines.push(doc.text)
      lines.push('')
    }
  }

  return lines.join('\n')
}
