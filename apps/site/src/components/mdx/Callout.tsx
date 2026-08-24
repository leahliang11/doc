import { Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react'

type CalloutVariant = 'info' | 'warning' | 'danger' | 'success'

interface CalloutProps {
  variant?: CalloutVariant
  title?: string
  children: React.ReactNode
}

const variantConfig: Record<
  CalloutVariant,
  { icon: typeof Info; container: string; iconWrap: string; iconColor: string }
> = {
  info: {
    icon: Info,
    container: 'border-indigo-100 bg-indigo-50/70 dark:border-indigo-900 dark:bg-indigo-950/40',
    iconWrap: 'bg-indigo-100 dark:bg-indigo-900',
    iconColor: 'text-primary',
  },
  warning: {
    icon: AlertTriangle,
    container: 'border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/35',
    iconWrap: 'bg-amber-100 dark:bg-amber-900',
    iconColor: 'text-amber-700 dark:text-amber-300',
  },
  danger: {
    icon: AlertCircle,
    container: 'border-rose-200 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/35',
    iconWrap: 'bg-rose-100 dark:bg-rose-900',
    iconColor: 'text-rose-700 dark:text-rose-300',
  },
  success: {
    icon: CheckCircle,
    container: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/35',
    iconWrap: 'bg-emerald-100 dark:bg-emerald-900',
    iconColor: 'text-emerald-700 dark:text-emerald-300',
  },
}

function Callout({ variant = 'info', title, children }: CalloutProps) {
  const config = variantConfig[variant]
  const Icon = config.icon
  return (
    <aside className={`my-5 rounded-xl border px-4 py-3.5 ${config.container}`}>
      {title ? (
        <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
          <span className={`grid h-7 w-7 place-items-center rounded-lg ${config.iconWrap}`}>
            <Icon className={`h-4 w-4 ${config.iconColor}`} />
          </span>
          <div className="min-w-0">
            <p className="mb-1 text-sm font-semibold leading-5 text-foreground">{title}</p>
            <div className="text-sm leading-6 text-muted-foreground [&>p]:my-0 [&>p+p]:mt-2">
              {children}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
          <span className={`grid h-7 w-7 place-items-center rounded-lg ${config.iconWrap}`}>
            <Icon className={`h-4 w-4 ${config.iconColor}`} />
          </span>
          <div className="min-w-0 text-sm leading-6 text-muted-foreground [&>p]:my-0 [&>p+p]:mt-2">
            {children}
          </div>
        </div>
      )}
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
