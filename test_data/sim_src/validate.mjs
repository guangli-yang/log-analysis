// =============================================================================
// 端到端验证脚本：用合成日志 + 模块检索结果 验证匹配引擎 (src/utils/logMatch.ts)
// 运行: 先 `npx esbuild src/utils/logMatch.ts --bundle --format=esm --outfile=test_data/sim_src/_engine.mjs --platform=node`
//       再 `node test_data/sim_src/validate.mjs`
// =============================================================================
import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { matchModuleAgainstLog } from './_engine.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { expectedById, metaById } = JSON.parse(readFileSync(join(__dirname, '_expected.json'), 'utf8'))
const synLines = readFileSync(join(__dirname, 'synthetic_log.txt'), 'utf8').split('\n')

const modDir = join(__dirname, 'module_logs')
const modFiles = readdirSync(modDir).filter((f) => f.endsWith('.json'))

// 运行引擎：候选 id -> 实际命中行集合
const got = new Map()
for (const mf of modFiles) {
  const content = readFileSync(join(modDir, mf), 'utf8')
  const matches = matchModuleAgainstLog({ id: mf, name: mf, content }, synLines)
  for (const m of matches) {
    const id = m.candidate.id
    if (!got.has(id)) got.set(id, new Set())
    for (const l of m.lines) got.get(id).add(l.lineNumber)
  }
}

// 汇总
let pass = 0, issues = 0, fails = 0
const rows = []
const allExpectedLines = new Set()
for (const lines of Object.values(expectedById)) lines.forEach((l) => allExpectedLines.add(l))

for (const [id, expArr] of Object.entries(expectedById)) {
  const exp = [...new Set(expArr)].sort((a, b) => a - b)
  const g = got.get(id) ? [...got.get(id)].sort((a, b) => a - b) : []
  const matched = exp.every((l) => g.includes(l))
  const meta = metaById[id] || {}
  if (matched) {
    if (meta.expect === 'issue') {
      rows.push(`  ~ [${id}] 预期暴露问题但实际命中(行${exp}) —— 该隐患在隔离场景下未显现`)
      issues++
    } else {
      rows.push(`  ✅ [${id}] -> 行[${exp}]`)
      pass++
    }
  } else {
    if (meta.expect === 'issue') {
      rows.push(`  ⚠ [${id}] 暴露潜在问题: 期望行[${exp}] 实际[${g}] | ${meta.note}`)
      issues++
    } else {
      rows.push(`  ❌ [${id}] 期望行[${exp}] 实际[${g}] | ${meta.note || '正常场景未匹配'}`)
      fails++
    }
  }
}

// 过匹配检测：某候选命中了不属于任何期望集合的行
let over = 0
for (const [id, set] of got) {
  for (const ln of set) {
    if (!allExpectedLines.has(ln)) {
      over++
      rows.push(`  ⚠ [${id}] 过匹配: 命中行${ln} 不在任何期望集合中`)
    }
  }
}

console.log('\n================ 匹配引擎验证报告 ================')
console.log(`合成日志行数: ${synLines.length} | 期望候选数: ${Object.keys(expectedById).length} | 模块检索文件: ${modFiles.length}`)
console.log('-------------------------------------------------')
for (const r of rows) console.log(r)
console.log('-------------------------------------------------')
console.log(`正常匹配 ✅: ${pass}   暴露潜在问题 ⚠: ${issues}   异常失败 ❌: ${fails}   过匹配 ⚠: ${over}`)
console.log('=================================================\n')
process.exit(fails === 0 ? 0 : 1)
