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

// Vercel Docs 风格：极细边、无阴影、hover 边框加深 + 微抬，高度由内容决定
// 配色见 DESIGN_TOKENS.md §6
function NextSteps({ items }: NextStepsProps) {
  if (!items || items.length === 0) return null

  return (
    <div className="my-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group relative rounded-md border border-border bg-card p-4 transition-all hover:border-neutral-400 dark:hover:border-neutral-500 hover:-translate-y-px"
        >
          <h3 className="mb-1 text-[15px] font-medium text-foreground leading-snug">
            {item.title}
          </h3>
          <p className="text-[13px] text-muted-foreground leading-snug">
            {item.description}
          </p>
          <ArrowRight className="absolute right-4 bottom-4 h-3 w-3 text-primary opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
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
  toMarkdown: (_props: NextStepsProps): string => {
    throw new Error('Not implemented - Week 2')
  },
}) as NextStepsWithToMarkdown

export { NextStepsExport as NextSteps }
