import { defineDocumentType, makeSource } from 'contentlayer2/source-files'
import rehypePrettyCode from 'rehype-pretty-code'
import path from 'path'

type AstNode = {
  type?: string
  name?: string
  children?: AstNode[]
}

// 公开构建在 MDX 编译前彻底移除 InternalOnly，避免“仅 CSS 隐藏但内容仍进入浏览器 bundle”。
function stripInternalOnly() {
  return (tree: AstNode) => {
    const walk = (node: AstNode) => {
      if (!node.children) return
      node.children = node.children.filter(
        (child) => !(child.type === 'mdxJsxFlowElement' && child.name === 'InternalOnly'),
      )
      node.children.forEach(walk)
    }
    walk(tree)
  }
}

// Doc 文档类型定义
export const Doc = defineDocumentType(() => ({
  name: 'Doc',
  filePathPattern: `**/*.mdx`,
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    description: { type: 'string', required: true },
    slug: { type: 'string', required: false },
    category: {
      type: 'enum',
      required: true,
      options: ['quickstart', 'models', 'api', 'guides', 'troubleshooting'],
    },
    audience: {
      type: 'enum',
      required: true,
      options: ['external', 'internal', 'both'],
    },
    tags: { type: 'list', of: { type: 'string' }, required: false },
    updated: { type: 'date', required: false },
    status: {
      type: 'enum',
      required: false,
      options: ['draft', 'review', 'published', 'archived'],
      default: 'published',
    },
    owner: { type: 'string', required: false },
    ai_readable: { type: 'boolean', required: false, default: true },
    source: {
      type: 'enum',
      required: false,
      options: ['manual', 'openapi'],
      default: 'manual',
    },
  },
  computedFields: {
    // URL 路径：/docs/quickstart, /docs/api/chat-completions 等
    url: {
      type: 'string',
      resolve: (doc) => `/docs/${doc._raw.flattenedPath}`,
    },
    // slug：用 flattenedPath 作为 slug
    slug: {
      type: 'string',
      resolve: (doc) => doc._raw.flattenedPath,
    },
  },
}))

// 代码高亮配置
const rehypePrettyCodeOptions = {
  theme: {
    dark: 'github-dark-dimmed',
    light: 'github-light',
  },
  keepBackground: false,
}

export default makeSource({
  // 指向 content-repo/content（独立 git 仓库，在 apps/site 上两级）
  contentDirPath: path.resolve(process.cwd(), '../../content-repo/content'),
  documentTypes: [Doc],
  mdx: {
    remarkPlugins: process.env.DOCS_BUILD_AUDIENCE === 'internal' ? [] : [stripInternalOnly],
    rehypePlugins: [[rehypePrettyCode, rehypePrettyCodeOptions]],
  },
})
