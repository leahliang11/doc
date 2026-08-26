import { NextResponse } from 'next/server'
import { allDocs } from 'contentlayer2/generated'
import { mdxToMarkdown } from '@/lib/mdx-to-md'

// GET /llms-full.txt → 全站文档全文（external 视角，供 Agent RAG / 长上下文喂入）
// 与 /llms.txt 的差异：llms.txt 只是索引，llms-full.txt 是全部文档正文拼接
// 只含：已发布 + 公开（audience !== 'internal'）+ ai_readable
// InternalOnly 块通过 mdxToMarkdown('external') 过滤
const categoryLabels: Record<string, string> = {
  quickstart: '快速开始',
  api: 'API 参考',
  models: '模型说明',
  guides: '场景指南',
  troubleshooting: '排障',
}
const categoryOrder = ['quickstart', 'api', 'models', 'guides', 'troubleshooting']

export function GET() {
  const docs = allDocs.filter(
    (d) =>
      d.status === 'published' &&
      d.audience !== 'internal' &&
      d.ai_readable !== false,
  )

  // 按分类分组 + 排序
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
    '# JoyMaaS 文档（全文）',
    '',
    '> JoyMaaS 模型即服务平台官方文档全文合集。供 AI Agent 直接消费。',
    '> 索引版本：/llms.txt',
    '',
    '## 目录',
    '',
  ]

  for (const category of categories) {
    lines.push(`### ${categoryLabels[category] || category}`)
    lines.push('')
    for (const doc of grouped[category]) {
      lines.push(`- [${doc.title}](${base}${doc.url}.md): ${doc.description}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')

  // 逐篇追加全文
  for (const category of categories) {
    for (const doc of grouped[category]) {
      lines.push(`## ${doc.title}`)
      lines.push('')
      lines.push(`> Category: ${categoryLabels[category] || category}`)
      lines.push(`> URL: ${base}${doc.url}`)
      if (doc.description) lines.push(`> ${doc.description}`)
      lines.push('')
      // external 视角：InternalOnly 块被 mdxToMarkdown 过滤
      const markdown = mdxToMarkdown(doc.body.raw, 'external')
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
    },
  })
}
