import { NextResponse } from 'next/server'
import { allDocs } from 'contentlayer2/generated'
import { mdxToMarkdown } from '@/lib/mdx-to-md'

// GET /llms-full-internal.txt → 全站文档全文（internal 视角）
// 与 /llms-full.txt 的差异：
//   1. 含 audience === 'internal' 的文档
//   2. 用 mdxToMarkdown('internal') 保留 InternalOnly 块内容
// 用途：内部 AI 助手 / 售前 AI，基于权威文档（含内部内容）作答
// **注意**：本路由默认公开可访问，P1 不做 IP/token 白名单，靠 URL 隐蔽性保护
//         P2 内外双服务愿景成熟时再补权限层
const categoryLabels: Record<string, string> = {
  quickstart: '快速开始',
  api: 'API 参考',
  models: '模型说明',
  guides: '场景指南',
  troubleshooting: '排障',
}
const categoryOrder = ['quickstart', 'api', 'models', 'guides', 'troubleshooting']

export function GET() {
  // internal 视角：不过滤 audience=internal，ai_readable=false 仍然排除
  const docs = allDocs.filter(
    (d) => d.status === 'published' && d.ai_readable !== false,
  )

  const grouped: Record<string, typeof docs> = {}
  for (const doc of docs) {
    if (!grouped[doc.category]) grouped[doc.category] = []
    grouped[doc.category].push(doc)
  }
  const categories = Object.keys(grouped).sort((a, b) => {
    const ia = categoryOrder.indexOf(a)
    const ib = categoryOrder.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

  const lines: string[] = [
    '# JoyMaaS 文档（全文 · 内部视角）',
    '',
    '> JoyMaaS 内部权威事实源，含 InternalOnly 内容。',
    '> 面向内部 AI 助手、售前 / 销售 / 运营 / 客服 使用。',
    '> 索引版本：/llms.txt',
    '',
    '## 目录',
    '',
  ]

  for (const category of categories) {
    lines.push(`### ${categoryLabels[category] || category}`)
    lines.push('')
    for (const doc of grouped[category]) {
      const audienceMark = doc.audience === 'internal' ? ' 🔒' : ''
      lines.push(`- [${doc.title}](${base}${doc.url}.md)${audienceMark}: ${doc.description}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')

  for (const category of categories) {
    for (const doc of grouped[category]) {
      lines.push(`## ${doc.title}`)
      lines.push('')
      lines.push(`> Category: ${categoryLabels[category] || category}`)
      lines.push(`> URL: ${base}${doc.url}`)
      lines.push(`> Audience: ${doc.audience ?? 'both'}`)
      if (doc.description) lines.push(`> ${doc.description}`)
      lines.push('')
      // internal 视角：保留 InternalOnly 块内容
      const markdown = mdxToMarkdown(doc.body.raw, 'internal')
      lines.push(markdown.trim())
      lines.push('')
      lines.push('---')
      lines.push('')
    }
  }

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      // 阻断搜索引擎抓取（内部内容）
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
