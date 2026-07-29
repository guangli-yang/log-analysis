import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  ModuleLog,
  MatchSummary,
  ModuleMapping,
  FolderFileItem,
  FolderAnalysisFileResult,
  LogMatchMode,
  PerFileStatus,
  PersonGroup
} from '../types'
import { buildMatchSummary, buildPersonGroups, buildPersonText, runBatchAnalysis } from '../utils/folderAnalysis'
import ThinkingOverlay from './ThinkingOverlay'
import LogFileSelectionDialog from './LogFileSelectionDialog'
import FolderAnalysisProgress from './FolderAnalysisProgress'
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

interface FileProgressInfo {
  fileName: string
  status: PerFileStatus
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
  // ── 模式 ──
  const [mode, setMode] = useState<LogMatchMode>('single')

  // ── 单文件模式状态 ──
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([])
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null)
  const [isMatching, setIsMatching] = useState(false)
  const [singleResultHeld, setSingleResultHeld] = useState<MatchSummary | null>(null)

  // ── 批量模式状态 ──
  const [batchFolderPath, setBatchFolderPath] = useState<string>('')
  const [batchFiles, setBatchFiles] = useState<FolderFileItem[]>([])
  const [batchFileResults, setBatchFileResults] = useState<Map<string, FolderAnalysisFileResult>>(new Map())
  const [batchAnalyzedCount, setBatchAnalyzedCount] = useState(0)
  const [batchCumulativeMatches, setBatchCumulativeMatches] = useState(0)
  const [batchCumulativeModules, setBatchCumulativeModules] = useState(0)

  // ── 批量模式 UI 状态 ──
  const [showFileSelection, setShowFileSelection] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false)
  const [progressFiles, setProgressFiles] = useState<FileProgressInfo[]>([])
  const [progressCurrentIndex, setProgressCurrentIndex] = useState(0)
  const cancelledRef = useRef(false)
  const autoCloseTimerRef = useRef<number | null>(null)

  // ── 批量结果浏览 ──
  const [currentViewFile, setCurrentViewFile] = useState<string>('')

  // ── 通用 ──
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [position, setPosition] = useState({ x: window.innerWidth - 470, y: 120 })
  const [isDragging, setIsDragging] = useState(false)
  const [closing, setClosing] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)

  // ── 关闭 ──
  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }, [closing, onClose])

  // ── 面板关闭时清理计时器 ──
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current)
      }
    }
  }, [])

  // ── 当前显示的 MatchSummary ──
  const displaySummary = mode === 'single'
    ? matchSummary
    : (currentViewFile && batchFileResults.has(currentViewFile)
      ? batchFileResults.get(currentViewFile)!.matchSummary
      : null)

  // ═══════════════════════════════════════════════
  //  单文件模式
  // ═══════════════════════════════════════════════

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

  const handleMatch = async () => {
    if (selectedModuleIds.length === 0) return

    if (moduleMappings.length === 0) {
      onShowNotification('请先导入模块映射表')
      return
    }

    setIsMatching(true)
    await new Promise(resolve => setTimeout(resolve, 20))

    try {
      const selectedModules = moduleLogs.filter(m => selectedModuleIds.includes(m.id))
      const mainLogLines = content.split('\n')
      const summary = buildMatchSummary(selectedModules, mainLogLines, moduleMappings)

      if (!summary || summary.results.length === 0) {
        onShowNotification('未在日志中找到匹配的模块日志')
        return
      }

      if (summary.contactInfo.length === 0) {
        onShowNotification('匹配到的文件路径未找到对应的模块负责人，请检查映射表配置')
        return
      }

      setMatchSummary(summary)
    } finally {
      setIsMatching(false)
    }
  }

  const handleClearMatchResults = () => {
    setMatchSummary(null)
    setSingleResultHeld(null)
    setExpandedItems(new Set())
  }

  // ═══════════════════════════════════════════════
  //  批量模式 — 导入文件夹
  // ═══════════════════════════════════════════════

  const handleImportFolder = async () => {
    try {
      const result = await window.electronAPI.selectLogFolder()
      if (!result) return
      setBatchFolderPath(result.folderPath)
      setBatchFiles(result.files)
      setShowFileSelection(true)
    } catch (err) {
      console.error('导入文件夹失败:', err)
    }
  }

  const handleFileSelectionConfirm = (selectedFiles: FolderFileItem[]) => {
    setShowFileSelection(false)
    if (selectedFiles.length === 0) return

    // 前置检查
    if (moduleLogs.length === 0) {
      if (!window.confirm('当前项目没有模块日志数据，分析结果将全部为空。是否继续？')) return
    }
    if (moduleMappings.length === 0) {
      if (!window.confirm('当前项目没有模块映射表，分析结果不含负责人信息。是否继续？')) return
    }

    // 切换到批量模式
    setMode('batch')
    // 将当前单文件结果暂存
    if (matchSummary) {
      setSingleResultHeld(matchSummary)
    }

    // 初始化进度
    const initialProgress: FileProgressInfo[] = selectedFiles.map(f => ({
      fileName: f.fileName,
      status: 'waiting'
    }))
    setProgressFiles(initialProgress)
    setProgressCurrentIndex(0)
    setShowProgress(true)
    setIsBatchAnalyzing(true)
    setBatchAnalyzedCount(0)
    setBatchCumulativeMatches(0)
    setBatchCumulativeModules(0)
    setBatchFileResults(new Map())
    cancelledRef.current = false

    // 启动批量分析
    runBatchAnalysis({
      folderPath: batchFolderPath,
      files: selectedFiles.map(f => ({ fileName: f.fileName, filePath: f.filePath, supported: f.supported })),
      moduleLogs,
      moduleMappings,
      onProgress: (fileIndex, _total, status, currentFile, cumMatches, cumModules) => {
        setProgressCurrentIndex(fileIndex)
        setBatchCumulativeMatches(cumMatches)
        setBatchCumulativeModules(cumModules)
        setProgressFiles(prev => prev.map(f =>
          f.fileName === currentFile ? { ...f, status } : f
        ))
      },
      onFileDone: (fileResult) => {
        setBatchFileResults(prev => {
          const next = new Map(prev)
          next.set(fileResult.fileName, fileResult)
          return next
        })
        setBatchAnalyzedCount(prev => prev + 1)
      },
      cancelledRef
    }).then(() => {
      setIsBatchAnalyzing(false)

      if (cancelledRef.current) {
        const doneCount = batchFileResults.size
        onShowNotification(`已取消，已完成 ${doneCount}/${progressFiles.length} 个文件`)
        setShowProgress(true) // 保留进度面板
      } else {
        // 分析完成，3秒后自动关闭进度面板
        autoCloseTimerRef.current = window.setTimeout(() => {
          setShowProgress(false)
        }, 3000)
        const results = batchFileResults
        const count = results.size
        onShowNotification(`已完成 ${count} 个文件分析，结果文件保存在 ${batchFolderPath} 目录下`)
      }
    })
  }

  const handleCancelBatch = () => {
    cancelledRef.current = true
  }

  const handleOpenResultFile = (fileName: string) => {
    const fr = batchFileResults.get(fileName)
    if (fr) {
      onShowNotification(`结果文件：${fr.resultFilePath}`)
    }
  }

  const handleCopyBatchCurrentFileResult = async () => {
    if (personGroups.length === 0) return
    const text = buildPersonText(personGroups)
    try {
      await navigator.clipboard.writeText(text)
      onShowNotification('当前文件结果已复制到剪贴板')
    } catch {
      onShowNotification('复制失败，请手动复制')
    }
  }

  // ═══════════════════════════════════════════════
  //  拖拽
  // ═══════════════════════════════════════════════
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.analysis-header')) {
      setIsDragging(true)
      dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y })
    }
  }

  const handleMouseUp = () => { setIsDragging(false) }

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

  const personGroups: PersonGroup[] = displaySummary
    ? buildPersonGroups(displaySummary, moduleMappings)
    : []

  // ═══════════════════════════════════════════════
  //  渲染：匹配结果详情（按人分组）
  // ═══════════════════════════════════════════════
  const renderMatchResults = () => {
    if (personGroups.length === 0) return null

    return (
      <div className="match-results">
        <div className="match-summary-header">
          <div className="match-summary-title">匹配结果总结</div>
          <div className="match-summary-actions">
            <button className="copy-results-btn" onClick={handleCopyResults} title="复制结果">
              📋 复制
            </button>
            {mode === 'single' && (
              <button className="clear-results-btn" onClick={handleClearMatchResults}>
                ✕ 清除
              </button>
            )}
          </div>
        </div>

        {/* ── 负责人概览 ── */}
        <div className="person-overview">
          {personGroups.map(g => (
            <div key={g.contactName} className="person-overview-card">
              <span className="person-overview-icon">👤</span>
              <span className="person-overview-name">{g.contactName}</span>
              <span className="person-overview-stat">
                {g.totalMatches} 处错误（{g.itemCount} 个文件·函数）
              </span>
            </div>
          ))}
        </div>

        {/* ── 按人分组详细结果 ── */}
        <div className="person-results-list">
          {personGroups.map(g => (
            <div key={g.contactName} className="person-group">
              <div className="person-header">
                <span className="person-header-icon">👤</span>
                <span className="person-header-name">{g.contactName}</span>
                <span className="person-header-count">{g.totalMatches} 处错误</span>
              </div>
              <div className="person-items">
                {g.items.map((item, idx) => {
                  const itemKey = `${g.contactName}-${item.fileName}-${item.functionName}-${idx}`
                  const isExpanded = expandedItems.has(itemKey)
                  return (
                    <div key={itemKey} className="person-item">
                      <div
                        className="person-item-header"
                        onClick={() => {
                          const next = new Set(expandedItems)
                          if (isExpanded) next.delete(itemKey)
                          else next.add(itemKey)
                          setExpandedItems(next)
                        }}
                      >
                        <span className={`match-expand-icon ${isExpanded ? 'expanded' : ''}`}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                        <div className="person-item-info">
                          <span className="person-item-file">{item.fileName}</span>
                          <span className="person-item-sep">·</span>
                          <span className="person-item-func">{item.functionName}</span>
                        </div>
                        <span className="person-item-count">{item.matchCount}处</span>
                      </div>
                      {isExpanded && (
                        <div className="person-item-lines">
                          {item.matchedLines.map((l, li) => (
                            <div
                              key={li}
                              className="person-line-item"
                              onClick={(e) => {
                                e.stopPropagation()
                                onNavigateToError(l.lineNumber - 1)
                                onShowNotification(`已跳转到行 ${l.lineNumber}`)
                              }}
                            >
                              <span className="person-line-num">行 {l.lineNumber}</span>
                              <span className="person-line-text">{l.lineText.trim()}</span>
                            </div>
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
    )
  }

  // ═══════════════════════════════════════════════
  //  复制结果
  // ═══════════════════════════════════════════════
  const handleCopyResults = async () => {
    if (personGroups.length === 0) return
    const text = buildPersonText(personGroups)
    try {
      await navigator.clipboard.writeText(text)
      onShowNotification('结果已复制到剪贴板')
    } catch {
      onShowNotification('复制失败，请手动复制')
    }
  }

  // ─ 批量结果：已完成文件列表（供下拉） ─
  const completedFiles = Array.from(batchFileResults.entries())
    .filter(([, r]) => r.success && r.matchSummary)
    .map(([name, r]) => ({ name, matchCount: r.matchSummary!.totalMatches }))

  // ═══════════════════════════════════════════════
  //  渲染
  // ═══════════════════════════════════════════════
  return (
    <>
      <div
        ref={panelRef}
        className={`analysis-panel ${closing ? 'closing' : ''}`}
        style={{ left: position.x, top: position.y, width: 460 }}
        onMouseDown={handleMouseDown}
      >
        <div className="analysis-header">
          <span className="analysis-title">🔗 快速分析</span>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        {/* ── Tab 模式切换 ── */}
        <div className="mode-tab-bar">
          <button
            className={`mode-tab ${mode === 'single' ? 'active' : ''}`}
            onClick={() => {
              setMode('single')
              if (singleResultHeld) setMatchSummary(singleResultHeld)
              setCurrentViewFile('')
            }}
          >
            📄 单文件分析
          </button>
          <button
            className={`mode-tab ${mode === 'batch' ? 'active' : ''}`}
            onClick={() => setMode('batch')}
          >
            📂 文件夹批量
          </button>
          <span className="mode-tab-info">
            {mode === 'single'
              ? content ? '分析对象：已加载的日志' : '（未加载日志）'
              : batchFolderPath
                ? `${batchFolderPath}（已分析 ${batchAnalyzedCount} 个文件）`
                : '请选择日志文件夹'
            }
          </span>
        </div>

        {/* ── 批量模式：未导入文件夹时显示入口 ── */}
        {mode === 'batch' && !batchFolderPath && (
          <div className="batch-top-actions">
            <button className="select-all-btn import-folder-btn" onClick={handleImportFolder}>
              📁 导入日志文件夹
            </button>
          </div>
        )}
        {/* ── 批量模式：已导入文件夹时可重新导入 ── */}
        {mode === 'batch' && batchFolderPath && (
          <div className="batch-top-actions">
            <button className="select-all-btn import-folder-btn" onClick={handleImportFolder}>
              📁 重新选择文件夹
            </button>
          </div>
        )}

        <div className="analysis-content">
          {displaySummary ? (
            <>
              {mode === 'batch' && (
                <>
                  {/* ── 批量文件切换 ── */}
                  <div className="batch-file-selector">
                    <label className="batch-file-label">查看文件：</label>
                    <select
                      className="batch-file-select"
                      value={currentViewFile}
                      onChange={e => setCurrentViewFile(e.target.value)}
                    >
                      <option value="">— 选择文件 —</option>
                      {completedFiles.map(f => (
                        <option key={f.name} value={f.name}>
                          📄 {f.name} - {f.matchCount}处匹配
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* ── 批量操作按钮 ── */}
                  <div className="batch-result-actions">
                    <button className="copy-results-btn" onClick={handleCopyBatchCurrentFileResult}>
                      📋 复制当前文件结果
                    </button>
                    {currentViewFile && batchFileResults.has(currentViewFile) && (
                      <button className="copy-results-btn" onClick={() => handleOpenResultFile(currentViewFile)}>
                        📄 在编辑器中打开结果文件
                      </button>
                    )}
                  </div>
                  {/* ── 结果文件路径 ── */}
                  {currentViewFile && batchFileResults.has(currentViewFile) && (
                    <div className="batch-result-path">
                      ✅ 结果文件已保存到：{batchFileResults.get(currentViewFile)!.resultFilePath}
                    </div>
                  )}
                </>
              )}

              {renderMatchResults()}
            </>
          ) : mode === 'single' ? (
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
          ) : (
            <>
              <div className="no-results">
                {completedFiles.length > 0
                  ? `✅ 已完成 ${batchAnalyzedCount} 个文件分析，请在上方下拉选择查看`
                  : '等待批量分析完成...'}
              </div>
            </>
          )}
        </div>
        <ThinkingOverlay show={isMatching} title="正在快速分析…" subtitle="正在匹配日志与代码模块，请稍候" />
      </div>

      {/* ── 文件选择弹窗 ── */}
      {showFileSelection && (
        <LogFileSelectionDialog
          folderPath={batchFolderPath}
          files={batchFiles}
          onConfirm={handleFileSelectionConfirm}
          onCancel={() => setShowFileSelection(false)}
        />
      )}

      {/* ── 进度面板 ── */}
      {showProgress && (
        <FolderAnalysisProgress
          isAnalyzing={isBatchAnalyzing}
          currentIndex={progressCurrentIndex}
          total={progressFiles.length}
          files={progressFiles}
          cumulativeMatches={batchCumulativeMatches}
          cumulativeModules={batchCumulativeModules}
          onCancel={handleCancelBatch}
          onClose={() => setShowProgress(false)}
        />
      )}
    </>
  )
}

export default LogMatchPanel
