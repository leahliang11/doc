---
date: 2026-08-23
week: 10
owner: Leah
status: 完成
---

# Week 10 周报：部署收官

## 完成项

- [x] 云机装 Node 22 + pnpm + PM2 + git + gcc
- [x] site 开 standalone + 本地 build 验证
- [x] 3 服务部署到云机（backend :3001 / site :3002 / admin 静态）
- [x] backend 换 node:sqlite 绕开 better-sqlite3 CentOS 8 编译问题
- [x] nginx 反代 3 个 location（/joymaas-docs/ + /joymaas-doc-admin/ + /api/*）
- [x] 补 10 篇真内容（+ models/鉴权/限流/SDK 4 篇）
- [x] PM2 常驻 + 开机自启 + save
- [x] 演示脚本 docs/demo-script.md
- [x] known-issues §7 记录部署发现

## 判断标准达成

**3 服务公网可访问 + 10 篇文档 + 演示脚本。** ✅

- `http://116.196.90.213/joymaas-docs/` 前台 200
- `http://116.196.90.213/joymaas-doc-admin/` 后台 200
- `http://116.196.90.213/api/docs` backend 200（10 篇）
- 10 篇文档前台全可访问
- 演示脚本覆盖双通道闭环

## 部署架构

```
116.196.90.213 (CentOS 8, nginx:80)
├── /joymaas-docs/      → site standalone :3002 (PM2)
├── /joymaas-doc-admin/ → admin 静态 (/root/joymaas-doc-admin/)
└── /api/*              → backend :3001 (PM2, node:sqlite)
```

- backend: Fastify + tsx + node:sqlite + simple-git + gitbeaker
- site: Next.js 16 standalone（自带最小 node_modules，39M）
- admin: Vite + Vue3 静态产物（base=/joymaas-doc-admin/）

## 关键技术决策

### node:sqlite 替代 better-sqlite3
better-sqlite3 在 CentOS 8 双重失败：glibc 2.28 < prebuilt 要求的 2.29 + node-gyp/python3.6 编译失败。换 Node 22 内置的 `node:sqlite`（DatabaseSync），零原生依赖，API 几乎一致。这是第 5 类环境污染坑的延伸（CentOS 8 老系统原生模块是雷区）。

### site standalone 部署
本地 build 生成 `.next/standalone/`（自带最小 node_modules），传到云机直接 `node server.js`。避开云机 pnpm install 网络问题（云机访问 npm registry 也有超时）。

### admin 子路径 base
vite.config base 按环境切换：dev `/`，build `/joymaas-doc-admin/`。资源路径正确。

## 踩的坑（都修了，记进 known-issues §7）

1. **云机访问不到京东内网**：coding.jd.com / ai-api.jdcloud.com 都不通（22/443/80）。AI 和 git push 走本地 backend 兜底，webhook 方向待实测。
2. **better-sqlite3 glibc + node-gyp**：换 node:sqlite。
3. **macOS tar 带 ._ AppleDouble**：传后 `find -delete`，contentlayer 不再误扫。
4. **site build 类型错误**：Week 1-2 遗留的 mdx-to-md `.ts` 扩展名导入 + mdast 类型 + page.tsx undefined，dev 不报 build 报，修了。
5. **admin vue-tsc 未使用 import**：build 严格检查，删掉死代码。
6. **Next 污染变量**：云机没注入，但本地 build 仍要 `env -u` 清（dev.mjs 逻辑）。

## 未解决（known-issues §7）

### 7.1 云机访问不到京东内网（结构性限制）
- AI（调 Joybuilder）和 git push（回 coding）在云机不通
- 演示走本地 backend 兜底
- webhook 方向待 Leah 在 coding 网页配 webhook 后实测 delivery
- 长期：换能访问内网的部署机，或云机配内网代理

### 7.4 webhook 真闭环待实测
- backend webhook 端点本身验证工作正常（curl 模拟 merge_requests open 写表）
- coding → 云机 方向需配置后实测
- 演示用本地 curl 模拟 webhook

### 仓库评审规则（Week 5 留的）
- coding 仓库评审规则（允许自评/不需评审）或 bot 账号 PAT，待 Leah 决策
- 配好后 approve 才能真合入 main

## 启动方式

```bash
# 云机服务（PM2 常驻）
ssh root@116.196.90.213 'pm2 list'
# 前台 http://116.196.90.213/joymaas-docs/
# 后台 http://116.196.90.213/joymaas-doc-admin/

# 本地 backend（演示 AI + git push）
cd apps/backend && env -u PORT pnpm dev   # :3001
# 本地 admin
cd apps/admin && pnpm dev                 # :5173

# 重新部署 site（改内容后）
cd apps/site && pnpm build
# 传 standalone 到云机覆盖 + pm2 restart joymaas-site
```

## 验证过程

1. 云机 Node/pnpm/PM2/gcc 装好 ✓
2. site standalone build 成功（10 篇 SSG）✓
3. admin build 成功（base 子路径）✓
4. backend node:sqlite 跑通（health + docs + AI metrics）✓
5. nginx 3 location 配置 + reload ✓
6. 公网前台 200 + 后台 200 + API 200 ✓
7. 10 篇文档前台全可访问 ✓
8. admin 编辑器加载 + 调通 backend docs 列表 ✓
9. webhook 端点本地模拟写表 ✓
10. PM2 save + startup ✓
11. 演示脚本 + known-issues §7 ✓

## 10 周总结

P0 10 周走完，双通道文档系统从 0 到部署上云：

| 周 | 里程碑 |
|---|---|
| W1 | 前台地基 + 5 组件 + Stripe 风格 |
| W2 | Agent 三件套（.md / llms.txt / toMarkdown） |
| W3 | 后端 API + Git 读写 + gitbeaker 验证 |
| W4 | 后台编辑器（CodeMirror + 双栏 + 接 API） |
| W4+ | 编辑器升级（MDX 预览 + 组件插入 + AI mock） |
| W5 | webhook + 审核队列（双通道汇合） |
| W6 | OpenAPI 自动生成 + push 构建标记 |
| W7 | 生成器边界验证 + 清污染脚本 |
| W8 | 生成器嵌套展开 + 迁移决策 |
| W9 | AI 真接 Joybuilder（dogfooding） |
| W10 | 部署上云 + 10 篇内容 + 演示脚本 |

**核心成果**：双通道闭环（PM Web Editor + 工程师 Git）在审核队列汇合，OpenAPI 自动生成接口文档，AI 辅助写作用自家 JoyMaaS 模型（dogfooding），前台 Vercel 风格 + 后台 Stripe 风格，3 服务部署公网可访问。

## P1 待办

- CI/CD 自动化（push 自动构建部署）
- 域名 + HTTPS
- 监控告警
- webhook 真闭环实测（配 coding webhook）
- 仓库评审规则/bot 账号决策
- AI prompt 精调
- 多模型切换 UI

## 阻塞项

云机访问不到京东内网（结构性，需换部署机或配代理），不阻塞演示（本地 backend 兜底）。
