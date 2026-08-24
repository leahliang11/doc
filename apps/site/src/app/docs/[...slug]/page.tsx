import { allDocs } from 'contentlayer2/generated'
import { notFound } from 'next/navigation'
import { MdxRenderer } from '@/components/MdxRenderer'
import { CopyAsMarkdown } from '@/components/CopyAsMarkdown'
import { DocumentToc } from '@/components/DocumentToc'
import { EndpointBar } from '@/components/EndpointBar'
import { CalendarDays, Clock3 } from 'lucide-react'

function extractEndpoint(raw: string) {
  const match = raw.match(/```\s*\n(GET|POST|PUT|PATCH|DELETE)\s+([^\n]+)\n```/i)
  return match ? { method: match[1].toUpperCase(), path: match[2].trim() } : null
}

// 预生成所有文档的静态参数
export function generateStaticParams() {
  return allDocs.map((doc) => ({
    slug: (doc.slug ?? '').split('/'),
  }))
}

// 生成元数据
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug: slugParts } = await params
  const slug = slugParts.join('/')
  const doc = allDocs.find((d) => d.slug === slug)
  if (!doc) return {}
  return {
    title: doc.title,
    description: doc.description,
  }
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug: slugParts } = await params
  const slug = slugParts.join('/')
  const doc = allDocs.find((d) => d.slug === slug)

  if (!doc) {
    notFound()
  }

  const isApi = doc.category === 'api'
  const endpoint = isApi ? extractEndpoint(doc.body.raw) : null

  return (
    <div className={isApi ? 'api-page-shell' : 'doc-page-shell'}>
      <article className={isApi ? 'api-document' : 'doc-document'}>
        <header className="doc-header">
          <div className="doc-breadcrumb">
            <span>{isApi ? 'API 参考' : '开发者指南'}</span>
            <span aria-hidden="true">/</span>
            <span>{doc.title}</span>
          </div>
          <div className="doc-title-row">
            <div className="min-w-0">
              <h1>{doc.title}</h1>
              <p>{doc.description}</p>
            </div>
            <CopyAsMarkdown slug={doc.slug ?? slug} />
          </div>
          <div className="doc-meta">
            <span><Clock3 className="h-3.5 w-3.5" />约 5 分钟</span>
            {doc.updated && (
              <span><CalendarDays className="h-3.5 w-3.5" />最后更新 {doc.updated.slice(0, 10)}</span>
            )}
          </div>
          {endpoint && <EndpointBar method={endpoint.method} path={endpoint.path} />}
        </header>

        <div className={`prose-doc max-w-none ${isApi ? 'api-doc-body' : ''}`}>
          <MdxRenderer code={doc.body.code} />
        </div>
      </article>

      {isApi ? (
        <aside className="api-example-rail" aria-label="调用示例" />
      ) : (
        <DocumentToc />
      )}
    </div>
  )
}
