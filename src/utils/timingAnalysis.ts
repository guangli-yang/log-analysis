import { TimingNode, TimingCycle, TimingEntry } from '../types'

// ========== 内部类型 ==========

interface TimedHit {
  nodeIndex: number
  nodeKeyword: string
  lineNumber: number
  timestamp: string
  timestampMs: number
}

// ========== 时间戳提取 ==========

/**
 * 从日志行提取相对运行时长时间戳。
 * 支持两种日志格式：
 *   模式A: [YYYY-MM-DD HH:MM:SS.mmm] [H:MM:SS.mmm] funcName - [LEVEL]...
 *           → 取第2个方括号
 *   模式B: [H:MM:SS.mmm][LEVEL] filePath L### funcName():...
 *           → 取第1个方括号
 *
 * 统一策略：匹配行中第一个符合 \d+:\d+:\d+\.\d+ 格式的方括号
 *           （该格式在两种模式中唯一，不会与日期或日志等级混淆）
 */
function extractTimestamp(line: string): { raw: string; ms: number } | null {
  const tsRegex = /\[\s*(\d+):(\d+):(\d+)\.(\d+)\]/
  const match = line.match(tsRegex)
  if (!match) return null

  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const s = parseInt(match[3], 10)
  const ms = parseInt(match[4], 10)

  return {
    raw: match[0],
    ms: h * 3600000 + m * 60000 + s * 1000 + ms,
  }
}

// ========== 命中扫描 ==========

/**
 * 逐行扫描日志，提取命中节点的时间戳信息
 */
function scanHits(
  lines: string[],
  nodes: TimingNode[]
): TimedHit[] {
  const enabledNodes = nodes.filter(n => n.enabled)
  if (enabledNodes.length === 0) return []

  const hits: TimedHit[] = []

  for (let i = 0; i < lines.length; i++) {
    const ts = extractTimestamp(lines[i])
    if (!ts) continue

    for (let ni = 0; ni < enabledNodes.length; ni++) {
      if (lines[i].toLowerCase().includes(enabledNodes[ni].keyword.toLowerCase())) {
        hits.push({
          nodeIndex: ni,
          nodeKeyword: enabledNodes[ni].keyword,
          lineNumber: i + 1,
          timestamp: ts.raw,
          timestampMs: ts.ms,
        })
        break // 一行只匹配第一个命中的节点
      }
    }
  }

  return hits
}

// ========== 轮次分组 ==========

/**
 * 按轮次分组：遇到第一个节点(t1)开启新轮次
 * - 第一个 t1 之前的命中丢弃
 * - 末尾不完整轮次保留
 */
function groupIntoCycles(
  hits: TimedHit[],
  nodes: TimingNode[]
): TimedHit[][] {
  const enabledNodes = nodes.filter(n => n.enabled)
  if (enabledNodes.length === 0 || hits.length === 0) return []

  const cycles: TimedHit[][] = []
  let currentCycle: TimedHit[] = []
  let foundFirstT1 = false

  for (const hit of hits) {
    if (hit.nodeIndex === 0) {
      // 遇到 t1（第一个节点）
      if (foundFirstT1 && currentCycle.length > 0) {
        cycles.push(currentCycle)
      }
      foundFirstT1 = true
      currentCycle = [hit]
    } else if (foundFirstT1) {
      currentCycle.push(hit)
    }
    // 未遇到第一个 t1 之前：丢弃
  }

  // 保存最后一轮（即使不完整）
  if (foundFirstT1 && currentCycle.length > 0) {
    cycles.push(currentCycle)
  }

  return cycles
}

// ========== 差值计算 ==========

/**
 * 对单轮内节点按时间戳排序后，计算相邻节点耗时
 */
function buildCycleEntries(
  cycleHits: TimedHit[],
  nodes: TimingNode[]
): { entries: TimingEntry[]; isComplete: boolean; missingNodes: string[] } {
  const enabledNodes = nodes.filter(n => n.enabled)

  // 按时间戳排序
  const sorted = [...cycleHits].sort((a, b) => a.timestampMs - b.timestampMs)

  const entries: TimingEntry[] = sorted.map((hit, i) => ({
    nodeIndex: hit.nodeIndex,
    nodeKeyword: hit.nodeKeyword,
    lineNumber: hit.lineNumber,
    timestamp: hit.timestamp,
    timestampMs: hit.timestampMs,
    elapsedFromPrevMs: i > 0 ? hit.timestampMs - sorted[i - 1].timestampMs : undefined,
  }))

  // 检查完整性
  const foundIndices = new Set(sorted.map(h => h.nodeIndex))
  const missingNodes = enabledNodes
    .filter((_n, i) => !foundIndices.has(i))
    .map(n => n.keyword)
  const isComplete = missingNodes.length === 0

  return { entries, isComplete, missingNodes }
}

// ========== 公共 API ==========

/**
 * 完整的耗时分析流程
 * @param content 日志文本内容
 * @param nodes 用户配置的节点列表
 * @returns 按轮次分组的耗时分析结果
 */
export function analyzeTiming(
  content: string,
  nodes: TimingNode[]
): TimingCycle[] {
  const lines = content.split('\n')
  const hits = scanHits(lines, nodes)
  const hitCycles = groupIntoCycles(hits, nodes)

  return hitCycles.map((cycleHits, i) => {
    const { entries, isComplete, missingNodes } = buildCycleEntries(cycleHits, nodes)

    const totalElapsedMs = entries.length >= 2
      ? entries[entries.length - 1].timestampMs - entries[0].timestampMs
      : 0

    return {
      cycleIndex: i + 1,
      nodes: entries,
      totalElapsedMs,
      isComplete,
      missingNodes: missingNodes.length > 0 ? missingNodes : undefined,
    }
  })
}

/**
 * 格式化毫秒为可读字符串
 */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(3)}s`
  const m = Math.floor(ms / 60000)
  const s = ((ms % 60000) / 1000).toFixed(3)
  return `${m}m ${s}s`
}
