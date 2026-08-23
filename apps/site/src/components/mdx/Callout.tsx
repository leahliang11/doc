import { Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'

type CalloutVariant = 'info' | 'warning' | 'danger' | 'success'

interface CalloutProps {
  variant?: CalloutVariant
  title?: string
  children: React.ReactNode
}

// Vercel Docs 风格：白底 + 极细边 + 左 2px 淡色线，图标用语义色（小面积），容器不染色
// 配色见 DESIGN_TOKENS.md §1、§6
const variantConfig: Record<
  CalloutVariant,
  { icon: typeof Info; line: string; iconColor: string }
> = {
  info: {
    icon: Info,
    line: 'border-l-primary/40',
    iconColor: 'text-primary',
  },
  warning: {
    icon: AlertTriangle,
    line: 'border-l-[#f5a623]/50',
    iconColor: 'text-[#f5a623]',
  },
  danger: {
    icon: AlertCircle,
    line: 'border-l-[#e00]/50 dark:border-l-[#ff5555]/50',
    iconColor: 'text-[#e00] dark:text-[#ff5555]',
  },
  success: {
    icon: CheckCircle,
    line: 'border-l-[#0a8]/50',
    iconColor: 'text-[#0a8]',
  },
}

function Callout({ variant = 'info', title, children }: CalloutProps) {
  const config = variantConfig[variant]
  const Icon = config.icon
  return (
    <div
      className={`my-4 rounded-md border border-border border-l-2 bg-card ${config.line} px-4 py-3`}
    >
      {title ? (
        <>
          <div className="flex items-center gap-2">
            <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${config.iconColor}`} />
            <p className="text-sm font-medium text-foreground leading-snug">{title}</p>
          </div>
          <div className="mt-1 pl-[22px] text-sm text-muted-foreground leading-relaxed [&>p]:my-0 [&>p+p]:mt-1.5">
            {children}
          </div>
        </>
      ) : (
        <div className="flex items-start gap-2">
          <Icon className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
          <div className="flex-1 min-w-0 text-sm text-muted-foreground leading-relaxed [&>p]:my-0 [&>p+p]:mt-1.5">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

// Week 2 Markdown 导出：转 GFM alert（info→[!NOTE], warning→[!WARNING], danger→[!CAUTION], success→[!TIP]）
export type { CalloutProps }
type CalloutWithToMarkdown = typeof Callout & {
  toMarkdown: (props: CalloutProps) => string
}
const CalloutExport = Object.assign(Callout, {
  toMarkdown: (_props: CalloutProps): string => {
    throw new Error('Not implemented - Week 2')
  },
}) as CalloutWithToMarkdown

export { CalloutExport as Callout }
