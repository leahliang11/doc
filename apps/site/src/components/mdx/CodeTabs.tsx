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
    <div className="code-tabs my-6 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
      <div className="flex min-h-11 items-center border-b border-slate-700/80 bg-slate-800/80 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" role="tablist" aria-label="代码语言">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={tab.label === activeTab.label}
              onClick={() => setActiveLabel(tab.label)}
              className={`relative h-11 shrink-0 px-3 text-xs font-medium transition-colors ${
                tab.label === activeTab.label
                  ? 'text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => handleCopy(activeTab.label, activeTab.code)}
          className="ml-2 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
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
      <pre className="m-0 max-h-[520px] overflow-auto rounded-none bg-slate-900 px-5 py-4 text-[13px] leading-6">
        <code className="font-mono text-slate-100">{activeTab.code}</code>
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
