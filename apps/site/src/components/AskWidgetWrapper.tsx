'use client'

import { usePathname } from 'next/navigation'
import { AskWidget } from './AskWidget'

// 薄包装层：server layout 不能用 usePathname，所以用这个 client 组件桥接
// 从当前路径推导 pageSlug，传给 AskWidget 做 context hint
export function AskWidgetWrapper() {
  const pathname = usePathname()
  // pathname 例：/joymaas-docs/docs/api/chat-completions → slug: api/chat-completions
  // 取 /docs/ 后面的部分
  const match = pathname.match(/\/docs\/(.+)$/)
  const pageSlug = match ? match[1] : undefined

  return <AskWidget pageSlug={pageSlug} />
}
