// 集中读取环境变量
// override:true 让 .env 覆盖 shell 注入的同名变量（LikeCodeNex IDE 会注入 JOYBUILDER_API_KEY 等污染变量）
import { config as dotenvConfig } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
dotenvConfig({ override: true })

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function required(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`缺少环境变量 ${key}，请检查 .env`)
  return v
}

export const CODING_TOKEN = required('CODING_TOKEN')
export const CODING_HOST = process.env.CODING_HOST ?? 'https://coding.jd.com'
export const CODING_PROJECT_ID = Number(required('CODING_PROJECT_ID'))
export const CONTENT_REPO_PATH = required('CONTENT_REPO_PATH')
export const PORT = Number(process.env.PORT ?? 3001)
export const DB_PATH = process.env.DB_PATH ?? './data/app.sqlite'
// site 目录（gen-openapi 脚本所在），config.ts 在 apps/backend/src/，往上 2 层到 apps/backend，再拼 ../site
export const SITE_DIR = process.env.SITE_DIR ?? path.resolve(__dirname, '..', '..', 'site')
export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? '' // Coding webhook 配置时设的 X-Gitlab-Token；空则不校验（仅本地调试）

// 后台访问保护。生产环境必须配置，所有非公开 /api/* 路由都校验 Bearer Token。
export const ADMIN_TOKEN = required('ADMIN_TOKEN')
// 面向管理员的登录凭据；登录成功后仍由服务端签发/复用内部令牌，不把令牌暴露给用户。
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin'
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''
// 内部文档/内部 Ask 独立令牌；未配置时一律不开放内部受众。
export const INTERNAL_DOCS_TOKEN = process.env.INTERNAL_DOCS_TOKEN ?? ''
// 生产环境只允许显式配置的跨域来源；同源请求不受 CORS 影响。
export const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

// Joybuilder AI（dogfooding：用自家 JoyMaaS 模型做文档 AI 助手）
export const JOYBUILDER_API_KEY = required('JOYBUILDER_API_KEY')
export const JOYBUILDER_BASE_URL =
  process.env.JOYBUILDER_BASE_URL ?? 'https://modelservice.jdcloud.com/v1'
export const JOYBUILDER_MODEL = process.env.JOYBUILDER_MODEL ?? 'DeepSeek-V4-Flash'
export const AI_LOG = process.env.AI_LOG === 'true' // 日志开关，默认关
