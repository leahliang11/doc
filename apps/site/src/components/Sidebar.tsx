import Link from 'next/link'
import { allDocs } from 'contentlayer2/generated'

const categoryLabels: Record<string, string> = {
  quickstart: '快速开始',
  api: 'API 参考',
  models: '模型说明',
  guides: '场景指南',
  troubleshooting: '排障',
}

const categoryOrder = ['quickstart', 'api', 'models', 'guides', 'troubleshooting']

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
    <nav className="space-y-6">
      {categories.map((category) => (
        <div key={category}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {categoryLabels[category] || category}
          </h3>
          <ul className="space-y-1">
            {grouped[category].map((doc) => (
              <li key={doc.slug}>
                <Link
                  href={doc.url}
                  className="block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
                >
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
