import React from 'react'

interface StepsProps {
  children: React.ReactNode
}

function Steps({ children }: StepsProps) {
  const items = React.Children.toArray(children)

  return (
    <ol className="doc-steps my-5 space-y-0">
      {items.map((child, index) => (
        <li className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-3 pb-4 last:pb-0" key={index}>
          {index < items.length - 1 && (
            <span className="absolute bottom-0 left-[11px] top-6 w-px bg-border" aria-hidden="true" />
          )}
          <span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-md border border-brand/20 bg-brand-soft font-mono text-[10px] font-semibold text-brand ring-2 ring-background">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0 [&>h3:first-child]:mt-0 [&>p:last-child]:mb-0">{child}</div>
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
