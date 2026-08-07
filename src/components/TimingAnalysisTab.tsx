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
          String(cycle.cycleIndex),
          entry.nodeKeyword,
          String(entry.lineNumber),
          entry.timestamp,
          entry.elapsedFromPrevMs !== undefined ? String(entry.elapsedFromPrevMs) : '',
          String(cycle.totalElapsedMs),
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
