// simple-git 封装：操作 doc 仓库，draft 分支只 commit content 文件
import simpleGit from 'simple-git'
import fs from 'fs'
import path from 'path'
import { CONTENT_REPO_PATH } from '../config.js'
import { slugToGitPath, slugToFilePath } from '../lib/slug.js'

const git = simpleGit({ baseDir: CONTENT_REPO_PATH })

// 拉最新 main
export async function pull(): Promise<void> {
  await git.fetch()
  await git.checkout('main')
  await git.pull('origin', 'main')
}

// 当前 HEAD commit hash
export async function getHeadCommit(): Promise<string> {
  const log = await git.log({ maxCount: 1 })
  return log.latest?.hash ?? ''
}

// 读 mdx 文件内容
export function readFile(slug: string): string {
  const filePath = slugToFilePath(slug)
  return fs.readFileSync(filePath, 'utf-8')
}

// 冲突检测：base_commit 之后 main 上是否有影响该 slug 文件的提交
export async function hasConflictSince(baseCommit: string, slug: string): Promise<boolean> {
  const gitPath = slugToGitPath(slug)
  await git.fetch()
  // git log base..origin/main -- <file>，看有无提交
  const result = await git.raw(['log', `${baseCommit}..origin/main`, '--oneline', '--', gitPath])
  return result.trim() !== ''
}

// 取远端 main 上该文件的最新内容（冲突时返回给前端）
export async function getRemoteFileAtMain(slug: string): Promise<string> {
  const gitPath = slugToGitPath(slug)
  // git show origin/main:<path>
  const content = await git.show([`origin/main:${gitPath}`])
  return content
}

// 生成 draft 分支名
export function draftBranchName(slug: string): string {
  // slug 里的 / 换成 -，避免分支名歧义
  const safe = slug.replace(/\//g, '-')
  const ts = Date.now()
  return `draft/${safe}-${ts}`
}

// 切/建 draft 分支（基于 origin/main）
export async function createDraftBranch(slug: string): Promise<string> {
  const branch = draftBranchName(slug)
  await git.checkoutBranch(branch, 'origin/main')
  return branch
}

// 写文件 + 限定路径 commit + push
// author 用登录用户（非 bot），committer 用仓库默认 config
export async function writeAndCommit(
  slug: string,
  markdown: string,
  authorName: string,
  authorEmail: string,
): Promise<{ commitHash: string; branch: string }> {
  const filePath = slugToFilePath(slug)
  const gitPath = slugToGitPath(slug)

  // 写文件
  fs.writeFileSync(filePath, markdown, 'utf-8')

  // 只 add 这个文件（绝不 git add .，避免混入 site 代码）
  await git.add(gitPath)

  // commit，author 设登录用户
  await git.commit(`docs: update ${slug}`, gitPath, {
    '--author': `${authorName} <${authorEmail}>`,
  })

  // 当前分支名（simple-git 3 用 revparse --abbrev-ref HEAD）
  const branch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim()

  // push 到远端
  await git.push('origin', branch, { '--set-upstream': null })

  const log = await git.log({ maxCount: 1 })
  const commitHash = log.latest?.hash ?? ''

  // 回到 main，让工作区恢复干净
  await git.checkout('main')

  return { commitHash, branch }
}
