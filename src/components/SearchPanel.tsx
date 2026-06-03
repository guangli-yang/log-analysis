import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { SearchOptions, SearchResult } from '../types'
import './SearchPanel.css'

interface SearchPanelProps {
  onSearch: (query: string, options: SearchOptions) => void
  searchResults: SearchResult[]
  currentResultIndex: number
  onNavigate: (direction: 'next' | 'prev') => void
}

export interface SearchPanelRef {
  focus: () => void
  expand: () => void
}

const SearchPanel = forwardRef<SearchPanelRef, SearchPanelProps>(({
  onSearch,
  searchResults,
  currentResultIndex,
  onNavigate
}, ref) => {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false
  })
  const [isExpanded, setIsExpanded] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus()
    },
    expand: () => {
      setIsExpanded(true)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }))

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSearch(query, options)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [query, options, onSearch])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        onNavigate('prev')
      } else {
        onNavigate('next')
      }
    }
  }

  return (
    <div className={`search-panel ${!isExpanded ? 'collapsed' : ''}`}>
      <div className="search-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="search-title">🔍 搜索</span>
        {searchResults.length > 0 && (
          <span className="result-count">{searchResults.length}</span>
        )}
        <span className="toggle-icon">{isExpanded ? '▼' : '▲'}</span>
      </div>
      
      {isExpanded && (
        <div className="search-content">
          <div className="search-input-row">
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
            <div className="search-nav">
              <button
                className="nav-btn"
                onClick={() => onNavigate('prev')}
                disabled={searchResults.length === 0}
                title="上一个 (Shift+Enter)"
              >
                ↑
              </button>
              <button
                className="nav-btn"
                onClick={() => onNavigate('next')}
                disabled={searchResults.length === 0}
                title="下一个 (Enter)"
              >
                ↓
              </button>
            </div>
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
          
          <div className="search-stats">
            {query && (
              <span>
                找到 {searchResults.length.toLocaleString()} 个匹配
                {currentResultIndex >= 0 && searchResults.length > 0 && (
                  <span> (当前: {currentResultIndex + 1}/{searchResults.length})</span>
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

export default SearchPanel