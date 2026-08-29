import { Callout } from './Callout'
import { Steps } from './Steps'
import { CodeTabs } from './CodeTabs'
import { Params } from './Params'
import { InternalOnly } from './InternalOnly'
import { NextSteps } from './NextSteps'
import { Playground } from './Playground'
import { createElement } from 'react'
import type { ComponentPropsWithoutRef } from 'react'

function MdxLink({ href, ...props }: ComponentPropsWithoutRef<'a'>) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
  const resolvedHref = href?.startsWith('/docs/') ? `${basePath}${href}` : href
  return createElement('a', { href: resolvedHref, ...props })
}

export { Callout, Steps, CodeTabs, Params, InternalOnly, NextSteps, Playground }

// MDX components 映射表，供 useMDXComponent 使用
export const mdxComponents = {
  Callout,
  Steps,
  CodeTabs,
  Params,
  InternalOnly,
  NextSteps,
  Playground,
  a: MdxLink,
}
