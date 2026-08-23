// mdx-to-md 共享类型

export type Audience = 'internal' | 'external'

// Callout
export interface CalloutProps {
  variant?: 'info' | 'warning' | 'danger' | 'success'
  title?: string
}

// CodeTabs
export interface CodeTab {
  label: string
  code: string
}
export interface CodeTabsProps {
  tabs: CodeTab[]
}

// Params
export interface Param {
  name: string
  type: string
  required: boolean
  default?: string
  description: string
}
export interface ParamsProps {
  params: Param[]
}

// Steps / InternalOnly 无结构化 props，只有 children
export interface StepsProps {}
export interface InternalOnlyProps {}

// NextSteps
export interface NextStepItem {
  title: string
  description: string
  href: string
}
export interface NextStepsProps {
  items: NextStepItem[]
}

// 受众（InternalOnly 导出需要）
