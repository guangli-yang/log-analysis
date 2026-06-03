import React, { useState, useRef } from 'react'
import { CodeSearchResult, ModuleLog, MatchSummary, MatchResult, ModuleMapping } from '../types'
import './AnalysisPanel.css'

interface LogMatchPanelProps {
  onClose: () => void
  content: string
  moduleLogs: ModuleLog[]
  onNavigateToError: (line: number) => void
  onShowNotification: (message: string) => void
  onRemoveModuleLog: (id: string) => void
  moduleMappings: ModuleMapping[]
}

const LogMatchPanel: React.FC<LogMatchPanelProps> = ({
  onClose,
  content,
  moduleLogs,
  onNavigateToError,
  onShowNotification,
  onRemoveModuleLog,
  moduleMappings
}) => {
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([])
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [position, setPosition] = useState({ x: window.innerWidth - 470, y: 120 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  const handleToggleModule = (id: string) => {
    setSelectedModuleIds(prev =>
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    )
  }

  const handleSelectAllModules = () => {
    if (selectedModuleIds.length === moduleLogs.length) {
      setSelectedModuleIds([])
    } else {
      setSelectedModuleIds(moduleLogs.map(m => m.id))
    }
  }

  const handleMatch = () => {
    if (selectedModuleIds.length === 0) return

    if (moduleMappings.length === 0) {
      onShowNotification('请先导入模块映射表')
      return
    }

    const selectedModules = moduleLogs.filter(m => selectedModuleIds.includes(m.id))
    const matchResults: MatchResult[] = []
    const matchedCodePaths = new Set<string>()
    const mainLogLines = content.split('\n')

    selectedModules.forEach(moduleLog => {
      let codeSearchResults: CodeSearchResult[] = []

      try {
        const parsed = JSON.parse(moduleLog.content)
        if (Array.isArray(parsed)) {
          codeSearchResults = parsed
        } else if (parsed.codeSearchResults && Array.isArray(parsed.codeSearchResults)) {
          codeSearchResults = parsed.codeSearchResults
        }
      } catch (e) {
        console.error('Failed to parse module log content:', e)
      }

      if (codeSearchResults.length === 0) return

      const allPatterns: Array<{ line: number; staticStr: string; codePath: string }> = codeSearchResults.map(r => ({
        line: r.line,
        staticStr: r.matchedText || '',
        codePath: r.codeFile?.fileName || ''
      }))

      if (allPatterns.length > 0) {
        const matchedLines: Array<{ lineNumber: number; lineText: string }> = []

        mainLogLines.forEach((mainLine, mainIndex) => {
          const mainMatch = mainLine.match(/L(\d+)[:：]?\s*(.*)/)
          if (mainMatch) {
            const mainSourceLine = parseInt(mainMatch[1], 10)
            const mainContent = mainMatch[2].trim()

            const matchedPattern = allPatterns.find(p =>
              p.line === mainSourceLine &&
              p.staticStr.length > 0 &&
              mainContent.toLowerCase().includes(p.staticStr.toLowerCase())
            )

            if (matchedPattern) {
              matchedLines.push({
                lineNumber: mainIndex + 1,
                lineText: mainLine
              })
              if (matchedPattern.codePath) {
                matchedCodePaths.add(matchedPattern.codePath)
              }
            }
          }
        })

        if (matchedLines.length > 0) {
          const dummyCodeResult: CodeSearchResult = {
            codeFile: { fileName: moduleLog.name },
            line: 0,
            functionName: '',
            matchedPattern: '精确匹配',
            matchedText: `共 ${matchedLines.length} 处匹配`
          }
          matchResults.push({
            codeResult: dummyCodeResult,
            moduleLog,
            matchedLines
          })
        }
      }
    })

    if (matchResults.length === 0) {
      onShowNotification('未在日志中找到匹配的模块日志')
      return
    }

    const normalizePath = (p: string) => p.replace(/\\/g, '/')

    const isPathSegmentMatch = (codePath: string, mappingPath: string): boolean => {
      const normalizedCodePath = normalizePath(codePath)
      const normalizedMappingPath = normalizePath(mappingPath)

      const index = normalizedCodePath.indexOf(normalizedMappingPath)
      if (index === -1) return false

      const before = index === 0 ? '/' : normalizedCodePath[index - 1]
      const afterIndex = index + normalizedMappingPath.length
      const after = afterIndex >= normalizedCodePath.length ? '/' : normalizedCodePath[afterIndex]

      const beforeValid = before === '/' || before === '\\'
      const afterValid = after === '/' || after === '\\' || afterIndex >= normalizedCodePath.length

      return beforeValid && afterValid
    }

    const mappingContactInfo: Array<{ moduleName: string; contactName: string }> = []
    const usedMappings = new Set<string>()
    matchedCodePaths.forEach(codePath => {
      const mapping = moduleMappings.find(m => isPathSegmentMatch(codePath, m.codePath))
      if (mapping && !usedMappings.has(mapping.codePath)) {
        usedMappings.add(mapping.codePath)
        mappingContactInfo.push({
          moduleName: mapping.moduleName,
          contactName: mapping.contactName
        })
      }
    })

    if (mappingContactInfo.length === 0) {
      onShowNotification('匹配到的文件路径未找到对应的模块负责人，请检查映射表配置')
      return
    }

    const summary: MatchSummary = {
      totalMatches: matchResults.reduce((sum, r) => sum + r.matchedLines.length, 0),
      moduleCount: selectedModules.length,
      patternCount: 1,
      results: matchResults,
      contactInfo: mappingContactInfo
    }

    setMatchSummary(summary)
  }

  const handleClearMatchResults = () => {
    setMatchSummary(null)
    setExpandedItems(new Set())
  }

  const handleCopyResults = async () => {
    if (!matchSummary) return

    const lines: string[] = []
    lines.push('📋 快速分析结果')
    lines.push('')
    lines.push(`🕐 分析时间：${new Date().toLocaleString()}`)
    lines.push('')
    lines.push('👥 异常负责人：')
    matchSummary.contactInfo.forEach(info => {
      lines.push(`  • ${info.contactName}（${info.moduleName}）`)
    })
    lines.push('')
    lines.push('📊 统计信息：')
    lines.push(`  • 模块数量：${matchSummary.moduleCount}`)
    lines.push(`  • 匹配总数：${matchSummary.totalMatches}`)
    lines.push('')
    lines.push('═══════════════════════════════════════')

    const groupedResults = matchSummary.results.reduce((acc, result) => {
      const moduleName = result.moduleLog.name
      if (!acc[moduleName]) {
        acc[moduleName] = []
      }
      acc[moduleName].push(result)
      return acc
    }, {} as Record<string, MatchResult[]>)

    Object.entries(groupedResults).forEach(([moduleName, results]) => {
      const totalMatches = results.reduce((sum, r) => sum + r.matchedLines.length, 0)
      lines.push('')
      lines.push(`📦 模块：${moduleName}（共${totalMatches}处匹配）`)

      const patternGroups: Record<string, MatchResult[]> = {}
      results.forEach(r => {
        const patternName = r.codeResult.matchedPattern
        if (!patternGroups[patternName]) {
          patternGroups[patternName] = []
        }
        patternGroups[patternName].push(r)
      })

      Object.values(patternGroups).forEach(group => {
        lines.push(`  🔍 ${group[0].codeResult.matchedPattern}`)
        group.forEach(r => {
          const codeText = r.codeResult.matchedText || '(无代码文本)'
          const matchCount = r.matchedLines.length
          const lineNumbers = r.matchedLines.map(l => l.lineNumber).join(', ')
          lines.push(`    • ${codeText}（${matchCount}处）`)
          lines.push(`      日志行：${lineNumbers}`)
        })
      })
    })

    lines.push('')
    lines.push('═══════════════════════════════════════')
    lines.push('')
    lines.push('📝 日志行详情：')

    Object.entries(groupedResults).forEach(([moduleName, results]) => {
      results.forEach(r => {
        const codeText = r.codeResult.matchedText || '(无代码文本)'
        lines.push('')
        lines.push(`【${moduleName}】${codeText}`)
        r.matchedLines.forEach(l => {
          lines.push(`  行${l.lineNumber}: ${l.lineText.trim()}`)
        })
      })
    })

    lines.push('')
    lines.push('═══════════════════════════════════════')
    lines.push('由 Log Analyzer 生成')

    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      onShowNotification('结果已复制到剪贴板')
    } catch (err) {
      console.error('复制失败:', err)
      onShowNotification('复制失败，请手动复制')
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.analysis-header')) {
      setIsDragging(true)
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      }
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  return (
    <div
      ref={panelRef}
      className="analysis-panel"
      style={{ left: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      <div className="analysis-header">
        <span className="analysis-title">🔗 快速分析</span>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="analysis-content">
        {matchSummary ? (
          <div className="match-results">
            <div className="match-summary-header">
              <div className="match-summary-title">匹配结果总结</div>
              <div className="match-summary-actions">
                <button className="copy-results-btn" onClick={handleCopyResults} title="复制结果">
                  📋 复制
                </button>
                <button className="clear-results-btn" onClick={handleClearMatchResults}>
                  ✕ 清除
                </button>
              </div>
            </div>
            <div className="match-summary-stats">
              <div className="contact-summary">
                <span className="contact-summary-text">
                  发现异常，请联系以下{' '}
                  {matchSummary.contactInfo.map((info, index) => (
                    <span key={index} className="contact-item-inline">
                      {info.contactName}
                      <span className="contact-module">（{info.moduleName}）</span>
                      {index < matchSummary.contactInfo.length - 1 && '，'}
                    </span>
                  ))}
                  <span> 人员</span>
                </span>
              </div>
            </div>
            <div className="match-results-list">
              {Object.entries(
                matchSummary.results.reduce((acc, result) => {
                  const moduleName = result.moduleLog.name
                  if (!acc[moduleName]) {
                    acc[moduleName] = {
                      moduleLog: result.moduleLog,
                      patterns: {}
                    }
                  }
                  const patternName = result.codeResult.matchedPattern
                  if (!acc[moduleName].patterns[patternName]) {
                    acc[moduleName].patterns[patternName] = {
                      patternName,
                      items: []
                    }
                  }
                  acc[moduleName].patterns[patternName].items.push(result)
                  return acc
                }, {} as Record<string, { moduleLog: ModuleLog; patterns: Record<string, { patternName: string; items: MatchResult[] }> }>)
              ).map(([moduleName, moduleData]) => (
                <div key={moduleName} className="match-module-group">
                  <div className="match-module-header">
                    <span className="match-module-icon">📦</span>
                    <span className="match-module-name">{moduleName}</span>
                    <span className="match-module-count">
                      ({moduleData.patterns && Object.values(moduleData.patterns).reduce((sum, p) => sum + p.items.reduce((s, i) => s + i.matchedLines.length, 0), 0)}处匹配)
                    </span>
                  </div>
                  <div className="match-module-content">
                    {Object.values(moduleData.patterns || {}).map((pattern, pIndex) => (
                      <div key={pIndex} className="match-pattern-group">
                        <div className="match-pattern-header">
                          <span className="match-pattern-icon">🔍</span>
                          <span className="match-pattern-name">{pattern.patternName}</span>
                          <span className="match-pattern-count">
                            ({pattern.items.reduce((sum, item) => sum + item.matchedLines.length, 0)}处)
                          </span>
                        </div>
                        <div className="match-pattern-items">
                          {pattern.items.map((item, itemIndex) => {
                            const itemKey = `${moduleName}-${pattern.patternName}-${itemIndex}`
                            const isExpanded = expandedItems.has(itemKey)
                            return (
                              <div key={itemIndex} className="match-code-item">
                                <div
                                  className="match-code-header"
                                  onClick={() => {
                                    const newExpanded = new Set(expandedItems)
                                    if (isExpanded) {
                                      newExpanded.delete(itemKey)
                                    } else {
                                      newExpanded.add(itemKey)
                                    }
                                    setExpandedItems(newExpanded)
                                  }}
                                >
                                  <span className={`match-expand-icon ${isExpanded ? 'expanded' : ''}`}>
                                    {isExpanded ? '▼' : '▶'}
                                  </span>
                                  <div className="match-code-text">
                                    代码: {item.codeResult.matchedText}
                                  </div>
                                  <span className="match-code-count">
                                    {item.matchedLines.length}处
                                  </span>
                                </div>
                                {isExpanded && (
                                  <div className="match-code-lines">
                                    {item.matchedLines.map((line, lineIndex) => (
                                      <span
                                        key={lineIndex}
                                        className="match-line-tag"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onNavigateToError(line.lineNumber - 1)
                                          onShowNotification(`已跳转到行 ${line.lineNumber}`)
                                        }}
                                      >
                                        行{line.lineNumber}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="match-info">
              已导入 {moduleLogs.length} 个模块日志
              {moduleMappings.length > 0 && (
                <span className="mapping-info"> | 已加载 {moduleMappings.length} 条映射</span>
              )}
            </div>
            <div className="module-list-actions">
              {moduleLogs.length > 0 && (
                <button className="select-all-btn" onClick={handleSelectAllModules}>
                  {selectedModuleIds.length === moduleLogs.length ? '取消全选' : '全选'}
                </button>
              )}
            </div>
            {moduleLogs.length > 0 ? (
              <div className="module-list">
                {moduleLogs.map(module => (
                  <div
                    key={module.id}
                    className={`module-item ${selectedModuleIds.includes(module.id) ? 'selected' : ''}`}
                    onClick={() => handleToggleModule(module.id)}
                  >
                    <div className="module-checkbox">
                      {selectedModuleIds.includes(module.id) ? '✓' : ''}
                    </div>
                    <div className="module-info">
                      <div className="module-name">{module.name}</div>
                      <div className="module-meta">
                        {module.lineCount} 行 | {new Date(module.importedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      className="remove-module-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveModuleLog(module.id)
                        setSelectedModuleIds(prev => prev.filter(id => id !== module.id))
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-results">点击上方按钮导入模块日志</div>
            )}
            {selectedModuleIds.length > 0 ? (
              <button className="analyze-btn match-btn" onClick={handleMatch}>
                🔍 开始匹配 {selectedModuleIds.length > 1 ? `(${selectedModuleIds.length} 个模块)` : ''}
              </button>
            ) : (
              <div className="match-hint">
                {moduleLogs.length > 0 ? '请先选择要搜索的模块' : '请导入模块日志'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default LogMatchPanel