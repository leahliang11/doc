import Link from 'next/link'
import { allDocs } from 'contentlayer2/generated'
import { ArrowRight } from 'lucide-react'

export default function HomePage() {
  const quickstart = allDocs.find((d) => d.slug === 'quickstart')
  const apiDoc = allDocs.find((d) => d.slug === 'api/chat-completions')
  const errorsDoc = allDocs.find((d) => d.slug === 'troubleshooting/errors')

  const cards = [
    { doc: quickstart, label: '快速开始', desc: '5 分钟跑通第一次调用' },
    { doc: apiDoc, label: 'API 参考', desc: 'Chat Completions 接口文档' },
    { doc: errorsDoc, label: '排障', desc: '常见错误码和排查方法' },
  ].filter((c) => c.doc)

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="mb-4 text-5xl text-foreground">JoyMaaS 文档</h1>
      <p className="mb-8 text-xl text-muted-foreground">
        模型即服务平台 · 帮助你和你的 AI 快速接入
      </p>
      {quickstart && (
        <Link
          href={quickstart.url}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-primary-foreground hover:opacity-90 transition-opacity"
        >
          快速开始
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
      <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
        {cards.map(({ doc, label, desc }) => (
          <Link
            key={doc!.slug}
            href={doc!.url}
            className="rounded-md border border-border bg-card p-6 transition-colors hover:border-neutral-400 dark:hover:border-neutral-500"
          >
            <h2 className="mb-1 text-xl text-foreground">{label}</h2>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
