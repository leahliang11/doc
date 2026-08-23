import React from 'react'

interface StepsProps {
  children: React.ReactNode
}

function Steps({ children }: StepsProps) {
  return (
    <ol className="my-6 space-y-6">
      {React.Children.map(children, (child, index) => (
        <li className="flex gap-4" key={index}>
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-normal">
            {index + 1}
          </span>
          <div className="flex-1 pt-0.5">{child}</div>
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
  toMarkdown: (_props: StepsProps): string => {
    throw new Error('Not implemented - Week 2')
  },
}) as StepsWithToMarkdown

export { StepsExport as Steps }
