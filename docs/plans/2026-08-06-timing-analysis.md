# 耗时分析功能 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在分析面板中新增「⏱ 耗时分析」Tab，用户配置节点关键词后，从日志中提取各节点的相对运行时长时间戳，按轮次分组计算相邻节点耗时差。

**Architecture:** 纯前端计算（无需 Electron 主进程改动），新增一个工具函数模块 `timingAnalysis.ts` 负责时间戳提取/轮次分组/差值计算，新增 `TimingAnalysisTab.tsx` 组件嵌入 `AnalysisPanel`。节点配置通过 `localStorage` 持久化（与 errorKeywords 模式一致）。

**Tech Stack:** React + TypeScript，复用现有 CSS 变量体系（`--bg-primary`, `--accent-color` 等）

---

## 需求摘要

| 项目 | 确认内容 |
|------|---------|
| **配对模式** | 相邻顺序配对（方案A） |
| **时间戳格式** | `[H:MM:SS.mmm]` 相对运行时长 |
| **支持日志格式** | 模式A: `[绝对时间] [相对时长] funcName - [LEVEL]...`（取第2个方括号）、模式B: `[相对时长][LEVEL] filePath L### funcName():...`（取第1个方括号） |
| **轮次起始** | 用户配置的第一个节点自动作为 t1 |
| **轮次规则** | 遇到 t1 开启新轮次、第一个 t1 之前的数据丢弃、末尾不完整轮次保留 |
| **无时间戳行** | 跳过 |
| **节点配置入口** | 耗时分析 Tab 内部内联编辑 |
| **轮次展示** | 默认折叠，点击展开 |
| **操作按钮** | 复制全部、导出CSV、重新分析、点击行号跳转 |
| **持久化** | localStorage（与 errorKeywords 模式一致） |
| **入口** | AnalysisPanel 新增「⏱ 耗时分析」Tab |

---

### Task 1: 新增类型定义

**Files:**
- Modify: `src/types.ts`（末尾追加）

**Step 1: 在 types.ts 末尾追加耗时分析相关类型**

```ts
// ========== 耗时分析 ==========

/** 用户配置的耗时分析节点 */
export interface TimingNode {
  id: string
  keyword: string
  description: string
  enabled: boolean
}

/** 单节点时间记录 */
export interface TimingEntry {
  nodeIndex: number
  nodeKeyword: string
  lineNumber: number
  timestamp: string          // 原始 "0:35:50.509"
  timestampMs: number        // 毫秒值
  elapsedFromPrevMs?: number // 距前一节点耗时（首节点无此字段）
}

/** 单轮提取结果 */
export interface TimingCycle {
  cycleIndex: number
  nodes: TimingEntry[]
  totalElapsedMs: number     // 最后一个节点 - 第一个节点的总耗时
  isComplete: boolean        // 是否包含所有配置的节点
  missingNodes?: string[]    // 缺少的节点关键词列表
}
```

**Step 2: 编译验证**

```bash
npx tsc --noEmit
```

预期：通过

---

### Task 2: 实现时间戳提取 + 轮次分析工具函数

**Files:**
- Create: `src/utils/timingAnalysis.ts`

**Step 1: 创建 timingAnalysis.ts，实现时间戳提取**

```ts
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
  const tsRegex = /\[(\d+):(\d+):(\d+)\.(\d+)\]/
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
```

**Step 2: 实现命中扫描**

```ts
import { TimingNode, TimingCycle, TimingEntry } from '../types'

interface TimedHit {
  nodeIndex: number
  nodeKeyword: string
  lineNumber: number
  timestamp: string
  timestampMs: number
}

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
```

**Step 3: 实现轮次分组**

```ts
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
```

**Step 4: 实现差值计算 + 组装输出**

```ts
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
    .filter((_, i) => !foundIndices.has(i))
    .map(n => n.keyword)
  const isComplete = missingNodes.length === 0

  return { entries, isComplete, missingNodes }
}

/**
 * 完整的耗时分析流程
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
```

**Step 5: 编译验证**

```bash
npx tsc --noEmit
```

预期：通过（types.ts 新增的类型已就绪）

---

### Task 3: 创建 TimingAnalysisTab 组件

**Files:**
- Create: `src/components/TimingAnalysisTab.tsx`
- Create: `src/components/TimingAnalysisTab.css`

**Step 1: 创建 CSS 文件**

`src/components/TimingAnalysisTab.css`:

```css
/* ═══════════════════════════════════════════════
   耗时分析 Tab 样式
   ═══════════════════════════════════════════════ */

.timing-tab {
  padding: 0;
  display: flex;
  flex-direction: column;
}

/* ── 节点配置区 ── */
.timing-config {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.timing-config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.timing-config-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.timing-config-count {
  font-size: 11px;
  color: var(--text-muted);
}

.timing-node-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.timing-node-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-tertiary);
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.timing-node-index {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-color);
  min-width: 24px;
}

.timing-node-index.cycle-start {
  color: var(--warning-color, #ff9800);
}

.timing-node-keyword {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  padding: 4px 8px;
  outline: none;
}

.timing-node-keyword:focus {
  border-color: var(--accent-color);
}

.timing-node-desc {
  width: 120px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  padding: 4px 8px;
  outline: none;
}

.timing-node-desc:focus {
  border-color: var(--accent-color);
}

.timing-node-remove {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 3px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.timing-node-remove:hover {
  background: var(--error-color);
  color: white;
}

.timing-cycle-start-badge {
  font-size: 10px;
  background: var(--warning-color, #ff9800);
  color: #000;
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
  font-weight: 600;
}

.timing-config-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.timing-add-btn {
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: 1px dashed var(--border-color);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.timing-add-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

/* ── 分析按钮区 ── */
.timing-analyze-bar {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.timing-analyze-btn {
  width: 100%;
  padding: 10px 16px;
  background: var(--accent-color);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.timing-analyze-btn:hover {
  background: var(--accent-hover);
}

.timing-analyze-btn:disabled {
  background: var(--bg-tertiary);
  color: var(--text-muted);
  cursor: not-allowed;
}

.timing-no-nodes {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 16px;
}

/* ── 结果区 ── */
.timing-results {
  flex: 1;
  overflow-y: auto;
  max-height: 380px;
  padding: 8px 16px 16px;
}

.timing-results-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.timing-toolbar-btn {
  padding: 5px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.timing-toolbar-btn:hover {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.timing-no-results {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 20px 0;
}

/* ── 轮次卡片 ── */
.timing-cycle-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-bottom: 10px;
  overflow: hidden;
}

.timing-cycle-card:last-child {
  margin-bottom: 0;
}

.timing-cycle-card.incomplete {
  border-left: 3px solid var(--warning-color, #ff9800);
}

.timing-cycle-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  cursor: pointer;
  transition: background 0.2s;
  user-select: none;
}

.timing-cycle-header:hover {
  background: var(--bg-hover);
}

.timing-cycle-expand {
  font-size: 10px;
  color: var(--text-muted);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.timing-cycle-expand.expanded {
  transform: rotate(90deg);
}

.timing-cycle-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.timing-cycle-total {
  font-size: 13px;
  font-weight: 500;
  color: var(--accent-color);
  margin-left: auto;
  flex-shrink: 0;
}

.timing-cycle-warning {
  font-size: 11px;
  color: var(--warning-color, #ff9800);
  margin-left: 8px;
  flex-shrink: 0;
}

/* ── 轮次表格 ── */
.timing-cycle-table {
  border-top: 1px solid var(--border-color);
}

.timing-table-header {
  display: grid;
  grid-template-columns: 1fr 60px 130px 100px;
  gap: 0;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.timing-table-header span {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.timing-table-row {
  display: grid;
  grid-template-columns: 1fr 60px 130px 100px;
  gap: 0;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.2s;
  align-items: center;
}

.timing-table-row:last-child {
  border-bottom: none;
}

.timing-table-row:hover {
  background: var(--bg-hover);
}

.timing-row-node {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
}

.timing-row-line {
  font-size: 11px;
  color: var(--accent-color);
  font-family: 'Consolas', monospace;
  cursor: pointer;
}

.timing-row-line:hover {
  text-decoration: underline;
}

.timing-row-time {
  font-size: 11px;
  color: var(--text-secondary);
  font-family: 'Consolas', monospace;
}

.timing-row-elapsed {
  font-size: 11px;
  color: var(--warning-color, #ff9800);
  font-family: 'Consolas', monospace;
  font-weight: 500;
}

.timing-row-elapsed.first {
  color: var(--text-muted);
  font-weight: 400;
}
```

**Step 2: 创建 TSX 组件**

`src/components/TimingAnalysisTab.tsx`:

```tsx
import React, { useState, useCallback, useMemo } from 'react'
import { TimingNode, TimingCycle } from '../types'
import { analyzeTiming, formatMs } from '../utils/timingAnalysis'
import './TimingAnalysisTab.css'

interface TimingAnalysisTabProps {
  content: string
  onNavigateToError: (line: number) => void
  onShowNotification: (message: string) => void
}

/** 生成唯一 ID */
function genId(): string {
  return `tn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** localStorage key */
const STORAGE_KEY = 'timingNodes'

/** 默认节点 */
function getDefaultNodes(): TimingNode[] {
  return [
    { id: genId(), keyword: '开始进纸', description: '轮次起点', enabled: true },
    { id: genId(), keyword: '预打印', description: '', enabled: true },
    { id: genId(), keyword: '打印开始', description: '', enabled: true },
    { id: genId(), keyword: '打印结束', description: '', enabled: true },
  ]
}

/** 从 localStorage 加载节点配置 */
function loadNodes(): TimingNode[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return getDefaultNodes()
}

/** 保存节点配置到 localStorage */
function saveNodes(nodes: TimingNode[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes))
}

const TimingAnalysisTab: React.FC<TimingAnalysisTabProps> = ({
  content,
  onNavigateToError,
  onShowNotification,
}) => {
  const [nodes, setNodes] = useState<TimingNode[]>(loadNodes)
  const [cycles, setCycles] = useState<TimingCycle[] | null>(null)
  const [expandedCycles, setExpandedCycles] = useState<Set<number>>(new Set())

  const enabledNodes = useMemo(
    () => nodes.filter(n => n.enabled),
    [nodes]
  )

  // 更新节点关键词
  const handleKeywordChange = useCallback((id: string, value: string) => {
    setNodes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, keyword: value } : n)
      saveNodes(next)
      return next
    })
  }, [])

  // 更新节点描述
  const handleDescChange = useCallback((id: string, value: string) => {
    setNodes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, description: value } : n)
      saveNodes(next)
      return next
    })
  }, [])

  // 添加节点
  const handleAddNode = useCallback(() => {
    setNodes(prev => {
      const next = [...prev, { id: genId(), keyword: '', description: '', enabled: true }]
      saveNodes(next)
      return next
    })
  }, [])

  // 删除节点
  const handleRemoveNode = useCallback((id: string) => {
    setNodes(prev => {
      const next = prev.filter(n => n.id !== id)
      saveNodes(next)
      return next
    })
  }, [])

  // 开始分析
  const handleAnalyze = useCallback(() => {
    if (enabledNodes.length === 0) {
      onShowNotification('请至少配置一个节点关键词')
      return
    }
    const emptyKeywords = enabledNodes.filter(n => !n.keyword.trim())
    if (emptyKeywords.length > 0) {
      onShowNotification('节点关键词不能为空')
      return
    }
    const result = analyzeTiming(content, nodes)
    setCycles(result)
    setExpandedCycles(new Set())
    if (result.length === 0) {
      onShowNotification('未在日志中找到匹配的节点')
    } else {
      onShowNotification(`分析完成，共 ${result.length} 轮`)
    }
  }, [content, nodes, enabledNodes, onShowNotification])

  // 重新分析
  const handleReset = useCallback(() => {
    setCycles(null)
    setExpandedCycles(new Set())
  }, [])

  // 折叠/展开
  const toggleCycle = useCallback((index: number) => {
    setExpandedCycles(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  // 复制全部
  const handleCopyAll = useCallback(() => {
    if (!cycles || cycles.length === 0) return
    const lines: string[] = []
    for (const cycle of cycles) {
      lines.push(`第${cycle.cycleIndex}轮 总耗时: ${formatMs(cycle.totalElapsedMs)}${cycle.isComplete ? '' : ' (不完整)'}`)
      if (!cycle.isComplete && cycle.missingNodes) {
        lines.push(`  缺少节点: ${cycle.missingNodes.join(', ')}`)
      }
      lines.push('  节点\t行号\t节点时间\t区间耗时')
      for (const entry of cycle.nodes) {
        const elapsed = entry.elapsedFromPrevMs !== undefined
          ? formatMs(entry.elapsedFromPrevMs)
          : '—'
        lines.push(`  ${entry.nodeKeyword}\tL${entry.lineNumber}\t${entry.timestamp}\t${elapsed}`)
      }
      lines.push('')
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      onShowNotification('已复制全部轮次数据到剪贴板')
    })
  }, [cycles, onShowNotification])

  // 导出 CSV
  const handleExportCSV = useCallback(() => {
    if (!cycles || cycles.length === 0) return
    const rows: string[] = ['轮次,节点,行号,节点时间,区间耗时(ms),总耗时(ms),是否完整']
    for (const cycle of cycles) {
      for (const entry of cycle.nodes) {
        rows.push([
          cycle.cycleIndex,
          entry.nodeKeyword,
          entry.lineNumber,
          entry.timestamp,
          entry.elapsedFromPrevMs ?? '',
          cycle.totalElapsedMs,
          cycle.isComplete ? '是' : '否',
        ].join(','))
      }
    }
    const csv = rows.join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `耗时分析_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    onShowNotification('CSV 已导出')
  }, [cycles, onShowNotification])

  return (
    <div className="timing-tab">
      {/* 节点配置区 */}
      <div className="timing-config">
        <div className="timing-config-header">
          <span className="timing-config-title">节点关键词配置</span>
          <span className="timing-config-count">
            共 {enabledNodes.length} 个节点，① = 轮次起点
          </span>
        </div>

        <div className="timing-node-list">
          {nodes.map((node, index) => (
            <div key={node.id} className="timing-node-item">
              <span className={`timing-node-index ${index === 0 ? 'cycle-start' : ''}`}>
                {index + 1}
              </span>
              {index === 0 && (
                <span className="timing-cycle-start-badge">轮次起点</span>
              )}
              <input
                className="timing-node-keyword"
                value={node.keyword}
                placeholder="关键词（如：开始进纸）"
                onChange={e => handleKeywordChange(node.id, e.target.value)}
              />
              <input
                className="timing-node-desc"
                value={node.description}
                placeholder="描述（可选）"
                onChange={e => handleDescChange(node.id, e.target.value)}
              />
              <button
                className="timing-node-remove"
                onClick={() => handleRemoveNode(node.id)}
                title="删除节点"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="timing-config-actions">
          <button className="timing-add-btn" onClick={handleAddNode}>
            + 添加节点
          </button>
        </div>
      </div>

      {/* 分析按钮 */}
      <div className="timing-analyze-bar">
        <button
          className="timing-analyze-btn"
          onClick={handleAnalyze}
          disabled={enabledNodes.length === 0 || !content}
        >
          ▶ 开始分析
        </button>
        {enabledNodes.length === 0 && (
          <div className="timing-no-nodes">请先添加至少一个节点关键词</div>
        )}
      </div>

      {/* 结果区 */}
      <div className="timing-results">
        {cycles === null ? (
          <div className="timing-no-results">点击「开始分析」查看耗时数据</div>
        ) : cycles.length === 0 ? (
          <div className="timing-no-results">未在日志中找到匹配的节点</div>
        ) : (
          <>
            <div className="timing-results-toolbar">
              <button className="timing-toolbar-btn" onClick={handleCopyAll}>
                📋 复制全部
              </button>
              <button className="timing-toolbar-btn" onClick={handleExportCSV}>
                📄 导出CSV
              </button>
              <button className="timing-toolbar-btn" onClick={handleReset}>
                🔄 重新分析
              </button>
            </div>

            {cycles.map(cycle => {
              const isExpanded = expandedCycles.has(cycle.cycleIndex)
              return (
                <div
                  key={cycle.cycleIndex}
                  className={`timing-cycle-card ${!cycle.isComplete ? 'incomplete' : ''}`}
                >
                  <div
                    className="timing-cycle-header"
                    onClick={() => toggleCycle(cycle.cycleIndex)}
                  >
                    <span className={`timing-cycle-expand ${isExpanded ? 'expanded' : ''}`}>
                      ▶
                    </span>
                    <span className="timing-cycle-title">
                      第 {cycle.cycleIndex} 轮
                    </span>
                    <span className="timing-cycle-total">
                      总耗时: {formatMs(cycle.totalElapsedMs)}
                    </span>
                    {!cycle.isComplete && cycle.missingNodes && (
                      <span className="timing-cycle-warning">
                        ⚠ 缺少: {cycle.missingNodes.join(', ')}
                      </span>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="timing-cycle-table">
                      <div className="timing-table-header">
                        <span>节点</span>
                        <span>行号</span>
                        <span>节点时间</span>
                        <span>区间耗时</span>
                      </div>
                      {cycle.nodes.map((entry, i) => (
                        <div key={i} className="timing-table-row">
                          <span className="timing-row-node">{entry.nodeKeyword}</span>
                          <span
                            className="timing-row-line"
                            onClick={(e) => {
                              e.stopPropagation()
                              onNavigateToError(entry.lineNumber - 1)
                            }}
                          >
                            L{entry.lineNumber}
                          </span>
                          <span className="timing-row-time">{entry.timestamp}</span>
                          <span className={`timing-row-elapsed ${i === 0 ? 'first' : ''}`}>
                            {entry.elapsedFromPrevMs !== undefined
                              ? formatMs(entry.elapsedFromPrevMs)
                              : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

export default TimingAnalysisTab
```

**Step 3: 编译验证**

```bash
npx tsc --noEmit
```

预期：通过

---

### Task 4: 在 AnalysisPanel 中集成耗时分析 Tab

**Files:**
- Modify: `src/components/AnalysisPanel.tsx`

**Step 1: 导入 TimingAnalysisTab**

在文件顶部 import 区域添加：

```tsx
import TimingAnalysisTab from './TimingAnalysisTab'
```

**Step 2: 扩展 activeTab 类型**

将第 36 行的 state 类型从 `'error' | 'coredump' | 'filter'` 改为：

```tsx
const [activeTab, setActiveTab] = useState<'error' | 'coredump' | 'filter' | 'timing'>('error')
```

**Step 3: 在 Tab 栏添加耗时分析按钮**

在第 231-232 行（`关键词过滤` Tab 按钮之后）添加：

```tsx
        <button
          className={`tab-btn ${activeTab === 'timing' ? 'active' : ''}`}
          onClick={() => setActiveTab('timing')}
        >
          ⏱ 耗时分析
        </button>
```

**Step 4: 在 analysis-content 区域添加 Tab 内容**

在第 339 行（`coredump` Tab 内容的 `)}` 闭合之后，`</div>` (analysis-content) 之前）添加：

```tsx
        {activeTab === 'timing' && (
          <TimingAnalysisTab
            content={content}
            onNavigateToError={onNavigateToError}
            onShowNotification={onShowNotification}
          />
        )}
```

**Step 5: 编译验证**

```bash
npx tsc --noEmit
```

预期：通过

---

### Task 5: 整体编译验证

**Step 1: 渲染进程编译**

```bash
npx tsc --noEmit
```

预期：通过

**Step 2: Electron 主进程编译**

```bash
npx tsc -p electron/tsconfig.json
```

预期：通过（本次改动不涉及主进程，应与之前一致）

---

### 涉及文件汇总

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `src/types.ts` | 新增 `TimingNode`, `TimingEntry`, `TimingCycle` |
| 新建 | `src/utils/timingAnalysis.ts` | 核心算法：时间戳提取 + 轮次分组 + 差值计算 |
| 新建 | `src/components/TimingAnalysisTab.tsx` | 耗时分析 Tab UI 组件 |
| 新建 | `src/components/TimingAnalysisTab.css` | 样式 |
| 修改 | `src/components/AnalysisPanel.tsx` | 新增 Tab 入口 + 路由 TimingAnalysisTab |

---

### 未涉及的文件（无需改动）

- `electron/main.ts` — 无需 IPC，纯前端计算
- `electron/preload.ts` — 无新 IPC 方法
- `src/vite-env.d.ts` — 无新 ElectronAPI
- `src/App.tsx` — 组件自包含，无需 App 层传递额外 props
- 其他组件 — 无影响
