import { allDocs } from 'contentlayer2/generated'
import { SidebarLink } from './SidebarLink'

const categoryLabels: Record<string, string> = {
  quickstart: '开始使用',
  api: 'API 参考',
  models: '模型能力',
  guides: '构建与实践',
  troubleshooting: '排障',
}

const categoryOrder = ['quickstart', 'guides', 'api', 'troubleshooting', 'models']

function apiMethod(slug?: string) {
  if (!slug?.startsWith('api/')) return undefined
  return slug === 'api/models' ? 'GET' : 'POST'
}

export function Sidebar() {
  // 按 category 分组
  const grouped = allDocs.reduce((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = []
    acc[doc.category].push(doc)
    return acc
  }, {} as Record<string, typeof allDocs>)

  // 按 categoryOrder 排序，未列出的类别放最后
  const categories = Object.keys(grouped).sort((a, b) => {
    const ia = categoryOrder.indexOf(a)
    const ib = categoryOrder.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })

  return (
    <nav className="space-y-7" aria-label="文档导航">
      {categories.map((category) => (
        <div key={category}>
          <h2 className="mb-2 px-3 text-[11px] font-semibold tracking-wide text-subtle-foreground">
            {categoryLabels[category] || category}
          </h2>
          <ul className="space-y-1">
            {grouped[category].map((doc) => (
              <li key={doc.slug}>
                <SidebarLink href={doc.url} badge={apiMethod(doc.slug)}>
                  {doc.title}
                </SidebarLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
