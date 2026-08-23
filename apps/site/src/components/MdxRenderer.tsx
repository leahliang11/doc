'use client'

import { useMDXComponent } from 'next-contentlayer2/hooks'
import { mdxComponents } from './mdx'

export function MdxRenderer({ code }: { code: string }) {
  const MDXComponent = useMDXComponent(code)

  return <MDXComponent components={mdxComponents} />
}
