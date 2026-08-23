'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

  const handleCopy = (label: string, code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedLabel(label)
    setTimeout(() => setCopiedLabel(null), 2000)
  }

  return (
    <div className="my-6">
      <Tabs defaultValue={tabs[0]?.label}>
        <TabsList className="bg-muted">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.label} value={tab.label} className="text-sm font-normal">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.label} value={tab.label} className="relative">
            <button
              onClick={() => handleCopy(tab.label, tab.code)}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="复制代码"
            >
              {copiedLabel === tab.label ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <pre className="overflow-x-auto rounded-lg bg-[#1e293b] p-4 text-sm">
              <code className="text-slate-100 font-mono">{tab.code}</code>
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

// Week 2：所有语言展开为多个代码块（不藏 Tab）
export type { CodeTabsProps, CodeTab }
type CodeTabsWithToMarkdown = typeof CodeTabs & {
  toMarkdown: (props: CodeTabsProps) => string
}
const CodeTabsExport = Object.assign(CodeTabs, {
  toMarkdown: (_props: CodeTabsProps): string => {
    throw new Error('Not implemented - Week 2')
  },
}) as CodeTabsWithToMarkdown

export { CodeTabsExport as CodeTabs }
