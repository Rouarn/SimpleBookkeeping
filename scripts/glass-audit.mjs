// 玻璃化改造静态审计：结构要求 + 事件/指令基线对比 + 残留实色背景扫描
// 用法: node scripts/glass-audit.mjs pages/index/index.vue ...（相对路径，需在 git 仓库内）
import { execSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.env.GLASS_ROOT || process.cwd()
const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node glass-audit.mjs <relative file>...')
  process.exit(2)
}

const counts = (src, re) => (src.match(re) || []).length
const SIGNALS = {
  '@click': /@click(\.|="|\s*=)/g,
  '@input': /@input(\.|="|\s*=)/g,
  '@change': /@change(\.|="|\s*=)/g,
  'v-if': /\bv-if=/g,
  'v-for': /\bv-for=/g,
  'v-model': /\bv-model(\.|=")/g,
  'v-show': /\bv-show=/g,
  '条件编译': /<!--\s*#(ifdef|ifndef|endif)/g,
}

let problems = 0
for (const rel of files) {
  const abs = join(root, rel)
  const src = readFileSync(abs, 'utf8')
  const isPage = rel.startsWith('pages/')
  const isTab = /^pages\/(index|flowing|statistics|my)\/index\.vue$/.test(rel)

  let base = ''
  try {
    base = execSync(`git show HEAD:${rel}`, { cwd: root, maxBuffer: 32 * 1024 * 1024 }).toString()
  } catch {
    base = ''
  }

  const issues = []
  const style = src.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] || ''

  if (isPage) {
    if (!/GlassBackground/.test(src)) issues.push('缺少 <GlassBackground />')
    if (!/themeClass/.test(src)) issues.push('根节点缺少 themeClass')
  }
  if (isTab) {
    if (!/GlassTabBar/.test(src)) issues.push('tab 页缺少 <GlassTabBar />')
  } else if (/GlassTabBar/.test(src)) {
    issues.push('非 tab 页误用 GlassTabBar')
  }

  // 大面积实色背景残留（玻璃化后应改为 .g-glass / var(--c-glass-*)）
  const solid = [
    ['background: $bg-card', /background:\s*\$bg-card\b/g],
    ['background: $bg-page', /background:\s*\$bg-page\b/g],
    ['background: $gradient-header', /background:\s*\$gradient-header\b/g],
    ['background: $gradient-page', /background:\s*\$gradient-page\b/g],
    ['background: #fff', /background:\s*#fff\b/gi],
    ['background: white', /background:\s*white\b/gi],
  ]
  for (const [label, re] of solid) {
    const n = counts(style, re)
    if (n > 0) issues.push(`残留实色背景 ${label} ×${n}`)
  }
  if (isPage && !/g-glass|backdrop-filter/.test(src)) {
    issues.push('页面未使用玻璃类或 backdrop-filter（可能未玻璃化）')
  }

  // 事件 / 指令基线对比
  const diff = []
  if (base) {
    for (const [name, re] of Object.entries(SIGNALS)) {
      const a = counts(base, re)
      const b = counts(src, re)
      if (b < a) diff.push(`${name} ${a} → ${b}`)
    }
  }

  if (issues.length || diff.length) {
    problems++
    console.log(`\n✗ ${rel}`)
    for (const i of issues) console.log(`   · ${i}`)
    if (diff.length) console.log(`   · 指令减少: ${diff.join(', ')}`)
  } else {
    console.log(`✓ ${rel}`)
  }
}

console.log(problems ? `\n${problems} 个文件需要复核` : '\n全部通过')
process.exitCode = problems ? 1 : 0
