import Link from 'next/link'
import { allDocs } from 'contentlayer2/generated'
import { BookOpen, ExternalLink } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { AudienceToggle } from './AudienceToggle'
import { DocSearch } from './DocSearch'

export function Navbar() {
  const internalViewEnabled = process.env.NEXT_PUBLIC_ENABLE_INTERNAL_VIEW === 'true'
  const searchItems = allDocs.map((doc) => ({
    title: doc.title,
    description: doc.description,
    url: doc.url,
    category: doc.category,
  }))

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-[1500px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 md:grid-cols-[minmax(210px,240px)_minmax(260px,1fr)_auto] md:gap-6 md:px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="JoyMaaS 文档首页">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white shadow-sm shadow-violet-500/20">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-foreground">JoyMaaS</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">开发者文档</span>
        </Link>

        <div className="hidden md:block">
          <DocSearch items={searchItems} />
        </div>

        <nav className="flex items-center justify-end gap-1">
          <Link href="/docs/quickstart" className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex">
            指南
          </Link>
          <Link href="/docs/api/chat-completions" className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex">
            API 参考
          </Link>
          <a
            href="https://modelservice.jdcloud.com"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand-soft lg:inline-flex"
          >
            控制台
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <ThemeToggle />
          {internalViewEnabled && <AudienceToggle />}
        </nav>
      </div>
    </header>
  )
}
