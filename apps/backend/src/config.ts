// 集中读取环境变量
import 'dotenv/config'

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
