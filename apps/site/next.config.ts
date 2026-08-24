import { withContentlayer } from 'next-contentlayer2'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 部署用 standalone：产物自带最小 node_modules，云机不用传全量依赖
  output: 'standalone',
  // 部署在 nginx 子路径 /joymaas-docs/，配 basePath 让 <Link>/静态资源/fetch 统一带前缀
  // 本地 dev 也需带前缀访问：http://localhost:50528/joymaas-docs/docs/quickstart
  basePath: '/joymaas-docs',
  // 暴露给客户端/数据层（llms.txt 的 url 拼接需要手动加前缀，contentlayer 不自动带）
  env: {
    NEXT_PUBLIC_BASE_PATH: '/joymaas-docs',
  },
  // Next 16 默认 Turbopack；contentlayer2 注入 webpack 配置，设空 turbopack config 让 Turbopack 模式正常
  turbopack: {},
  // .md 路由：把 /docs/<path>.md 重写到 /docs-md/<path>，由 route handler 返回纯 Markdown
  // :path* 匹配多段（如 api/chat-completions）
  // basePath 会自动加到 source 前缀，destination 不加前缀（内部路由）
  async rewrites() {
    return [
      {
        source: '/docs/:path*.md',
        destination: '/docs-md/:path*',
      },
    ]
  },
};

export default withContentlayer(nextConfig)
