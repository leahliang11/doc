import Link from 'next/link'
import { ArrowRight, BookOpenText } from 'lucide-react'

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
    <div className={`my-6 grid grid-cols-1 gap-3 ${items.length > 1 ? 'sm:grid-cols-2' : ''}`}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group flex min-h-[92px] items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-primary/[0.04]"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <BookOpenText className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold leading-5 text-foreground group-hover:text-primary">{item.title}</span>
            <span className="mt-1 block text-[12px] leading-5 text-muted-foreground">{item.description}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-subtle-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
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
