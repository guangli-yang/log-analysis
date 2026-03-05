import React, { useState, useEffect, useRef } from 'react'
import { SearchOptions, SearchResult } from '../types'
import './SearchDialog.css'

interface SearchDialogProps {
  isVisible: boolean
  onClose: () => void
  onSearch: (query: string, options: SearchOptions) => void
  searchResults: SearchResult[]
  currentResultIndex: number
  onNavigate: (direction: 'next' | 'prev') => void
  initialQuery?: string
}

const SearchDialog: React.FC<SearchDialogProps> = ({
  isVisible,
  onClose,
  onSearch,
  searchResults,
  currentResultIndex,
  onNavigate,
  initialQuery = ''
}) => {
  const [query, setQuery] = useState(initialQuery)
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false
  })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isVisible])

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter') {
      onSearch(query, options)
    }
  }

  const handleSearch = () => {
    onSearch(query, options)
  }

  const handleCancel = () => {
    onClose()
  }

  if (!isVisible) return null

  return (
    <div className="search-dialog-overlay" onClick={onClose}>
      <div className="search-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="search-dialog-header">
          <h3>🔍 搜索</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="search-dialog-body">
          <div className="search-input-group">
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="输入搜索内容..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button className="search-btn" onClick={handleSearch}>
              搜索
            </button>
          </div>

          <div className="search-options">
            <label className="option-label">
              <input
                type="checkbox"
                checked={options.caseSensitive}
                onChange={(e) => setOptions(prev => ({ ...prev, caseSensitive: e.target.checked }))}
              />
              区分大小写
            </label>
            <label className="option-label">
              <input
                type="checkbox"
                checked={options.wholeWord}
                onChange={(e) => setOptions(prev => ({ ...prev, wholeWord: e.target.checked }))}
              />
              全字匹配
            </label>
            <label className="option-label">
              <input
                type="checkbox"
                checked={options.useRegex}
                onChange={(e) => setOptions(prev => ({ ...prev, useRegex: e.target.checked }))}
              />
              正则表达式
            </label>
          </div>

          {searchResults.length > 0 && (
            <div className="search-results-info">
              <div className="results-count">
                找到 {searchResults.length.toLocaleString()} 个匹配
                {currentResultIndex >= 0 && (
                  <span className="current-position">
                    (当前: {currentResultIndex + 1}/{searchResults.length})
                  </span>
                )}
              </div>
              
              <div className="search-nav-buttons">
                <button
                  className="nav-btn"
                  onClick={() => onNavigate('prev')}
                  title="上一个 (Shift+Enter)"
                >
                  ↑ 上一个
                </button>
                <button
                  className="nav-btn"
                  onClick={() => onNavigate('next')}
                  title="下一个 (Enter)"
                >
                  下一个 ↓
                </button>
              </div>
            </div>
          )}

          {query && searchResults.length === 0 && (
            <div className="no-results">
              未找到匹配项
            </div>
          )}

          <div className="search-dialog-footer">
            <button className="cancel-btn" onClick={handleCancel}>
              取消 (Esc)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchDialog
