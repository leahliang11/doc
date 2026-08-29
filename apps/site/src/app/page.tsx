import Link from 'next/link'
import { allDocs } from 'contentlayer2/generated'
import {
  ArrowRight,
  BookOpen,
  Braces,
  CircleHelp,
  Copy,
  MessageCircle,
  Play,
  Sparkles,
} from 'lucide-react'

export default function HomePage() {
  const quickstart = allDocs.find((doc) => doc.slug === 'quickstart')
  const apiDoc = allDocs.find((doc) => doc.slug === 'api/chat-completions')
  const errorsDoc = allDocs.find((doc) => doc.slug === 'troubleshooting/errors')

  const paths = [
    { doc: quickstart, index: '01', label: '快速开始', desc: '5 分钟完成第一次模型调用', icon: Sparkles },
    { doc: apiDoc, index: '02', label: 'API 参考', desc: '参数、响应与可运行示例', icon: Braces },
    { doc: errorsDoc, index: '03', label: '问题排查', desc: '错误码、权限与网络诊断', icon: CircleHelp },
  ].filter((item) => item.doc)

  const capabilities = [
    {
      icon: Play,
      title: '读到即可试',
      desc: '在 API 页面直接填写参数并运行请求。',
      tone: 'bg-brand-soft text-brand',
    },
    {
      icon: MessageCircle,
      title: '问即可答',
      desc: '文档助手基于当前知识库回答问题。',
      tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
    },
    {
      icon: Copy,
      title: '复制即可接',
      desc: '一键导出 Markdown，交给开发工具继续使用。',
      tone: 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
    },
  ]

  return (
    <main className="bg-background">
      <section className="mx-auto max-w-6xl px-6 py-14 sm:py-18">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)] lg:gap-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand-soft px-3 py-1.5 text-[11px] font-semibold text-brand">
              <BookOpen className="h-3.5 w-3.5" />
              JoyMaaS 开发者中心
            </span>
            <h1 className="mt-6 max-w-2xl text-[42px] font-semibold leading-[1.1] tracking-[-0.045em] text-heading sm:text-[52px]">
              更快找到答案，<br />更稳完成模型接入
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground">
              从接入指南到 API 调试与问题排查，把开发过程中真正需要的信息集中在一个工作界面里。
            </p>
            {quickstart && (
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={quickstart.url}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand/90"
                >
                  开始接入
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                {apiDoc && (
                  <Link
                    href={apiDoc.url}
                    className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:border-brand/25 hover:bg-brand-soft/50"
                  >
                    浏览 API
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_8px_30px_rgba(15,23,42,.045)]">
            <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <span className="text-[12px] font-semibold text-heading">推荐路径</span>
              <span className="font-mono text-[10px] text-subtle-foreground">START HERE</span>
            </div>
            <div className="divide-y divide-border-soft">
              {paths.map(({ doc, index, label, desc, icon: Icon }) => (
                <Link
                  key={doc!.slug}
                  href={doc!.url}
                  className="group grid grid-cols-[30px_32px_minmax(0,1fr)_16px] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-brand-soft/45"
                >
                  <span className="font-mono text-[10px] font-semibold text-subtle-foreground">{index}</span>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-heading group-hover:text-brand">{label}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{desc}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 border-y border-border-soft">
          <div className="grid divide-y divide-border-soft md:grid-cols-3 md:divide-x md:divide-y-0">
            {capabilities.map(({ icon: Icon, title, desc, tone }) => (
              <div key={title} className="flex gap-3.5 px-1 py-5 md:px-5 first:md:pl-0 last:md:pr-0">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-[13px] font-semibold text-heading">{title}</h2>
                  <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
