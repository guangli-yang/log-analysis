import React, { useState } from 'react'
import { CodeSearchPattern, CodeSearchResult, AIConfig } from '../types'
import './CodeSearchPanel.css'

interface CodeSearchPanelProps {
  results: CodeSearchResult[]
  onSearch: () => void
  onOnlineSearch: (folderPath: string) => void
  isSearching: boolean
  aiConfig?: AIConfig
  onExport?: () => void
  onImport?: () => void
  onClose?: () => void
}

type SearchMode = 'offline' | 'online'

const CodeSearchPanel: React.FC<CodeSearchPanelProps> = ({
  results,
  onSearch,
  onOnlineSearch,
  isSearching,
  aiConfig,
  onExport,
  onImport,
  onClose
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [searchMode, setSearchMode] = useState<SearchMode>('offline')

  const handleSearchClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (searchMode === 'offline') {
      onSearch()
    } else {
      if (!aiConfig?.apiKey || !aiConfig?.apiUrl) {
        alert('在线模式需要配置 AI API，请先在设置中配置 API 地址和 Key')
        return
      }
      onOnlineSearch('')
    }
  }

  return (
    <div className={`code-search-panel ${!isExpanded ? 'collapsed' : ''}`}>
      <div className="code-search-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="code-search-title">
          📄 代码日志检索
          {results.length > 0 && (
            <span className="result-count">{results.length}</span>
          )}
        </span>
        <div className="code-search-header-actions">
          <div className="search-mode-selector">
            <button
              className={`mode-btn ${searchMode === 'offline' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setSearchMode('offline')
              }}
              title="离线模式：基于正则表达式检索"
            >
              离线
            </button>
            <button
              className={`mode-btn ${searchMode === 'online' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setSearchMode('online')
              }}
              title="在线模式：调用 AI 模型检索"
            >
              在线
            </button>
          </div>
          <button
            className="search-btn"
            onClick={handleSearchClick}
            disabled={isSearching}
            title={searchMode === 'offline' ? '选择代码目录进行检索' : '调用 AI 模型检索'}
          >
            {isSearching ? '🔄 检索中...' : searchMode === 'offline' ? '🔍 开始检索' : '🤖 AI 检索'}
          </button>
          {onImport && onExport && (
            <div className="code-search-import-export">
              <button className="import-btn" onClick={onImport}>
                📥 导入
              </button>
              <button className="export-btn" onClick={onExport} disabled={results.length === 0}>
                📤 导出
              </button>
            </div>
          )}
          {onClose && (
            <button
              className="close-btn"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              title="关闭"
            >
              ×
            </button>
          )}
          <span className="toggle-icon">{isExpanded ? '▼' : '▲'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="code-search-content">
          {results.length > 0 && (
            <div className="search-results">
              <h4>检索到 {results.length} 个结果</h4>
              <div className="results-list">
                {results.map((result, index) => (
                  <div key={index} className="result-item">
                    <div className="result-file">{result.codeFile.fileName}</div>
                    <div className="result-line">行 {result.line}</div>
                    {result.functionName && (
                      <div className="result-function">函数: {result.functionName}</div>
                    )}
                    <div className="result-pattern">模式: {result.matchedPattern}</div>
                    <div className="result-text">{result.matchedText}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CodeSearchPanel

export const defaultPatterns: CodeSearchPattern[] = [
  { id: '1', name: 'LOGE错误', pattern: 'LOGE\\s*\\(\\s*"[^"]*"', description: 'C/C++ LOGE打印错误', enabled: true },
  { id: '2', name: 'VIDEO_LOGE错误', pattern: 'VIDEO_LOGE\\s*\\(\\s*"[^"]*"', description: 'C/C++ VIDEO_LOGE打印错误', enabled: true }
]