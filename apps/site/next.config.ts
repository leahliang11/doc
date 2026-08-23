import { withContentlayer } from 'next-contentlayer2'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next 16 默认 Turbopack；contentlayer2 注入了 webpack 配置，
  // 设空 turbopack config 让 Turbopack 模式正常工作（contentlayer 在构建期跑，不依赖运行时 bundler）
  turbopack: {},
  // .md 路由：把 /docs/<path>.md 重写到 /docs-md/<path>，由 route handler 返回纯 Markdown
  // :path* 匹配多段（如 api/chat-completions）
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
