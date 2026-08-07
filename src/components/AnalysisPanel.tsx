import React, { useState, useRef, useCallback } from 'react'
import { ErrorKeyword, CoreDumpKeyword, IgnoreKeyword } from '../types'
import { logger, logCategories } from '../utils/logger'
import TimingAnalysisTab from './TimingAnalysisTab'
import './AnalysisPanel.css'

interface AnalysisPanelProps {
  onClose: () => void
  content: string
  errorKeywords: ErrorKeyword[]
  coreDumpKeywords: CoreDumpKeyword[]
  ignoreKeywords: IgnoreKeyword[]
  onNavigateToError: (line: number) => void
  onShowNotification: (message: string) => void
  onOpenLogExtract: () => void
  onFilterComplete: (filteredContent: string, filteredFileName: string, removedCount: number) => void
}

interface DetectedError {
  keyword: string
  description: string
  line: number
  context: string
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  onClose,
  content,
  errorKeywords,
  coreDumpKeywords,
  ignoreKeywords,
  onNavigateToError,
  onShowNotification,
  onOpenLogExtract,
  onFilterComplete
}) => {
  const [activeTab, setActiveTab] = useState<'error' | 'coredump' | 'filter' | 'timing'>('error')
  const [errorResults, setErrorResults] = useState<DetectedError[]>([])
  const [coredumpResults, setCoredumpResults] = useState<Array<{ line: number; keyword: string; text: string }>>([])
  const [showGdbHelp, setShowGdbHelp] = useState(false)
  const [position, setPosition] = useState({ x: window.innerWidth - 470, y: 120 })
  const [isDragging, setIsDragging] = useState(false)
  const [closing, setClosing] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }, [closing, onClose])
  const panelRef = useRef<HTMLDivElement>(null)

  const handleFilterKeywords = () => {
    if (!content || ignoreKeywords.length === 0) {
      onShowNotification('没有可用的过滤关键词')
      return
    }

    logger.info(logCategories.APP, '执行关键词过滤')
    const normalizedContent = content.replace(/\r/g, '')
    const lines = normalizedContent.split('\n')

    const filteredLines = lines.filter(line => {
      return !ignoreKeywords.some(kw =>
        kw.enabled && line.toLowerCase().includes(kw.keyword.toLowerCase())
      )
    })

    const filteredContent = filteredLines.join('\n').replace(/\n{3,}/g, '\n\n')
    const originalLineCount = lines.length
    const filteredLineCount = filteredLines.length
    const removedCount = originalLineCount - filteredLineCount

    const filteredFileName = `过滤后的日志_${Date.now()}.log`
    onFilterComplete(filteredContent, filteredFileName, removedCount)
  }

  const gdbCommands = [
    { cmd: 'bt / bt full', desc: '显示完整堆栈跟踪' },
    { cmd: 'info threads', desc: '显示所有线程信息' },
    { cmd: 'thread apply all bt', desc: '显示所有线程堆栈' },
    { cmd: 'frame N / f N', desc: '切换到第N帧' },
    { cmd: 'info locals', desc: '显示当前帧局部变量' },
    { cmd: 'info args', desc: '显示当前帧参数' },
    { cmd: 'p variable', desc: '打印变量值' },
    { cmd: 'pp variable', desc: '美化打印变量值' },
    { cmd: 'x/100x addr', desc: '查看内存（100个十六进制）' },
    { cmd: 'disassemble', desc: '反汇编当前函数' },
    { cmd: 'watch var', desc: '设置变量监视点' },
    { cmd: 'break func / b func', desc: '在函数处设置断点' },
    { cmd: 'break file:N', desc: '在文件第N行设置断点' },
    { cmd: 'info breakpoints', desc: '显示所有断点' },
    { cmd: 'delete N', desc: '删除第N个断点' },
    { cmd: 'disable/enable N', desc: '禁用/启用第N个断点' },
    { cmd: 'run / r', desc: '启动调试' },
    { cmd: 'continue / c', desc: '继续运行' },
    { cmd: 'next / n', desc: '单步执行（不进入函数）' },
    { cmd: 'step / s', desc: '单步执行（进入函数）' },
    { cmd: 'until N', desc: '执行到第N行' },
    { cmd: 'finish', desc: '执行到当前函数返回' },
    { cmd: 'print var', desc: '打印变量值' },
    { cmd: 'set var=x', desc: '修改变量值' },
    { cmd: 'whatis var', desc: '查看变量类型' },
    { cmd: 'ptype var', desc: '查看类型详细信息' },
    { cmd: 'info frame', desc: '查看当前栈帧信息' },
    { cmd: 'info registers', desc: '查看寄存器值' },
    { cmd: 'backtrace / bt', desc: '查看调用栈' },
    { cmd: 'list', desc: '显示当前代码' },
    { cmd: 'list func', desc: '显示函数代码' },
    { cmd: 'search pattern', desc: '搜索pattern' },
    { cmd: 'set pagination off', desc: '关闭分页' },
    { cmd: 'set print pretty', desc: '美化打印结构体' },
    { cmd: 'set print array on', desc: '打印数组' },
  ]

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

  const handleAnalyzeErrors = () => {
    if (!content) return

    logger.info(logCategories.ANALYSIS, '开始错误分析', `当前文件: ${content.split('\n').length} 行`)
    const errors: DetectedError[] = []
    const lines = content.split('\n')

    lines.forEach((line, lineIndex) => {
      errorKeywords.forEach(({ keyword, description, enabled }) => {
        if (enabled && line.toLowerCase().includes(keyword.toLowerCase())) {
          errors.push({
            keyword,
            description,
            line: lineIndex + 1,
            context: line.trim()
          })
        }
      })
    })

    setErrorResults(errors.slice(0, 200))
    logger.info(logCategories.ANALYSIS, '错误分析完成', `找到 ${errors.length} 个错误，显示前 ${Math.min(errors.length, 200)} 个`)
    if (errors.length > 200) {
      onShowNotification(`找到 ${errors.length} 个错误，结果仅展示前200条`)
    }
  }

  const handleAnalyzeCoredump = () => {
    if (!content) return

    logger.info(logCategories.ANALYSIS, '开始Coredump分析', `当前文件: ${content.split('\n').length} 行`)
    const results: Array<{ line: number; keyword: string; text: string }> = []
    const lines = content.split('\n')

    lines.forEach((line, lineIndex) => {
      coreDumpKeywords.forEach(({ keyword, enabled }) => {
        if (enabled && line.toLowerCase().includes(keyword.toLowerCase())) {
          results.push({
            line: lineIndex + 1,
            keyword,
            text: line.substring(0, 150)
          })
        }
      })
    })

    setCoredumpResults(results.slice(0, 200))
    logger.info(logCategories.ANALYSIS, 'Coredump分析完成', `找到 ${results.length} 个，显示前 ${Math.min(results.length, 200)} 个`)
    if (results.length === 0) {
      onShowNotification('未在日志中找到 Coredump 信息')
    } else if (results.length > 200) {
      onShowNotification(`找到 ${results.length} 个coredump，结果仅展示前200条`)
    } else {
      onShowNotification(`找到 ${results.length} 个coredump`)
    }
  }

  return (
    <div
      ref={panelRef}
      className={`analysis-panel ${closing ? 'closing' : ''}`}
      style={{ left: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      <div className="analysis-header">
        <span className="analysis-title">📊 分析工具</span>
        <button className="close-btn" onClick={handleClose}>×</button>
      </div>

      <div className="analysis-tabs-header">
        <button
          className={`tab-btn ${activeTab === 'error' ? 'active' : ''}`}
          onClick={() => setActiveTab('error')}
        >
          错误分析
        </button>
        <button
          className={`tab-btn ${activeTab === 'filter' ? 'active' : ''}`}
          onClick={() => setActiveTab('filter')}
        >
          🔍 关键词过滤
        </button>
        <button
          className={`tab-btn ${activeTab === 'timing' ? 'active' : ''}`}
          onClick={() => setActiveTab('timing')}
        >
          ⏱ 耗时分析
        </button>
        <div className="tabs-divider"></div>
        <button className="action-btn" onClick={onOpenLogExtract}>
          ✂️ 日志提取
        </button>
        <button className="action-btn" onClick={() => setActiveTab('coredump')}>
          💥 coredump
        </button>
      </div>

      <div className="analysis-content">
        {activeTab === 'error' && (
          <div className="error-analysis">
            <button className="analyze-btn" onClick={handleAnalyzeErrors}>
              ▶ 开始分析
            </button>
            {errorResults.length > 0 ? (
              <div className="error-list">
                {errorResults.map((error, index) => (
                  <div
                    key={index}
                    className="error-item"
                    onClick={() => {
                      logger.info(logCategories.ANALYSIS, '点击错误项', `行 ${error.line}: ${error.keyword}`)
                      onNavigateToError(error.line - 1)
                    }}
                  >
                    <span className="error-line">行 {error.line}</span>
                    <span className="error-keyword">{error.keyword}</span>
                    <span className="error-desc">{error.description}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-results">点击按钮开始分析错误</div>
            )}
          </div>
        )}

        {activeTab === 'filter' && (
          <div className="filter-analysis">
            <div className="filter-info">
              <p>当前配置的过滤关键词：<strong>{ignoreKeywords.filter(k => k.enabled).length}</strong> 个</p>
              <p className="filter-tip">点击下方按钮将根据关键词过滤日志，生成新的日志文件</p>
            </div>
            <button className="analyze-btn" onClick={handleFilterKeywords}>
              ▶ 开始过滤
            </button>
            <div className="filter-keywords-list">
              <h4>已启用的过滤关键词：</h4>
              {ignoreKeywords.filter(k => k.enabled).length > 0 ? (
                ignoreKeywords.filter(k => k.enabled).map((kw, idx) => (
                  <span key={idx} className="filter-keyword-tag">{kw.keyword}</span>
                ))
              ) : (
                <span className="no-keywords">暂无启用的过滤关键词</span>
              )}
            </div>
          </div>
        )}

        {activeTab === 'coredump' && (
          <div className="coredump-analysis">
            <div className="coredump-header">
              <button className="analyze-btn" onClick={handleAnalyzeCoredump}>
                ▶ 开始分析
              </button>
              <button className="gdb-help-btn" onClick={() => setShowGdbHelp(!showGdbHelp)}>
                {showGdbHelp ? '🔼 隐藏GDB指令' : '🔽 显示GDB指令'}
              </button>
            </div>
            {showGdbHelp && (
              <div className="gdb-help">
                <div className="gdb-help-title">GDB 常用指令</div>
                <div className="gdb-commands">
                  {gdbCommands.map((item, index) => (
                    <div key={index} className="gdb-command-item">
                      <code className="gdb-cmd">{item.cmd}</code>
                      <span className="gdb-desc">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {coredumpResults.length > 0 ? (
              <div className="error-list">
                {coredumpResults.map((result, index) => (
                  <div
                    key={index}
                    className="error-item"
                    onClick={() => {
                      logger.info(logCategories.ANALYSIS, '点击Coredump项', `行 ${result.line}: ${result.keyword}`)
                      onNavigateToError(result.line - 1)
                      onShowNotification(`已跳转到行 ${result.line}`)
                    }}
                  >
                    <span className="error-line">行 {result.line}</span>
                    <span className="error-keyword">{result.keyword}</span>
                    <span className="error-desc">{result.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-results">点击按钮开始分析Coredump</div>
            )}
          </div>
        )}

        {activeTab === 'timing' && (
          <TimingAnalysisTab
            content={content}
            onNavigateToError={onNavigateToError}
            onShowNotification={onShowNotification}
          />
        )}
      </div>
    </div>
  )
}

export default AnalysisPanel