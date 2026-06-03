import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { SearchResult, SearchHistory, SearchOptions, SearchTag, SearchHighlight } from '../types'
import AddTagDialog from './AddTagDialog'
import './SearchResultsPanel.css'

interface SearchResultsPanelProps {
  results: SearchResult[]
  currentIndex: number
  searchQuery: string
  searchOptions: SearchOptions
  searchHistory: SearchHistory[]
  searchTags: SearchTag[]
  searchHighlights: SearchHighlight[]
  onNavigate: (index: number) => void
  onSearchHistory: (query: string, options: SearchOptions) => void
  onToggleHistory: () => void
  onAddTag: (name: string, query: string, options: SearchOptions) => void
  onDeleteTag: (id: string) => void
  onTagClick: (tag: SearchTag) => void
  onRemoveHighlight: (query: string, options: SearchOptions) => void
  onClearAllHighlights: () => void
  showHistory: boolean
  fileName?: string
  onCollapse?: () => void
}

const ITEM_HEIGHT = 22
const BUFFER = 10

const SearchResultsPanel: React.FC<SearchResultsPanelProps> = ({
  results,
  currentIndex,
  searchQuery,
  searchOptions,
  searchHistory,
  searchTags,
  searchHighlights,
  onNavigate,
  onSearchHistory,
  onToggleHistory,
  onAddTag,
  onDeleteTag,
  onTagClick,
  onRemoveHighlight,
  onClearAllHighlights,
  showHistory,
  fileName,
  onCollapse
}) => {
  const [showAddTagDialog, setShowAddTagDialog] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [listHeight, setListHeight] = useState(0)

  const totalHeight = results.length * ITEM_HEIGHT

  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER)
  const endIndex = Math.min(results.length - 1, Math.ceil((scrollTop + listHeight) / ITEM_HEIGHT) + BUFFER)

  const visibleResults = useMemo(() => {
    if (results.length < 200) return results.map((r, i) => ({ result: r, index: i }))
    const result = []
    for (let i = startIndex; i <= endIndex; i++) {
      result.push({ result: results[i], index: i })
    }
    return result
  }, [results, startIndex, endIndex])

  useEffect(() => {
    if (listRef.current) {
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          setListHeight(entry.contentRect.height)
        }
      })
      observer.observe(listRef.current)
      setListHeight(listRef.current.clientHeight)
      return () => observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (currentIndex >= 0 && listRef.current) {
      const targetScroll = currentIndex * ITEM_HEIGHT - listHeight / 2 + ITEM_HEIGHT / 2
      listRef.current.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' })
    }
  }, [currentIndex, listHeight])

  const handleScroll = useCallback(() => {
    if (listRef.current) {
      setScrollTop(listRef.current.scrollTop)
    }
  }, [])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const highlightMatch = (text: string, query: string, options?: SearchOptions) => {
    if (!query) return text
    
    try {
      let regex: RegExp
      if (options?.useRegex) {
        regex = new RegExp(query, options.caseSensitive ? 'g' : 'gi')
      } else {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = options?.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery
        regex = new RegExp(pattern, options?.caseSensitive ? 'g' : 'gi')
      }
      
      const parts = text.split(regex)
      const matches = text.match(regex) || []
      
      return parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < matches.length && (
            <span className="match-highlight">{matches[i]}</span>
          )}
        </React.Fragment>
      ))
    } catch {
      return text
    }
  }

  return (
    <div className="search-results-panel">
      {searchHighlights.length > 0 && (
        <div className="search-highlights-bar">
          <span className="tags-label">搜索词：</span>
          <div className="tags-list">
            {searchHighlights.map((highlight, index) => (
              <div
                key={index}
                className="search-tag highlight-tag"
                style={{ borderLeftColor: highlight.color, borderLeftWidth: '3px' }}
              >
                <span
                  className="tag-content"
                  style={{ backgroundColor: highlight.color }}
                  title={`搜索: ${highlight.query}`}
                >
                  {highlight.query}
                </span>
                <button
                  className="tag-delete"
                  onClick={() => onRemoveHighlight(highlight.query, highlight.options)}
                  title="移除高亮"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="clear-highlights-btn"
              onClick={onClearAllHighlights}
              title="清除所有搜索词高亮"
            >
              清除全部
            </button>
          </div>
        </div>
      )}
      <div className="search-tags-bar">
        <div className="tags-section">
          <span className="tags-label">快捷搜索：</span>
          <div className="tags-list">
            {searchTags.length === 0 && (
              <span className="no-tags-hint">暂无快捷标签</span>
            )}
            {searchTags.map((tag) => (
              <div key={tag.id} className="search-tag">
                <span
                  className="tag-content"
                  onClick={() => onTagClick(tag)}
                  title={`搜索: ${tag.query}`}
                >
                  {tag.name}
                </span>
                <button
                  className="tag-delete"
                  onClick={() => onDeleteTag(tag.id)}
                  title="删除标签"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
        <button
          className="add-tag-btn"
          onClick={() => setShowAddTagDialog(true)}
          title="添加快捷标签"
        >
          + 添加标签
        </button>
      </div>

      <AddTagDialog
        isVisible={showAddTagDialog}
        currentSearchQuery={searchQuery}
        currentSearchOptions={searchOptions}
        onConfirm={(name, query, options) => {
          onAddTag(name, query, options)
          setShowAddTagDialog(false)
        }}
        onCancel={() => setShowAddTagDialog(false)}
      />

      <div className="results-status-bar">
        <div className="status-info">
          <span className="status-label">搜索结果 -</span>
          <span className="status-match-count">(匹配 {results.length} 次)</span>
          {searchQuery && (
            <span className="status-query">搜索 "{searchQuery}"</span>
          )}
          {fileName && (
            <span className="status-file">
              {fileName} (匹配 {results.length} 次)
            </span>
          )}
        </div>
        <div className="status-nav">
          {results.length > 0 && (
            <>
              <button
                className="nav-btn"
                onClick={() => onNavigate(Math.max(0, currentIndex - 1))}
                disabled={currentIndex <= 0}
                title="上一个"
              >
                ◀
              </button>
              <span className="nav-position">
                {currentIndex + 1} / {results.length}
              </span>
              <button
                className="nav-btn"
                onClick={() => onNavigate(Math.min(results.length - 1, currentIndex + 1))}
                disabled={currentIndex >= results.length - 1}
                title="下一个"
              >
                ▶
              </button>
            </>
          )}
          <button
            className={`history-btn ${showHistory ? 'active' : ''}`}
            onClick={onToggleHistory}
            title="搜索历史"
          >
            📜
          </button>
          <button
            className="collapse-btn"
            onClick={onCollapse}
            title="收起搜索结果面板"
          >
            ▲
          </button>
        </div>
      </div>

      {showHistory && searchHistory.length > 0 && (
        <div className="history-section">
          <div className="history-list">
            {searchHistory.map((item) => (
              <div
                key={item.id}
                className="history-item"
                onClick={() => onSearchHistory(item.query, item.options)}
              >
                <span className="history-query">{item.query}</span>
                <span className="history-meta">
                  <span className="history-time">{formatTime(item.timestamp)}</span>
                  <span className="history-count">搜索 {item.count} 次</span>
                </span>
                {item.options.caseSensitive && (
                  <span className="history-tag">区分大小写</span>
                )}
                {item.options.wholeWord && (
                  <span className="history-tag">全词匹配</span>
                )}
                {item.options.useRegex && (
                  <span className="history-tag">正则表达式</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="results-content" ref={listRef} onScroll={handleScroll}>
        {results.length === 0 ? (
          <div className="no-results">
            {searchQuery ? '未找到匹配结果' : '输入搜索关键词开始搜索'}
          </div>
        ) : results.length < 200 ? (
          <div className="results-list">
            {results.map((result, index) => (
              <div
                key={index}
                className={`result-item ${index === currentIndex ? 'current' : ''}`}
                onClick={() => onNavigate(index)}
                style={{ height: ITEM_HEIGHT }}
              >
                <span className="result-index">{index + 1}:</span>
                <span className="result-line-number">行 {result.line + 1}:</span>
                <span className="result-text">
                  {highlightMatch(result.text, searchQuery, searchOptions)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="results-list" style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ position: 'absolute', top: startIndex * ITEM_HEIGHT, width: '100%' }}>
              {visibleResults.map(({ result, index }) => (
                <div
                  key={index}
                  className={`result-item ${index === currentIndex ? 'current' : ''}`}
                  onClick={() => onNavigate(index)}
                  style={{ height: ITEM_HEIGHT }}
                >
                  <span className="result-index">{index + 1}:</span>
                  <span className="result-line-number">行 {result.line + 1}:</span>
                  <span className="result-text">
                    {highlightMatch(result.text, searchQuery, searchOptions)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchResultsPanel
