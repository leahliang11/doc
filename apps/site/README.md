# JoyMaaS 开发者文档前台

Next.js 文档站，内容来自 `content-repo/content`，部署路径为 `/joymaas-docs`。

## 本地开发

```bash
pnpm install
pnpm dev -p 50529
```

开发启动会先清理并重新生成 Contentlayer 内容，避免已删除或已改名的文档继续残留在路由里。

## 构建与检查

```bash
pnpm test
pnpm lint
pnpm build
```

完整构建依次执行 OpenAPI 文档生成、Contentlayer 刷新和 Next.js 生产编译。OpenAPI 的手写对比稿只写入 `.contentlayer/openapi-comparisons`，不会进入正式文档路由。

## 环境变量

- `NEXT_PUBLIC_BACKEND_URL`：本地前台调用后端时使用；同源部署可留空。
- `NEXT_PUBLIC_ENABLE_INTERNAL_VIEW=true`：仅内部构建开启受众切换。
- `DOCS_BUILD_AUDIENCE=internal`：仅内部构建保留 `<InternalOnly>` 内容。
- `INTERNAL_DOCS_TOKEN`：访问 `/llms-full-internal.txt` 的 Bearer Token；不配置时接口返回 404。

公开构建不要设置 `NEXT_PUBLIC_ENABLE_INTERNAL_VIEW` 或 `DOCS_BUILD_AUDIENCE=internal`。

## 视觉规范

所有页面与 MDX 组件遵循 [DESIGN_TOKENS.md](./DESIGN_TOKENS.md)：亮色冷白底、JoyMaaS 紫色主品牌、不使用渐变、不使用提示框左侧色条，并保持紧凑的信息密度。
