import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface NextStepItem {
  title: string
  description: string
  href: string
}

interface NextStepsProps {
  items: NextStepItem[]
}

function NextSteps({ items }: NextStepsProps) {
  if (!items || items.length === 0) return null

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border bg-card divide-y divide-border-soft">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group flex min-h-14 items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-primary/[0.035]"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold leading-5 text-foreground group-hover:text-primary">{item.title}</span>
            <span className="block text-[11.5px] leading-[18px] text-muted-foreground">{item.description}</span>
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-subtle-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>
      ))}
    </div>
  )
}

// Week 2 Markdown 导出：转链接列表（Agent 友好，和 llms.txt 一致）
// - [标题](href): 描述
export type { NextStepsProps, NextStepItem }
type NextStepsWithToMarkdown = typeof NextSteps & {
  toMarkdown: (props: NextStepsProps) => string
}
const NextStepsExport = Object.assign(NextSteps, {
  toMarkdown: (): string => {
    throw new Error('Not implemented - Week 2')
  },
}) as NextStepsWithToMarkdown

export { NextStepsExport as NextSteps }
