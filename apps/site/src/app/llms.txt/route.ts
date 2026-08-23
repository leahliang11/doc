import { NextResponse } from 'next/server'
import { allDocs } from 'contentlayer2/generated'

// GET /llms.txt → 全站文档索引（供 Agent 导航）
// 格式符合 llmstxt.org：标题 + 描述 + 按分类分组的链接列表
// 只含已发布 + 公开 + 允许 AI 读取的文档
const categoryLabels: Record<string, string> = {
  quickstart: '快速开始',
  api: 'API 参考',
  models: '模型说明',
  guides: '场景指南',
  troubleshooting: '排障',
}
const categoryOrder = ['quickstart', 'api', 'models', 'guides', 'troubleshooting']

export function GET() {
  // 过滤：已发布 + 公开（audience !== 'internal'）+ ai_readable
  const docs = allDocs.filter(
    (d) =>
      d.status === 'published' &&
      d.audience !== 'internal' &&
      d.ai_readable !== false,
  )

  // 按分类分组
  const grouped: Record<string, typeof docs> = {}
  for (const doc of docs) {
    if (!grouped[doc.category]) grouped[doc.category] = []
    grouped[doc.category].push(doc)
  }

  // 按 categoryOrder 排序
  const categories = Object.keys(grouped).sort((a, b) => {
    const ia = categoryOrder.indexOf(a)
    const ib = categoryOrder.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  const lines: string[] = [
    '# JoyMaaS 文档',
    '',
    '> JoyMaaS 模型即服务平台官方文档。每篇文档可通过 URL 加 `.md` 获取纯 Markdown 版本。',
    '',
  ]

  for (const category of categories) {
    lines.push(`## ${categoryLabels[category] || category}`)
    lines.push('')
    for (const doc of grouped[category]) {
      // url 形如 /docs/quickstart，.md 版本即 url + .md
      lines.push(`- [${doc.title}](${doc.url}.md): ${doc.description}`)
    }
    lines.push('')
  }

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
