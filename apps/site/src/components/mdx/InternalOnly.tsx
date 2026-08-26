'use client'

import { LockKeyhole, ChevronRight } from 'lucide-react'
import { useAudience } from '@/providers/audience-provider'

interface InternalOnlyProps {
  children: React.ReactNode
  /** 是否可收起，默认 true（收起态） */
  collapsible?: boolean
  title?: string
}

function InternalOnly({ children, collapsible = true, title }: InternalOnlyProps) {
  const { audience, ready } = useAudience()
  const label = title ?? '内部内容'

  // SSR + 客户端首帧默认 external（audience 初值），此时不显示
  // 客户端 hydrate 后从 localStorage 恢复，若为 internal 则显示
  // ready 前显示为 null，避免 SSR/客户端渲染不一致的闪烁
  if (!ready || audience === 'external') {
    return null
  }

  if (collapsible) {
    return (
      <details className="group my-4 overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/35">
        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-300" />
          <span className="rounded border border-slate-300 bg-background/80 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wide text-slate-700 dark:border-slate-700 dark:text-slate-300">INTERNAL</span>
          <span className="text-xs font-medium text-foreground">{label}</span>
          <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <div className="border-t border-border bg-background/60 px-3 py-2.5 text-[13px] leading-[1.65] text-muted-foreground [&>p]:my-0 [&>p+p]:mt-1.5">
          {children}
        </div>
      </details>
    )
  }

  return (
    <aside className="my-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/35">
      <div className="mb-1.5 flex items-center gap-2">
        <LockKeyhole className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
        <span className="text-xs font-semibold text-foreground">{label}</span>
      </div>
      <div className="text-[13px] leading-[1.65] text-muted-foreground [&>p]:my-0 [&>p+p]:mt-1.5">
        {children}
      </div>
    </aside>
  )
}

// Week 2：external 受众 → 返回空字符串（整块过滤）；internal → 内容原文
export type { InternalOnlyProps }
type InternalOnlyWithToMarkdown = typeof InternalOnly & {
  toMarkdown: (props: InternalOnlyProps, audience: 'internal' | 'external') => string
}
const InternalOnlyExport = Object.assign(InternalOnly, {
  toMarkdown: (): string => {
    throw new Error('Not implemented - Week 2')
  },
}) as InternalOnlyWithToMarkdown

export { InternalOnlyExport as InternalOnly }
