import { CodeSearchResult, ModuleLog, MatchedLogLine } from '../types'

/**
 * 日志匹配引擎 v2.0 — 模式正则 + 确定性匹配
 * ============================================================
 *
 * 设计原则：
 *   1. 等级前置过滤：仅 ≥ ERROR 的日志行进入匹配
 *   2. 三种确定性结构模式（A/B/C），单次 find() 匹配，无启发式猜测
 *   3. 模式A 仅靠 funcName 精确匹配
 *   4. 模式B/C 靠 fileName（基本名）+ funcName 双字段精确匹配
 *   5. 行号不参与匹配决策，仅用于展示
 *   6. 不满足任何模式的行直接忽略，无内容兜底
 *
 * 模式示例：
 *   A:  funcName - [ERROR]...        → 函数名匹配
 *   B:  [ts][DEBUG] /path/file.cpp L176 Func():...  → 文件名+函数名匹配
 *   C:  funcName- path/file.c L32 [HAL][ERROR]...   → 文件名+函数名匹配
 */

// ═══════════════════════════════════════════════════
//  常量
// ═══════════════════════════════════════════════════

/** 需要关注的异常等级（≥ERROR） */
const CONCERN_LEVELS = new Set(['ERROR', 'ERR', 'FATAL', 'CRITICAL', 'ASSERT', 'PANIC'])

/** 等级匹配正则（用于等级提取与校验） */
const ALL_LEVELS = /\[(INFO|ERROR|ERR|WARNING|WARN|DEBUG|TRACE|FATAL|CRITICAL|VERBOSE|NOTICE|ASSERT)\]/i

/** 代码文件扩展名集合 */
const FILE_EXT = '(?:cpp|cc|cs|hpp|hh|tsx|jsx|mm|go|py|java|ts|js|m|c|h)'

/** 等级枚举串（供各模式正则复用） */
const LV = 'INFO|ERROR|ERR|WARNING|WARN|DEBUG|TRACE|FATAL|CRITICAL|VERBOSE|NOTICE|ASSERT'

// ═══════════════════════════════════════════════════
//  模式正则
// ═══════════════════════════════════════════════════

/**
 * 模式A：funcName - [LEVEL]...
 *
 * 示例：
 *   video_pcie_cancel_process - [ERROR]L649 :[VIDEO] CANCEL
 *   doBeginPage - [INFO][IPSLIB][5266][doBeginPage]...
 *   GLStage::bindGLProgram - [DEBUG]...
 *
 * 捕获：[1]=funcName  [2]=level
 */
const PATTERN_A = new RegExp(`^([\\w:]+)\\s*-\\s*\\[(${LV})\\]`, 'i')

/**
 * 模式B：[ts][LEVEL] filePath L### funcName():
 *
 * 示例：
 *   [   0:35:50.509][DEBUG] /home/.../CViewModelBase.cpp L176 DispatchEvent():...
 *   [   0:20:42.350][INFO]  main/viewmodel/.../CViewModelThread.cpp L44 SendEvent():...
 *
 * 特征：第二个时间戳方括号紧接等级方括号（之间无空格），
 *       等级后跟 文件路径 + L数字 + 函数名()。
 * 捕获：[1]=level  [2]=filePath  [3]=funcName
 */
const PATTERN_B = new RegExp(
  `^\\[[^\\]]*\\]\\[(${LV})\\]\\s+(.+?\\.${FILE_EXT})\\s+L\\d+\\s+(\\w+)\\s*\\(\\)`,
  'i'
)

/**
 * 模式C：funcName- filePath L### ...
 *
 * 示例：
 *   storage_interface_file_dir_access- module/storage/.../storage_dir.c L32 [HAL][ERROR]...
 *
 * 特征：函数名紧贴 -（无空格），- 后跟文件路径 + L数字。
 * 等级出现在文件路径和行号之后（如 [HAL][ERROR]），需额外提取。
 * 捕获：[1]=funcName  [2]=filePath
 */
const PATTERN_C = new RegExp(
  `^([\\w:]+)-\\s+(.+?\\.${FILE_EXT})\\s+L\\d+`,
  'i'
)

// ═══════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════

/** 提取文件基本名（含扩展名），用于两侧比较。例 /a/b/c.cpp → c.cpp */
function fileBaseOf(p: string): string {
  const norm = (p || '').replace(/\\/g, '/')
  const idx = norm.lastIndexOf('/')
  return idx >= 0 ? norm.slice(idx + 1) : norm
}

/** 等级是否满足 ≥ ERROR 的阈值 */
export function isConcernLevel(level?: string): boolean {
  return level !== undefined && CONCERN_LEVELS.has(level.toUpperCase())
}

// ═══════════════════════════════════════════════════
//  解析结果类型
// ═══════════════════════════════════════════════════

export interface ParsedLogLine {
  level: string
  pattern: 'A' | 'B' | 'C'
  /** 函数名（已小写，保留 :: 限定名） */
  funcName: string
  /** 文件名基本名（仅模式B/C有值，含扩展名） */
  fileName: string
  rawLine: string
}

// ═══════════════════════════════════════════════════
//  日志行解析
// ═══════════════════════════════════════════════════

/**
 * 解析一行日志。
 * 按 B → C → A 顺序尝试三种结构模式，首个命中的模式提取字段。
 * 等级不满足 ≥ERROR 或匹配不上任何模式 → 返回 null（忽略该行）。
 */
export function parseLogLine(rawLine: string): ParsedLogLine | null {
  // ── 剥离第一个时间戳 [2026-07-15 10:23:17.372] ──
  const afterTS1 = rawLine.replace(/^\[[^\]]*\]\s*/, '')

  // ── 模式B：第二个时间戳紧贴等级 ──
  const mB = afterTS1.match(PATTERN_B)
  if (mB) {
    const level = mB[1].toUpperCase()
    if (!isConcernLevel(level)) return null
    return {
      level,
      pattern: 'B',
      funcName: mB[3].toLowerCase(),
      fileName: fileBaseOf(mB[2]),
      rawLine,
    }
  }

  // ── 剥离第二个时间戳 [10:20:27.064] ──
  const afterTS = afterTS1.replace(/^\[[^\]]*\]\s*/, '')

  // ── 模式C：funcName- filePath L### ──
  const mC = afterTS.match(PATTERN_C)
  if (mC) {
    const lv = afterTS.match(ALL_LEVELS)
    if (!lv || !isConcernLevel(lv[1])) return null
    return {
      level: lv[1].toUpperCase(),
      pattern: 'C',
      funcName: mC[1].toLowerCase(),
      fileName: fileBaseOf(mC[2]),
      rawLine,
    }
  }

  // ── 模式A：funcName - [LEVEL] ──
  const mA = afterTS.match(PATTERN_A)
  if (mA) {
    const level = mA[2].toUpperCase()
    if (!isConcernLevel(level)) return null
    return {
      level,
      pattern: 'A',
      funcName: mA[1].toLowerCase(),
      fileName: '',
      rawLine,
    }
  }

  return null
}

// ═══════════════════════════════════════════════════
//  候选匹配
// ═══════════════════════════════════════════════════

/**
 * 将解析后的日志行与候选集做确定性匹配。
 * - 模式A：funcName 精确匹配（大小写不敏感）
 * - 模式B/C：fileName（基本名）+ funcName 双字段精确匹配
 */
export function matchLogLineToCandidates(
  parsed: ParsedLogLine,
  candidates: CodeSearchResult[]
): CodeSearchResult | null {
  if (parsed.pattern === 'A') {
    return candidates.find(
      c => (c.functionName || '').toLowerCase() === parsed.funcName
    ) || null
  }

  // 模式 B / C
  const base = parsed.fileName.toLowerCase()
  return candidates.find(c => {
    const cBase = fileBaseOf(c.codeFile?.fileName || '').toLowerCase()
    return cBase === base &&
           (c.functionName || '').toLowerCase() === parsed.funcName
  }) || null
}

// ═══════════════════════════════════════════════════
//  模块日志内容解析
// ═══════════════════════════════════════════════════

/** 解析模块日志 JSON（兼容纯数组 / { codeSearchResults } 包装格式） */
export function parseModuleLogContent(content: string): CodeSearchResult[] {
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed as CodeSearchResult[]
    if (parsed && Array.isArray(parsed.codeSearchResults)) {
      return parsed.codeSearchResults as CodeSearchResult[]
    }
  } catch (e) {
    console.error('Failed to parse module log content:', e)
  }
  return []
}

// ═══════════════════════════════════════════════════
//  批量匹配
// ═══════════════════════════════════════════════════

export interface ModuleMatch {
  candidate: CodeSearchResult
  lines: MatchedLogLine[]
}

/**
 * 将一个模块日志的全部候选与主日志逐行匹配。
 * 每行日志最多归属一个候选（取首个 find() 命中）。
 */
export function matchModuleAgainstLog(
  moduleLog: ModuleLog,
  mainLogLines: string[]
): ModuleMatch[] {
  const candidates = parseModuleLogContent(moduleLog.content)
  if (candidates.length === 0) return []

  const byCandidate = new Map<CodeSearchResult, MatchedLogLine[]>()

  mainLogLines.forEach((raw, idx) => {
    const parsed = parseLogLine(raw)
    if (!parsed) return

    const cand = matchLogLineToCandidates(parsed, candidates)
    if (!cand) return

    if (!byCandidate.has(cand)) byCandidate.set(cand, [])
    byCandidate.get(cand)!.push({
      lineNumber: idx + 1,
      lineText: raw,
      codeText: cand.matchedText,
      codePath: cand.codeFile?.fileName,
      codeLine: cand.line,
      functionName: cand.functionName,
    })
  })

  return Array.from(byCandidate.entries()).map(([candidate, lines]) => ({
    candidate,
    lines,
  }))
}
