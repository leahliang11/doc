// 构建 API：手动触发前台构建（本地开发用；Week 10 换 CI）
// 后端只"记账"+ 按需 spawn，push 不自动 spawn（职责清晰）
import type { FastifyInstance } from 'fastify'
import { spawn } from 'child_process'
import path from 'path'
import {
  listBuildTasks,
  recordBuildNeed,
  updateBuildTaskStatus,
  clearBuildTask,
} from '../services/db.js'

// site 目录（apps/site），从 backend/src/routes 上溯
const SITE_DIR = path.resolve(import.meta.dirname, '../../../site')

export async function buildRoutes(app: FastifyInstance): Promise<void> {
  // 列表
  app.get('/api/build/tasks', async (request) => {
    const { status } = request.query as { status?: string }
    return listBuildTasks(status || 'pending')
  })

  // 手动触发构建：先记一条 manual build_task，spawn 跑 gen:openapi + build，完成更新状态
  app.post('/api/build/run', async (request, reply) => {
    const taskId = recordBuildNeed('manual')
    request.log.info({ taskId }, '手动构建触发')

    // 异步 spawn，不阻塞响应
    runBuild(taskId, app).catch((e) => {
      request.log.error(e, '构建异常')
      updateBuildTaskStatus(taskId, 'failed', String(e))
    })

    return { status: 'building', task_id: taskId, message: '构建已在后台启动，稍后查看 /api/build/tasks' }
  })

  // 清理已完成的构建记录
  app.delete('/api/build/tasks/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    clearBuildTask(Number(id))
    return { status: 'ok' }
  })
}

// spawn 跑 pnpm gen:openapi && pnpm build（site 目录）
async function runBuild(taskId: number, app: FastifyInstance): Promise<void> {
  updateBuildTaskStatus(taskId, 'building')
  const logChunks: string[] = []

  return new Promise((resolve, reject) => {
    // 用 shell 串联 gen:openapi && build
    const child = spawn('pnpm', ['run', 'gen:openapi'], {
      cwd: SITE_DIR,
      shell: true,
    })

    child.stdout?.on('data', (d) => logChunks.push(String(d)))
    child.stderr?.on('data', (d) => logChunks.push(String(d)))

    child.on('close', (code) => {
      const log = logChunks.join('').slice(-4000) // 截断避免过大
      if (code === 0) {
        updateBuildTaskStatus(taskId, 'done', log)
        app.log.info({ taskId }, '构建完成')
        resolve()
      } else {
        updateBuildTaskStatus(taskId, 'failed', `exit ${code}\n${log}`)
        app.log.warn({ taskId, code }, '构建失败')
        reject(new Error(`构建失败 exit ${code}`))
      }
    })

    child.on('error', (e) => {
      updateBuildTaskStatus(taskId, 'failed', String(e))
      reject(e)
    })
  })
}
