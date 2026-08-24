'use client'

import { useMDXComponent } from 'next-contentlayer2/hooks'
import { mdxComponents } from './mdx'

export function MdxRenderer({ code }: { code: string }) {
  const MDXComponent = useMDXComponent(code)

  // Contentlayer 在运行时把编译后的 MDX 字符串转换为组件，这是该库的标准渲染方式。
  // eslint-disable-next-line react-hooks/static-components
  return <MDXComponent components={mdxComponents} />
}
