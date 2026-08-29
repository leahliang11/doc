import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// 后端 :3001，前端 dev 用代理避免 CORS
// build 时 base=/joymaas-doc-admin/（nginx 子路径部署），dev 时 base=/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_URL || 'http://127.0.0.1:3001'
  return {
  plugins: [vue()],
  base: command === 'build' ? '/joymaas-doc-admin/' : '/',
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  }
})
