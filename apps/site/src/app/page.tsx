import Link from 'next/link'
import { allDocs } from 'contentlayer2/generated'
import { ArrowRight, BookOpen, Braces, CircleHelp, Sparkles, Play, MessageCircle, Copy } from 'lucide-react'

export default function HomePage() {
  const quickstart = allDocs.find((d) => d.slug === 'quickstart')
  const apiDoc = allDocs.find((d) => d.slug === 'api/chat-completions')
  const errorsDoc = allDocs.find((d) => d.slug === 'troubleshooting/errors')

  const cards = [
    { doc: quickstart, label: '快速开始', desc: '从 API Key 到第一次模型调用，5 分钟完整跑通。', icon: Sparkles },
    { doc: apiDoc, label: 'API 参考', desc: '查看请求参数、响应结构和可直接运行的调用示例。', icon: Braces },
    { doc: errorsDoc, label: '问题排查', desc: '快速定位常见错误码、权限与网络问题。', icon: CircleHelp },
  ].filter((c) => c.doc)

  const features = [
    {
      icon: Play,
      title: '读到即可试',
      desc: 'API 参考页内嵌 Playground，填参数点运行，不离开文档就能跑通调用。',
    },
    {
      icon: MessageCircle,
      title: '问即可答',
      desc: '右下角 Ask JoyMaaS，文档助手基于全部文档实时回答，卡住不用找人。',
    },
    {
      icon: Copy,
      title: '复制即可接',
      desc: '每篇文档一键「Copy as Markdown」，直接喂给你的 AI 助手，零转换成本。',
    },
  ]

  return (
    <main className="relative isolate overflow-hidden bg-background">
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 text-center sm:pt-32">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand">
          <BookOpen className="h-3.5 w-3.5" />
          JoyMaaS 开发者中心
        </span>
        <h1 className="mx-auto mt-7 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-heading sm:text-6xl">
          从一个请求开始，<br className="hidden sm:block" />把模型能力接入你的产品
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          清晰的接入指南、完整的 API 参考与可直接运行的示例，帮助你更快完成开发与上线。
        </p>
        {quickstart && (
          <div className="mt-9 flex justify-center gap-3">
            <Link
              href={quickstart.url}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white shadow-sm shadow-violet-500/20 transition-all hover:-translate-y-0.5 hover:bg-brand/90"
            >
              开始接入
              <ArrowRight className="h-4 w-4" />
            </Link>
            {apiDoc && (
              <Link
                href={apiDoc.url}
                className="inline-flex h-11 items-center rounded-lg border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:border-primary/25 hover:bg-primary/5"
              >
                浏览 API
              </Link>
            )}
          </div>
        )}

        {/* 文档导航卡片 */}
        <div className="mt-20 grid grid-cols-1 gap-4 text-left md:grid-cols-3">
          {cards.map(({ doc, label, desc, icon: Icon }) => (
            <Link
              key={doc!.slug}
              href={doc!.url}
              className="group rounded-2xl border border-border-soft bg-card p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_14px_40px_rgba(79,70,229,0.08)]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <h2 className="mt-5 text-base font-semibold text-heading">{label}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                查看文档
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>

        {/* 三件套差异化功能展示 */}
        <div className="mt-20">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            为 AI 时代的开发者体验而设计
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 text-left md:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 rounded-xl border border-border/60 bg-canvas p-5">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-heading">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
