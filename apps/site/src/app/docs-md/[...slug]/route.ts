import { NextResponse } from 'next/server'
import { allDocs } from 'contentlayer2/generated'
import { mdxToMarkdown } from '@/lib/mdx-to-md'

// GET /docs/:slug.md → 纯 Markdown（external 受众，过滤 InternalOnly）
export function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  // 同步取 slug（Next 16 route handler 的 params 是 Promise，但这里用 .then 兜底）
  return params.then((p) => {
    const slug = p.slug.join('/')
    const doc = allDocs.find((d) => d.slug === slug)

    if (!doc) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    // external 受众：过滤 InternalOnly 块
    const markdown = mdxToMarkdown(doc.body.raw, 'external')
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    })
  })
}
