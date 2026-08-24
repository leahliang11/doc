// 集中读取环境变量
// override:true 让 .env 覆盖 shell 注入的同名变量（LikeCodeNex IDE 会注入 JOYBUILDER_API_KEY 等污染变量）
import { config as dotenvConfig } from 'dotenv'
dotenvConfig({ override: true })

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
export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? '' // Coding webhook 配置时设的 X-Gitlab-Token；空则不校验（仅本地调试）

// Joybuilder AI（dogfooding：用自家 JoyMaaS 模型做文档 AI 助手）
export const JOYBUILDER_API_KEY = required('JOYBUILDER_API_KEY')
export const JOYBUILDER_BASE_URL =
  process.env.JOYBUILDER_BASE_URL ?? 'https://modelservice.jdcloud.com/v1'
export const JOYBUILDER_MODEL = process.env.JOYBUILDER_MODEL ?? 'DeepSeek-V4-Flash'
export const AI_LOG = process.env.AI_LOG === 'true' // 日志开关，默认关
