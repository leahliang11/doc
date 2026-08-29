import fs from 'node:fs'
import path from 'node:path'
import { load as yamlLoad } from 'js-yaml'
import { allDocs } from 'contentlayer2/generated'
import { SidebarLink } from './SidebarLink'

type MetaSection = {
  id: string
  label: string
  icon?: string
  order?: number
  groups?: MetaGroup[]
}
type MetaGroup = {
  id: string
  label: string
  order?: number
  pages?: string[]
}
type Meta = { sections: MetaSection[] }

// 服务端读 _meta.yaml（contentlayer 不自动解析这个文件，手动读）
function loadMeta(): Meta {
  try {
    // 可能的路径：content-repo/content/_meta.yaml 或 apps/site/content/_meta.yaml
    const candidates = [
      path.resolve(process.cwd(), '../../content-repo/content/_meta.yaml'),
      path.join(process.cwd(), 'content-repo', 'content', '_meta.yaml'),
      path.join(process.cwd(), 'content', '_meta.yaml'),
    ]
    const file = candidates.find((p) => fs.existsSync(p))
    if (!file) return { sections: [] }
    return yamlLoad(fs.readFileSync(file, 'utf8')) as Meta
  } catch {
    return { sections: [] }
  }
}

function apiMethod(slug?: string) {
  if (!slug?.startsWith('api/')) return undefined
  return slug === 'api/models' ? 'GET' : 'POST'
}

export function Sidebar() {
  const meta = loadMeta()
  // slug → doc 查找表
  const docMap = new Map(allDocs.map((d) => [d.slug, d]))
  // 已被 _meta 引用的 slug 集合（用于算未分类）
  const referenced = new Set<string>()

  const sections = (meta.sections || [])
    .slice()
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))

  // 找当前活跃 slug（用于默认展开）——运行时从 usePathname 拿不到（这是 RSC 静态渲染），
  // 这里不展开逻辑由客户端 <details> 默认 open 控制；首项 open，其余交给用户点
  return (
    <nav className="space-y-5" aria-label="文档导航">
      {sections.map((section) => {
        const groups = (section.groups || [])
          .slice()
          .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
        return (
          <div key={section.id}>
            <h2 className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground">
              {section.label}
            </h2>
            <ul className="space-y-0.5">
              {groups.map((group) => {
                const pages = group.pages || []
                pages.forEach((s) => referenced.add(s))
                // 单页组不折叠，直接展示页链接
                if (pages.length <= 1) {
                  return pages.map((slug) => {
                    const doc = docMap.get(slug)
                    if (!doc) return null
                    return (
                      <li key={slug}>
                        <SidebarLink href={doc.url} badge={apiMethod(doc.slug)}>
                          {doc.title}
                        </SidebarLink>
                      </li>
                    )
                  })
                }
                // 多页组：可折叠 details
                return (
                  <li key={group.id}>
                    <details open className="group">
                      <summary className="flex cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-foreground hover:bg-muted/50">
                        <svg
                          className="mr-1.5 h-3 w-3 shrink-0 transition-transform group-open:rotate-90"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M4 3 L8 6 L4 9" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {group.label}
                      </summary>
                      <ul className="ml-2.5 mt-0.5 space-y-0.5 border-l border-border pl-2.5">
                        {pages.map((slug) => {
                          const doc = docMap.get(slug)
                          if (!doc) return null
                          return (
                            <li key={slug}>
                              <SidebarLink href={doc.url} badge={apiMethod(doc.slug)}>
                                {doc.title}
                              </SidebarLink>
                            </li>
                          )
                        })}
                      </ul>
                    </details>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      {/* 未分类降级区：不在 _meta 里的文档 */}
      {(() => {
        const uncategorized = allDocs.filter((d) => d.slug && !referenced.has(d.slug))
        if (uncategorized.length === 0) return null
        return (
          <div>
            <h2 className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground">
              其他
            </h2>
            <ul className="space-y-0.5">
              {uncategorized.map((doc) => (
                <li key={doc.slug}>
                  <SidebarLink href={doc.url} badge={apiMethod(doc.slug)}>
                    {doc.title}
                  </SidebarLink>
                </li>
              ))}
            </ul>
          </div>
        )
      })()}
    </nav>
  )
}
