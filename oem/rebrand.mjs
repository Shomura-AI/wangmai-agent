#!/usr/bin/env node
// 网脉智能体 OEM 重品牌引擎
// 读取 oem/brand.config.json，按规则重写仓内品牌串、补丁关键 JSON、重命名文件。
//
//   node oem/rebrand.mjs --dry-run   只扫描统计，不写盘
//   node oem/rebrand.mjs             执行替换 + 改名，输出 oem/rebrand-report.json
//   node oem/rebrand.mjs --verify    替换后自检：扫描残留旧品牌串
//
// 设计要点：纯字符串操作（不用正则），旧串按长优先排序，JSON 走语义补丁再兜底替换。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const ARGS = new Set(process.argv.slice(2))
const DRY = ARGS.has('--dry-run')
const VERIFY = ARGS.has('--verify')

const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'brand.config.json'), 'utf8'))
const B = CONFIG.brand
const BRAND_MARK = B.nameEn.split(' ').join('')

// ---------- 替换规则：长串在前，避免短串先吃掉长串 ----------
const RULES = [
  ['com.claude-code-haha.desktop', B.appId],
  ['com.yunce.cchaha.mobile', B.iosBundleId],
  ['app.cchaha.mobile', B.androidPackage],
  ['cchaha.ai', B.domain],
  ['github.com/NanmiCoder/cc-haha', 'github.com/' + B.repoOwner + '/' + B.repoName],
  ['NanmiCoder/cc-haha', B.repoOwner + '/' + B.repoName],
  ['relakkes@gmail.com', B.email],
  ['relakkesyangs-team', B.repoOwner],
  ['Claude-Code-Haha', B.artifactBase],
  ['cc-haha-computer-use', B.cuName],
  ['claude-code-haha', B.packageKebab],
  ['claude_code_haha', B.packageSnake],
  ['claude-code-desktop', B.desktopPackage],
  ['claude_code_desktop', B.desktopSnake],
  ['claude-code-local', B.packageKebab],
  ['claude-code-im-adapters', 'wangmai-im-adapters'],
  ['claude-sidecar', B.sidecarName],
  ['claude-haha', B.slug],
  ['NanmiCoder', B.repoOwner],
  ['relakkes', B.slug],
  ['yunce', B.slug],
  ['cc-haha', B.slug],
  ['ccHaha', B.slug],
  ['CC_HAHA', B.envPrefix],
  ['CC-HAHA', B.envPrefix],
  ['cchaha', B.slug],
  ['ClaudeCodeHaha', BRAND_MARK],
  ['Claude Code Haha', B.nameZh],
  ['CcHaha', 'WangMai'],
  ['ccHaha', 'wangmai'],
  ['CC-Haha', 'WangMai'],
  ['CC Haha', B.nameZh],
  ['cc_haha', 'wangmai'],
  ['claude code haha', B.desktopPackage],
  ['HAHA', B.envPrefix],
  ['Haha', 'WangMai'],
  ['haha', 'wangmai']
]

// ---------- 目录 / 文件过滤 ----------
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-electron', 'release', 'build-artifacts', 'coverage', '.turbo', 'target', 'artifacts', '.cache', '.vite', '.expo', '.gradle', 'Pods', '.next', 'out'])
const SKIP_BASENAME_PREFIX = ['LICENSE', 'NOTICE', 'THIRD_PARTY']
const TEXT_EXT = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json', '.jsonc', '.md', '.mdx', '.markdown', '.yml', '.yaml', '.toml', '.rs', '.html', '.htm', '.css', '.scss', '.sass', '.less', '.sh', '.bash', '.zsh', '.ps1', '.psm1', '.bat', '.cmd', '.nsh', '.plist', '.xml', '.m', '.mm', '.swift', '.kt', '.kts', '.gradle', '.properties', '.sql', '.txt', '.svg', '.conf', '.cfg', '.ini', '.vue', '.svelte', '.env', '.example', '.py', '.patch', '.h', '.hpp', '.c', '.cpp', '.cs', '.java', '.dart', '.rb', '.go', '.lua'])
const TEXT_BASENAMES = new Set(['.gitignore', '.gitattributes', '.npmrc', '.nvmrc', '.editorconfig', 'Procfile'])
const MAX_BYTES = 4 * 1024 * 1024

// ---------- 关键 JSON 语义补丁 ----------
function getAt(obj, dotted) {
  const parts = dotted.split('.')
  let cur = obj
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}

function setAt(obj, dotted, value) {
  const parts = dotted.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (cur[p] === null || typeof cur[p] !== 'object') cur[p] = {}
    cur = cur[p]
  }
  cur[parts[parts.length - 1]] = value
}

function repointGithub(obj, dotted) {
  const arr = getAt(obj, dotted)
  if (!Array.isArray(arr)) return
  for (const item of arr) {
    if (item && typeof item === 'object' && item.provider === 'github') {
      item.owner = B.repoOwner
      item.repo = B.repoName
    }
  }
}

const JSON_PATCHES = [
  {
    file: 'package.json',
    sets: { name: B.packageKebab },
    custom: function (obj) {
      if (typeof obj.description === 'string') obj.description = B.packageDescription
    }
  },
  {
    file: 'desktop/package.json',
    sets: {
      name: B.desktopPackage,
      author: B.company + ' <' + B.email + '>',
      'build.appId': B.appId,
      'build.productName': B.nameZh,
      'build.executableName': B.desktopPackage,
      'build.nsis.shortcutName': B.nameZh,
      'build.linux.maintainer': B.company + ' <' + B.email + '>'
    },
    custom: function (obj) {
      if (typeof obj.description === 'string') obj.description = B.packageDescription
      repointGithub(obj, 'build.publish')
    }
  },
  {
    file: 'mobile/app.json',
    sets: {
      'expo.name': B.nameZh,
      'expo.slug': B.slug,
      'expo.scheme': B.slug,
      'expo.owner': B.repoOwner,
      'expo.ios.bundleIdentifier': B.iosBundleId,
      'expo.android.package': B.androidPackage
    },
    custom: function (obj) {
      const info = getAt(obj, 'expo.ios.infoPlist')
      if (!info || typeof info !== 'object') return
      if (typeof info.NSLocalNetworkUsageDescription === 'string') {
        info.NSLocalNetworkUsageDescription = B.nameZh + ' 需要访问局域网以连接你本机的服务。'
      }
    }
  },
  {
    file: 'desktop/src-tauri/tauri.conf.json',
    sets: {
      productName: B.nameZh,
      identifier: B.appId,
      'app.windows.0.title': B.nameZh,
      'plugins.updater.endpoints': [B.updaterEndpoint]
    }
  },
  {
    file: 'site/package.json',
    sets: { name: B.packageKebab + '-site' }
  }
]

// ---------- 文件与目录改名：内容替换后，文件名/目录名里的旧串同样重写 ----------
function renameToken(text) {
  let out = text
  for (const r of RULES) {
    if (out.indexOf(r[0]) === -1) continue
    out = out.split(r[0]).join(r[1])
  }
  return out
}

// ---------- 工具函数 ----------
function countOf(hay, needle) {
  let n = 0
  let i = hay.indexOf(needle)
  while (i !== -1) {
    n++
    i = hay.indexOf(needle, i + needle.length)
  }
  return n
}

function isTextCandidate(full, buf) {
  const base = path.basename(full)
  if (TEXT_BASENAMES.has(base)) return true
  for (const p of SKIP_BASENAME_PREFIX) if (base.startsWith(p)) return false
  const ext = path.extname(base).toLowerCase()
  if (ext) return TEXT_EXT.has(ext)
  const probe = buf.subarray(0, 8192)
  return probe.indexOf(0) === -1
}

function walk(dir, out) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (err) {
    return
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue
      walk(full, out)
    } else if (e.isFile()) {
      out.push(full)
    }
  }
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/')
}

// ---------- 主流程 ----------
const files = []
walk(ROOT, files)
files.sort()

const ruleStats = new Map()
for (const r of RULES) ruleStats.set(r[0], { from: r[0], to: r[1], count: 0, files: 0 })
const changedFiles = []
const patchedJson = []
const skipped = []
let scanned = 0

for (const full of files) {
  const r = rel(full)
  if (r.startsWith('oem/')) continue
  let buf
  try {
    const st = fs.statSync(full)
    if (st.size > MAX_BYTES) {
      skipped.push({ file: r, reason: 'too-large' })
      continue
    }
    buf = fs.readFileSync(full)
  } catch (err) {
    skipped.push({ file: r, reason: 'read-error' })
    continue
  }
  if (!isTextCandidate(full, buf)) continue
  scanned++
  const original = buf.toString('utf8')
  let text = original
  let jsonPatched = false

  const patch = JSON_PATCHES.find(function (p) { return p.file === r })
  if (patch && r.endsWith('.json')) {
    try {
      const obj = JSON.parse(text)
      for (const key of Object.keys(patch.sets)) setAt(obj, key, patch.sets[key])
      if (typeof patch.custom === 'function') patch.custom(obj)
      text = JSON.stringify(obj, null, 2) + '\n'
      jsonPatched = true
      patchedJson.push({ file: r, keys: Object.keys(patch.sets) })
    } catch (err) {
      skipped.push({ file: r, reason: 'json-parse: ' + err.message })
    }
  }

  const fileHits = []
  for (const rule of RULES) {
    const from = rule[0]
    const to = rule[1]
    if (text.indexOf(from) === -1) continue
    const n = countOf(text, from)
    text = text.split(from).join(to)
    const st = ruleStats.get(from)
    st.count += n
    st.files++
    fileHits.push(from + ' x' + n)
  }

  if (text !== original) {
    changedFiles.push({ file: r, hits: fileHits, jsonPatched: jsonPatched })
    if (!DRY) fs.writeFileSync(full, text, 'utf8')
  }
}

// 文件与目录改名（先深后浅，避免父目录改名后子路径失效）
const renamed = []
const dirs = []
function walkDirs(dir) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (err) {
    return
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue
    if (SKIP_DIRS.has(e.name)) continue
    const full = path.join(dir, e.name)
    dirs.push(full)
    walkDirs(full)
  }
}
walkDirs(ROOT)
dirs.sort(function (a, b) { return b.length - a.length })
const pendingRenames = []
for (const d of dirs) {
  const base = path.basename(d)
  const next = renameToken(base)
  if (next === base) continue
  pendingRenames.push({ from: rel(d), to: rel(path.join(path.dirname(d), next)), kind: 'dir' })
}
const filesNow = []
walk(ROOT, filesNow)
for (const f of filesNow) {
  const base = path.basename(f)
  const next = renameToken(base)
  if (next === base) continue
  pendingRenames.push({ from: rel(f), to: rel(path.join(path.dirname(f), next)), kind: 'file' })
}
for (const item of pendingRenames) {
  if (DRY) {
    renamed.push({ from: item.from, to: item.to, kind: item.kind, status: 'would-rename' })
    continue
  }
  const absFrom = path.join(ROOT, item.from)
  const absTo = path.join(ROOT, item.to)
  try {
    fs.renameSync(absFrom, absTo)
    renamed.push({ from: item.from, to: item.to, kind: item.kind, status: 'renamed' })
  } catch (err) {
    renamed.push({ from: item.from, to: item.to, kind: item.kind, status: 'failed: ' + err.message })
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  dryRun: DRY,
  root: ROOT,
  brand: { nameZh: B.nameZh, nameEn: B.nameEn, appId: B.appId, slug: B.slug },
  scannedFiles: scanned,
  changedFiles: changedFiles.length,
  rules: Array.from(ruleStats.values()).filter(function (x) { return x.count > 0 }).sort(function (a, b) { return b.count - a.count }),
  patchedJson: patchedJson,
  renamed: renamed,
  changed: changedFiles.map(function (c) { return c.file }),
  skipped: skipped.slice(0, 40)
}

if (VERIFY) {
  console.log('=== 残留旧品牌串扫描 ===')
  const again = []
  walk(ROOT, again)
  const tokens = RULES.map(function (r) { return r[0] })
  const hits = new Map()
  for (const t of tokens) hits.set(t, [])
  let total = 0
  for (const full of again) {
    const r = rel(full)
    if (r.startsWith('oem/')) continue
    let buf
    try {
      buf = fs.readFileSync(full)
    } catch (err) {
      continue
    }
    if (!isTextCandidate(full, buf)) continue
    const text = buf.toString('utf8')
    for (const t of tokens) {
      const n = countOf(text, t)
      if (n > 0) {
        hits.get(t).push(r + ' x' + n)
        total += n
      }
    }
  }
  for (const t of tokens) {
    const list = hits.get(t)
    if (list.length === 0) continue
    console.log(t + ' -> ' + list.length + ' 文件')
    for (const s of list.slice(0, 12)) console.log('   ' + s)
  }
  console.log('残留命中总数: ' + total)
} else {
  const top = report.rules.slice(0, 24)
  console.log('=== 网脉智能体 OEM ' + (DRY ? '预演' : '执行') + ' ===')
  console.log('扫描文本文件: ' + scanned + '，命中文件: ' + changedFiles.length)
  for (const s of top) console.log('  ' + s.from + ' -> ' + s.to + '  x' + s.count + ' (' + s.files + ' 文件)')
  for (const rn of renamed) console.log('改名: ' + rn.from + ' -> ' + rn.to + ' [' + rn.status + ']')
  if (skipped.length > 0) console.log('跳过: ' + JSON.stringify(skipped.slice(0, 8)))
}

if (!DRY) {
  fs.writeFileSync(path.join(HERE, 'rebrand-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8')
  console.log('报告: oem/rebrand-report.json')
}
