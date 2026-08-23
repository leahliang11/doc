import { allDocs } from 'contentlayer2/generated'
import { notFound } from 'next/navigation'
import { MdxRenderer } from '@/components/MdxRenderer'
import { CopyAsMarkdown } from '@/components/CopyAsMarkdown'
import { Calendar, User } from 'lucide-react'

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

  return (
    <article className="max-w-3xl">
      <header className="mb-6">
        <h1 className="mb-2 text-3xl text-foreground">{doc.title}</h1>
        <p className="text-base text-muted-foreground">{doc.description}</p>
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          {doc.updated && (
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {doc.updated.slice(0, 10)}
            </span>
          )}
          {doc.owner && (
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {doc.owner}
            </span>
          )}
          <span className="ml-auto">
            <CopyAsMarkdown slug={doc.slug ?? slug} />
          </span>
        </div>
      </header>

      <div className="prose-doc max-w-none">
        <MdxRenderer code={doc.body.code} />
      </div>
    </article>
  )
}
