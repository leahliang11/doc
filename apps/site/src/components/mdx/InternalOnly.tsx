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
      <details className="group my-5 overflow-hidden rounded-xl border border-amber-200 border-l-2 border-l-amber-500 bg-amber-50/50 dark:border-amber-900 dark:border-l-amber-500 dark:bg-amber-950/25">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-4 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-amber-100 dark:bg-amber-900">
            <LockKeyhole className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
          </span>
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 dark:bg-amber-900 dark:text-amber-200">INTERNAL</span>
          <span className="text-xs font-medium text-foreground">{label}</span>
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <div className="border-t border-amber-200 bg-background/75 px-4 py-3.5 text-sm leading-6 text-muted-foreground dark:border-amber-900 [&>p]:my-0 [&>p+p]:mt-2">
          {children}
        </div>
      </details>
    )
  }

  return (
    <aside className="my-5 rounded-xl border border-amber-200 border-l-2 border-l-amber-500 bg-amber-50/50 px-4 py-3.5 dark:border-amber-900 dark:bg-amber-950/25">
      <div className="mb-2 flex items-center gap-2">
        <LockKeyhole className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
        <span className="text-xs font-semibold text-foreground">{label}</span>
      </div>
      <div className="text-sm leading-6 text-muted-foreground [&>p]:my-0 [&>p+p]:mt-2">
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
