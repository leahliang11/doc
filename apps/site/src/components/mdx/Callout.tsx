import { Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'

type CalloutVariant = 'info' | 'warning' | 'danger' | 'success'

interface CalloutProps {
  variant?: CalloutVariant
  title?: string
  children: React.ReactNode
}

const variantConfig: Record<
  CalloutVariant,
  { icon: typeof Info; surface: string; iconColor: string }
> = {
  info: {
    icon: Info,
    surface: 'border-brand/20 bg-brand-soft',
    iconColor: 'text-brand',
  },
  warning: {
    icon: AlertTriangle,
    surface: 'border-orange-200/70 bg-orange-50/55 dark:border-orange-900/70 dark:bg-orange-950/25',
    iconColor: 'text-orange-700 dark:text-orange-300',
  },
  danger: {
    icon: AlertCircle,
    surface: 'border-rose-200/70 bg-rose-50/50 dark:border-rose-900/70 dark:bg-rose-950/20',
    iconColor: 'text-rose-700 dark:text-rose-300',
  },
  success: {
    icon: CheckCircle,
    surface: 'border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-900/70 dark:bg-emerald-950/20',
    iconColor: 'text-emerald-700 dark:text-emerald-300',
  },
}

function Callout({ variant = 'info', title, children }: CalloutProps) {
  const config = variantConfig[variant]
  const Icon = config.icon
  return (
    <aside className={`doc-callout my-3 rounded-[7px] border px-2.5 py-2 ${config.surface}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-[3px] h-3.5 w-3.5 shrink-0 ${config.iconColor}`} />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-[12.5px] leading-[1.6] text-muted-foreground">
          {title && <span className="shrink-0 font-semibold text-foreground">{title}</span>}
          <div className="doc-callout-body min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </aside>
  )
}

// Week 2 Markdown 导出：转 GFM alert（info→[!NOTE], warning→[!WARNING], danger→[!CAUTION], success→[!TIP]）
export type { CalloutProps }
type CalloutWithToMarkdown = typeof Callout & {
  toMarkdown: (props: CalloutProps) => string
}
const CalloutExport = Object.assign(Callout, {
  toMarkdown: (): string => {
    throw new Error('Not implemented - Week 2')
  },
}) as CalloutWithToMarkdown

export { CalloutExport as Callout }
