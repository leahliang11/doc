'use client'

import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface CodeTab {
  label: string
  code: string
}

interface CodeTabsProps {
  tabs: CodeTab[]
}

function CodeTabs({ tabs }: CodeTabsProps) {
  const [activeLabel, setActiveLabel] = useState(tabs[0]?.label ?? '')
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)
  const activeTab = tabs.find((tab) => tab.label === activeLabel) ?? tabs[0]

  const handleCopy = async (label: string, code: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedLabel(label)
    setTimeout(() => setCopiedLabel(null), 2000)
  }

  if (!activeTab) return null

  return (
    <div className="code-tabs my-4 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-h-9 items-center border-b border-border bg-muted px-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" role="tablist" aria-label="代码语言">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={tab.label === activeTab.label}
              onClick={() => setActiveLabel(tab.label)}
              className={`relative h-9 shrink-0 px-2.5 text-[11px] font-medium transition-colors ${
                tab.label === activeTab.label
                  ? 'text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => handleCopy(activeTab.label, activeTab.code)}
          className="ml-2 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
          aria-label="复制代码"
        >
          {copiedLabel === activeTab.label ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span>{copiedLabel === activeTab.label ? '已复制' : '复制'}</span>
        </button>
      </div>
      <pre className="m-0 max-h-[480px] overflow-auto rounded-none bg-[#f7f7f9] px-4 py-3.5 text-[12.5px] leading-[22px] dark:bg-[#1b1b1f]">
        <code className="font-mono text-foreground">{activeTab.code}</code>
      </pre>
    </div>
  )
}

// Week 2：所有语言展开为多个代码块（不藏 Tab）
export type { CodeTabsProps, CodeTab }
type CodeTabsWithToMarkdown = typeof CodeTabs & {
  toMarkdown: (props: CodeTabsProps) => string
}
const CodeTabsExport = Object.assign(CodeTabs, {
  toMarkdown: (): string => {
    throw new Error('Not implemented - Week 2')
  },
}) as CodeTabsWithToMarkdown

export { CodeTabsExport as CodeTabs }
