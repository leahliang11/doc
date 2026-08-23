import { Lock, ChevronRight } from 'lucide-react'

interface InternalOnlyProps {
  children: React.ReactNode
  /** 是否可收起，默认 true（收起态） */
  collapsible?: boolean
  title?: string
}

function InternalOnly({ children, collapsible = true, title }: InternalOnlyProps) {
  // Week 1：始终显示（模拟内部视角）
  // Week 8：根据 ViewToggle 上下文决定，外部视角返回 null
  const label = title ?? '仅内部可见'

  // 可收起：收起态一行灰底，锁图标橙色点缀，容器全 neutral
  if (collapsible) {
    return (
      <details className="my-4 group rounded-md border border-border bg-muted overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2">
          <Lock className="h-3 w-3 text-[#f5a623]" />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <div className="border-t border-border bg-card px-4 py-3 text-sm text-muted-foreground leading-relaxed [&>p]:my-0 [&>p+p]:mt-1.5">
          {children}
        </div>
      </details>
    )
  }

  // 不可收起：始终展开，与 Callout 同结构
  return (
    <div className="my-4 rounded-md border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="h-3 w-3 text-[#f5a623]" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="pl-[20px] text-sm text-muted-foreground leading-relaxed [&>p]:my-0 [&>p+p]:mt-1.5">
        {children}
      </div>
    </div>
  )
}

// Week 2：external 受众 → 返回空字符串（整块过滤）；internal → 内容原文
export type { InternalOnlyProps }
type InternalOnlyWithToMarkdown = typeof InternalOnly & {
  toMarkdown: (props: InternalOnlyProps, audience: 'internal' | 'external') => string
}
const InternalOnlyExport = Object.assign(InternalOnly, {
  toMarkdown: (_props: InternalOnlyProps, _audience: 'internal' | 'external'): string => {
    throw new Error('Not implemented - Week 2')
  },
}) as InternalOnlyWithToMarkdown

export { InternalOnlyExport as InternalOnly }
