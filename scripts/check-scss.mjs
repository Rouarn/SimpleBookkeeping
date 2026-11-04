// 校验工程内所有 <style lang="scss"> 能否在 uni.scss token 环境下编译
// 用法: node scripts/check-scss.mjs [projectRoot]
// 需要 dart-sass：默认取 HBuilderX 内置副本，可用 SASS_MODULE=/path/to/sass 覆盖
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const SASS_PATH =
  process.env.SASS_MODULE ||
  '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/compile-dart-sass/node_modules/sass'
const sass = require(SASS_PATH)

const root = process.argv[2] || process.cwd()
const uniScss = join(root, 'uni.scss')

/** 递归收集 .vue 文件（跳过 node_modules / unpackage） */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'unpackage' || name === 'uni_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (name.endsWith('.vue')) out.push(p)
  }
  return out
}

/** uni.scss 里的 @/ 别名替换为真实路径 */
function resolveAlias(css) {
  return css.replace(/@\//g, root + '/')
}

const imports = resolveAlias(readFileSync(uniScss, 'utf8'))
const files = walk(root)
const failures = []
let checked = 0

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const blocks = [...src.matchAll(/<style[^>]*lang="scss"[^>]*>([\s\S]*?)<\/style>/g)]
  for (const [i, m] of blocks.entries()) {
    checked++
    const body = resolveAlias(m[1])
    const source = `${imports}\n${body}`
    try {
      sass.renderSync({ data: source, includePaths: [root], quietDeps: true })
    } catch (err) {
      failures.push({ file: relative(root, file), block: i, message: String(err.message).split('\n').slice(0, 5).join(' | ') })
    }
  }
}

console.log(`checked ${checked} scss block(s) in ${files.length} .vue file(s)`)
if (failures.length === 0) {
  console.log('ALL SCSS BLOCKS COMPILE')
} else {
  console.log(`FAILURES: ${failures.length}`)
  for (const f of failures) console.log(`- ${f.file} [block ${f.block}]: ${f.message}`)
  process.exitCode = 1
}
