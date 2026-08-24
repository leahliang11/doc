import React from 'react'

interface StepsProps {
  children: React.ReactNode
}

function Steps({ children }: StepsProps) {
  const items = React.Children.toArray(children)

  return (
    <ol className="my-7 space-y-0">
      {items.map((child, index) => (
        <li className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-4 pb-7 last:pb-0" key={index}>
          {index < items.length - 1 && (
            <span className="absolute bottom-0 left-[15px] top-8 w-px bg-gradient-to-b from-brand/35 to-brand/10" aria-hidden="true" />
          )}
          <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-brand/20 bg-brand-soft text-xs font-semibold text-brand ring-4 ring-background">
            {index + 1}
          </span>
          <div className="min-w-0 pt-0.5 [&>h3:first-child]:mt-0 [&>p:last-child]:mb-0">{child}</div>
        </li>
      ))}
    </ol>
  )
}

// Week 2：每个 step 子内容转为有序列表项
export type { StepsProps }
type StepsWithToMarkdown = typeof Steps & {
  toMarkdown: (props: StepsProps) => string
}
const StepsExport = Object.assign(Steps, {
  toMarkdown: (): string => {
    throw new Error('Not implemented - Week 2')
  },
}) as StepsWithToMarkdown

export { StepsExport as Steps }
