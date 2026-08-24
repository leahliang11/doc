import { LockKeyhole, ChevronRight } from 'lucide-react'

interface InternalOnlyProps {
  children: React.ReactNode
  /** 是否可收起，默认 true（收起态） */
  collapsible?: boolean
  title?: string
}

function InternalOnly({ children, collapsible = true, title }: InternalOnlyProps) {
  // Week 1：始终显示（模拟内部视角）
  // Week 8：根据 ViewToggle 上下文决定，外部视角返回 null
  const label = title ?? '内部内容'

  if (collapsible) {
    return (
      <details className="group my-4 overflow-hidden rounded-lg border border-dashed border-border bg-slate-50/55 dark:bg-white/[0.02]">
        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wide text-muted-foreground">INTERNAL</span>
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
    <aside className="my-4 rounded-lg border border-dashed border-border bg-slate-50/55 px-3 py-2.5 dark:bg-white/[0.02]">
      <div className="mb-1.5 flex items-center gap-2">
        <LockKeyhole className="h-3.5 w-3.5 text-muted-foreground" />
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
