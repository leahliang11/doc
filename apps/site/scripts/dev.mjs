// dev 启动器：清掉 IDE 注入的 Next 污染变量后启动 next dev --turbopack
// 解决 LikeCodeNex IDE 注入 NODE_ENV=production / __NEXT_PRIVATE_STANDALONE_CONFIG（指向别的项目）/ TURBOPACK=1
// 导致 next dev 报 "Missing field turbopackMemoryEviction" 的问题（Week 1/6 踩坑）
import { spawn } from 'child_process'

const POLLUTED = [
  'NODE_ENV',
  '__NEXT_PRIVATE_STANDALONE_CONFIG',
  '__NEXT_PRIVATE_ORIGIN',
  '__NEXT_PRIVATE_STANDALONE_CONFIG_PATH',
  'TURBOPACK',
  'NEXT_DEPLOYMENT_ID',
]

const cleanEnv = { ...process.env }
for (const k of POLLUTED) delete cleanEnv[k]

const args = process.argv.slice(2).length ? process.argv.slice(2) : ['--turbopack', '-p', '50528']
const child = spawn('npx', ['next', 'dev', ...args], {
  env: cleanEnv,
  stdio: 'inherit',
  shell: true,
})

child.on('close', (code) => process.exit(code ?? 0))
