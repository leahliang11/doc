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

// 新建文档：直接在 main 上写 + commit + push（不走 draft 分支）
// 与 writeAndCommit 区别：不切分支，直接改 main。供「新建文档」用——
// 新文档需立即出现在 main 上，列表才能看到。
// 注意：这绕过了双通道审核，P0 新建走快速通道，后续可改成新建也走 draft+MR。
export async function commitToMain(
  slug: string,
  markdown: string,
  authorName: string,
  authorEmail: string,
  filePath: string, // 绝对路径（新建文件不存在，slugToFilePath 会抛错，由调用方传入）
  gitPath: string, // 仓库相对路径（git add 用）
): Promise<{ commitHash: string; branch: string }> {
  // 确保在 main 分支
  await git.checkout('main')

  // 写文件
  fs.writeFileSync(filePath, markdown, 'utf-8')

  // 只 add 这个文件
  await git.add(gitPath)

  // commit，author 设登录用户
  await git.commit(`docs: create ${slug}`, gitPath, {
    '--author': `${authorName} <${authorEmail}>`,
  })

  // push main
  await git.push('origin', 'main')

  const log = await git.log({ maxCount: 1 })
  const commitHash = log.latest?.hash ?? ''

  return { commitHash, branch: 'main' }
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

// 取某分支相对 main 的 diff（审核用）
// 先 fetch 确保远端分支引用最新，再 diff origin/<branch>..main
export async function getDiff(branch: string): Promise<string> {
  await git.fetch('origin', branch)
  // 用 origin/<branch>..main 的 diff（不改工作区）
  // --stat 太简略，用完整 diff 但限制只看 content-repo/content/ 路径，避免混入非内容改动
  const diff = await git.raw([
    'diff',
    `origin/${branch}...main`,
    '--',
    'content-repo/content/',
  ])
  // 反向（main..branch）才是"该分支新增的改动"，调整方向
  const forward = await git.raw([
    'diff',
    `main...origin/${branch}`,
    '--',
    'content-repo/content/',
  ])
  return forward || diff
}
