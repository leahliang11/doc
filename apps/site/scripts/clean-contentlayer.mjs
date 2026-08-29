import { rmSync } from 'fs'
import path from 'path'

const contentlayerDir = path.resolve(import.meta.dirname, '..', '.contentlayer')
if (path.basename(contentlayerDir) !== '.contentlayer') {
  throw new Error('拒绝清理非 Contentlayer 目录')
}

rmSync(contentlayerDir, { recursive: true, force: true })
