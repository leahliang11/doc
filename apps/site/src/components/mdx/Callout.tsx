import { Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'

type CalloutVariant = 'info' | 'warning' | 'danger' | 'success'

interface CalloutProps {
  variant?: CalloutVariant
  title?: string
  children: React.ReactNode
}

const variantConfig: Record<
  CalloutVariant,
  { icon: typeof Info; accent: string; iconColor: string }
> = {
  info: {
    icon: Info,
    accent: 'border-l-indigo-500',
    iconColor: 'text-primary',
  },
  warning: {
    icon: AlertTriangle,
    accent: 'border-l-violet-500',
    iconColor: 'text-violet-600 dark:text-violet-300',
  },
  danger: {
    icon: AlertCircle,
    accent: 'border-l-rose-500',
    iconColor: 'text-rose-700 dark:text-rose-300',
  },
  success: {
    icon: CheckCircle,
    accent: 'border-l-emerald-500',
    iconColor: 'text-emerald-700 dark:text-emerald-300',
  },
}

function Callout({ variant = 'info', title, children }: CalloutProps) {
  const config = variantConfig[variant]
  const Icon = config.icon
  return (
    <aside className={`my-4 rounded-lg border border-border border-l-[3px] bg-muted/35 px-3 py-2.5 dark:bg-white/[0.025] ${config.accent}`}>
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.iconColor}`} />
        <div className="min-w-0 text-[13px] leading-[1.65] text-muted-foreground">
          {title && (
            <div className="mb-0.5 text-[13px] font-semibold leading-5 text-foreground">{title}</div>
          )}
          <div className="doc-callout-body">
            {children}
          </div>
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
