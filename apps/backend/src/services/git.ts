// simple-git 封装：操作 doc 仓库，draft 分支只 commit content 文件
import simpleGit from 'simple-git'
import fs from 'fs'
import path from 'path'
import { CONTENT_REPO_PATH } from '../config.js'
import { slugToGitPath, slugToFilePath } from '../lib/slug.js'

const git = simpleGit({ baseDir: CONTENT_REPO_PATH })

function preserveFrontmatter(filePath: string, markdown: string): string {
  if (/^---\n/.test(markdown)) return markdown
  if (!fs.existsSync(filePath)) return markdown
  const current = fs.readFileSync(filePath, 'utf-8')
  const frontmatter = current.match(/^---\n[\s\S]*?\n---\n?/)
  return frontmatter ? `${frontmatter[0]}\n${markdown.replace(/^\s+/, '')}` : markdown
}

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

export async function checkoutDraftBranch(branch: string): Promise<void> {
  if (!branch.startsWith('draft/')) throw new Error('只允许更新 draft/ 分支')
  await git.fetch('origin', branch)
  const local = await git.branchLocal()
  if (local.all.includes(branch)) await git.checkout(branch)
  else await git.checkoutBranch(branch, `origin/${branch}`)
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
  // 编辑器只传正文；保存时保留当前分支文件的 frontmatter，避免文档元数据被清空。
  fs.writeFileSync(filePath, preserveFrontmatter(filePath, markdown), 'utf-8')

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

// 写任意文件到仓库指定路径 + 走 draft 分支 commit + push
// 供 meta.yaml（不按 slug 定位）等特殊文件使用。流程同 writeAndCommit。
export async function writeAnyFileToDraft(
  absoluteFilePath: string, // 文件绝对路径（已存在则覆盖，不存在则创建）
  gitPath: string, // 相对仓库根的路径（git add 用）
  content: string,
  commitMessage: string,
  authorName: string,
  authorEmail: string,
): Promise<{ commitHash: string; branch: string }> {
  // 切 draft 分支（基于 origin/main），与 writeAndCommit 一致
  const branch = draftBranchName(gitPath.replace(/\//g, '-'))
  await git.checkoutBranch(branch, 'origin/main')

  // 写文件
  fs.mkdirSync(path.dirname(absoluteFilePath), { recursive: true })
  fs.writeFileSync(absoluteFilePath, content, 'utf-8')

  // 只 add 这个文件
  await git.add(gitPath)

  // commit，author 设登录用户
  await git.commit(commitMessage, gitPath, {
    '--author': `${authorName} <${authorEmail}>`,
  })

  // push 到远端
  await git.push('origin', branch, { '--set-upstream': null })

  const log = await git.log({ maxCount: 1 })
  const commitHash = log.latest?.hash ?? ''

  // 回到 main，让工作区恢复干净
  await git.checkout('main')

  return { commitHash, branch }
}

export async function writeFilesToDraft(
  slug: string,
  files: Array<{ absoluteFilePath: string; gitPath: string; content: string }>,
  commitMessage: string,
  authorName: string,
  authorEmail: string,
): Promise<{ commitHash: string; branch: string }> {
  const branch = await createDraftBranch(slug)
  try {
    for (const file of files) {
      fs.mkdirSync(path.dirname(file.absoluteFilePath), { recursive: true })
      fs.writeFileSync(file.absoluteFilePath, file.content, 'utf-8')
      await git.add(file.gitPath)
    }
    await git.commit(commitMessage, files.map((file) => file.gitPath), {
      '--author': `${authorName} <${authorEmail}>`,
    })
    await git.push('origin', branch, { '--set-upstream': null })
    const log = await git.log({ maxCount: 1 })
    return { commitHash: log.latest?.hash ?? '', branch }
  } finally {
    await git.checkout('main')
  }
}

// 删除文档并可同步更新导航文件：所有改动放在同一个 draft 分支和 MR 中。
export async function deleteFilesToDraft(
  filesToDelete: Array<{ absoluteFilePath: string; gitPath: string }>,
  filesToWrite: Array<{ absoluteFilePath: string; gitPath: string; content: string }>,
  commitMessage: string,
  authorName: string,
  authorEmail: string,
): Promise<{ commitHash: string; branch: string }> {
  const branch = await createDraftBranch(`delete-${Date.now()}`)
  try {
    const gitPaths: string[] = []
    for (const file of filesToDelete) {
      if (fs.existsSync(file.absoluteFilePath)) {
        await git.rm([file.gitPath])
        gitPaths.push(file.gitPath)
      }
    }
    for (const file of filesToWrite) {
      fs.mkdirSync(path.dirname(file.absoluteFilePath), { recursive: true })
      fs.writeFileSync(file.absoluteFilePath, file.content, 'utf-8')
      await git.add(file.gitPath)
      gitPaths.push(file.gitPath)
    }
    if (!gitPaths.length) throw new Error('没有可删除或更新的文件')
    await git.commit(commitMessage, gitPaths, {
      '--author': `${authorName} <${authorEmail}>`,
    })
    await git.push('origin', branch, { '--set-upstream': null })
    const log = await git.log({ maxCount: 1 })
    return { commitHash: log.latest?.hash ?? '', branch }
  } finally {
    await git.checkout('main')
  }
}

// 删除未发布草稿：直接在 main 提交，避免为尚未上线的内容制造审核负担。
export async function deleteFilesDirect(
  filesToDelete: Array<{ absoluteFilePath: string; gitPath: string }>,
  filesToWrite: Array<{ absoluteFilePath: string; gitPath: string; content: string }>,
  commitMessage: string,
  authorName: string,
  authorEmail: string,
): Promise<{ commitHash: string }> {
  await git.checkout('main')
  const gitPaths: string[] = []
  for (const file of filesToDelete) {
    if (fs.existsSync(file.absoluteFilePath)) {
      await git.rm([file.gitPath])
      gitPaths.push(file.gitPath)
    }
  }
  for (const file of filesToWrite) {
    fs.mkdirSync(path.dirname(file.absoluteFilePath), { recursive: true })
    fs.writeFileSync(file.absoluteFilePath, file.content, 'utf-8')
    await git.add(file.gitPath)
    gitPaths.push(file.gitPath)
  }
  if (!gitPaths.length) throw new Error('没有可删除或更新的文件')
  await git.commit(commitMessage, gitPaths, {
    '--author': `${authorName} <${authorEmail}>`,
  })
  await git.push('origin', 'main')
  const log = await git.log({ maxCount: 1 })
  return { commitHash: log.latest?.hash ?? '' }
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
