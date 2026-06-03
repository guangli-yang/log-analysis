import React, { useState, useEffect, useRef, useCallback } from 'react'
import { SearchOptions, SearchHistory } from '../types'
import { logger, logCategories } from '../utils/logger'
import './SearchDialog.css'

interface SearchDialogProps {
  isOpen: boolean
  onClose: () => void
  onSearch: (query: string, options: SearchOptions) => void
  onFindNext: () => void
  onFindPrev: () => void
  searchHistory: SearchHistory[]
  currentQuery: string
  searchOptions: SearchOptions
  onOptionsChange: (options: SearchOptions) => void
  resultCount: number
  currentIndex: number
}

const SearchDialog: React.FC<SearchDialogProps> = ({
  isOpen,
  onClose,
  onSearch,
  onFindNext,
  onFindPrev,
  searchHistory,
  currentQuery,
  searchOptions,
  onOptionsChange,
  resultCount,
  currentIndex
}) => {
  const [query, setQuery] = useState(currentQuery)
  const [showHistory, setShowHistory] = useState(false)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isFocused, setIsFocused] = useState(true)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(currentQuery)
  }, [currentQuery, isOpen])

  useEffect(() => {
    if (isOpen) {
      setIsFocused(true)
      setPosition({ x: window.innerWidth / 2 - 240, y: 100 })
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 0)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleFocusIn = (e: FocusEvent) => {
      if (dialogRef.current?.contains(e.target as Node)) {
        setIsFocused(true)
      }
    }

    const handleFocusOut = (e: FocusEvent) => {
      if (!e.relatedTarget || !dialogRef.current?.contains(e.relatedTarget as Node)) {
        setIsFocused(false)
      }
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)

    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        document.body.focus()
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          onFindPrev()
        } else {
          onFindNext()
        }
      } else if (e.key === 'F3') {
        e.preventDefault()
        if (e.shiftKey) {
          onFindPrev()
        } else {
          onFindNext()
        }
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, onFindNext, onFindPrev])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (headerRef.current?.contains(e.target as Node)) {
      e.preventDefault()
      setIsDragging(true)
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      }
    }
  }, [position])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const handleDialogClick = useCallback(() => {
    if (!isFocused && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isFocused])

  const handleClose = () => {
    onClose()
    setTimeout(() => document.body.focus(), 0)
  }

  const handleSearch = () => {
    if (query.trim()) {
      logger.info(logCategories.SEARCH, '在搜索对话框中点击查找', `查询: "${query}"`)
      onSearch(query, searchOptions)
    }
  }

  const handleHistorySelect = (historyItem: SearchHistory) => {
    logger.info(logCategories.SEARCH, '从搜索历史选择', `查询: "${historyItem.query}"`)
    setQuery(historyItem.query)
    onOptionsChange(historyItem.options)
    setShowHistory(false)
    onSearch(historyItem.query, historyItem.options)
  }

  const toggleOption = (key: keyof SearchOptions) => {
    logger.debug(logCategories.SEARCH, '切换搜索选项', `${key}: ${!searchOptions[key]}`)
    onOptionsChange({
      ...searchOptions,
      [key]: !searchOptions[key]
    })
  }

  if (!isOpen) return null

  return (
    <div
      className={`search-dialog ${isDragging ? 'dragging' : ''}`}
      ref={dialogRef}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        opacity: isFocused ? 1 : 0.5
      }}
      onClick={handleDialogClick}
      onMouseDown={handleMouseDown}
    >
      <div className="search-dialog-header" ref={headerRef}>
        <span className="dialog-title">查找</span>
        <button className="close-btn" onClick={handleClose}>×</button>
      </div>
      
      <div className="search-dialog-content">
        <div className="search-input-section">
          <label className="input-label">查找目标(&E):</label>
          <div className="input-with-history">
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setHistoryIndex(-1)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch()
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  if (searchHistory.length === 0) return
                  let newIndex = historyIndex - 1
                  if (newIndex < 0) newIndex = searchHistory.length - 1
                  setHistoryIndex(newIndex)
                  setQuery(searchHistory[newIndex].query)
                  onOptionsChange(searchHistory[newIndex].options)
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (searchHistory.length === 0) return
                  let newIndex = historyIndex + 1
                  if (newIndex >= searchHistory.length) newIndex = 0
                  setHistoryIndex(newIndex)
                  setQuery(searchHistory[newIndex].query)
                  onOptionsChange(searchHistory[newIndex].options)
                }
              }}
              onWheel={(e) => {
                if (searchHistory.length === 0) return
                e.preventDefault()
                const delta = e.deltaY > 0 ? 1 : -1
                let newIndex = historyIndex + delta
                if (newIndex < 0) newIndex = searchHistory.length - 1
                if (newIndex >= searchHistory.length) newIndex = 0
                setHistoryIndex(newIndex)
                setQuery(searchHistory[newIndex].query)
                onOptionsChange(searchHistory[newIndex].options)
              }}
              onFocus={() => {
                if (historyIndex === -1 && searchHistory.length > 0) {
                  setHistoryIndex(0)
                }
              }}
              placeholder="输入搜索内容..."
            />
            <button 
              className="history-dropdown-btn"
              onClick={() => setShowHistory(!showHistory)}
              title="搜索历史"
            >
              ▼
            </button>
          </div>
          
          {showHistory && searchHistory.length > 0 && (
            <div className="history-dropdown">
              {searchHistory.map((item) => (
                <div
                  key={item.id}
                  className="history-dropdown-item"
                  onClick={() => handleHistorySelect(item)}
                >
                  <span className="history-query">{item.query}</span>
                  <span className="history-count">{item.count}次</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="search-options-section">
          <div className="options-group">
            <label className="option-checkbox">
              <input
                type="checkbox"
                checked={searchOptions.caseSensitive}
                onChange={() => toggleOption('caseSensitive')}
              />
              <span>匹配大小写(&C)</span>
            </label>
            <label className="option-checkbox">
              <input
                type="checkbox"
                checked={searchOptions.wholeWord}
                onChange={() => toggleOption('wholeWord')}
              />
              <span>全词匹配(&W)</span>
            </label>
            <label className="option-checkbox">
              <input
                type="checkbox"
                checked={searchOptions.useRegex}
                onChange={() => toggleOption('useRegex')}
              />
              <span>正则表达式(&G)</span>
            </label>
          </div>
        </div>

        <div className="search-mode-section">
          <label className="section-label">查找模式:</label>
          <div className="mode-options">
            <label className="mode-radio">
              <input
                type="radio"
                name="searchMode"
                checked={!searchOptions.useRegex}
                onChange={() => onOptionsChange({ ...searchOptions, useRegex: false })}
              />
              <span>普通(&N)</span>
            </label>
            <label className="mode-radio">
              <input
                type="radio"
                name="searchMode"
                checked={searchOptions.useRegex}
                onChange={() => onOptionsChange({ ...searchOptions, useRegex: true })}
              />
              <span>正则表达式(&G)</span>
            </label>
          </div>
        </div>

        <div className="search-result-info">
          {resultCount > 0 ? (
            <span>找到 {resultCount} 个结果，当前第 {currentIndex + 1} 个</span>
          ) : query ? (
            <span>未找到匹配结果</span>
          ) : (
            <span>输入关键词开始搜索</span>
          )}
        </div>
      </div>

      <div className="search-dialog-buttons">
        <button 
          className="dialog-btn primary"
          onClick={onFindNext}
          disabled={resultCount === 0}
        >
          查找下一个(&F)
        </button>
        <button 
          className="dialog-btn"
          onClick={onFindPrev}
          disabled={resultCount === 0}
        >
          查找上一个
        </button>
        <button 
          className="dialog-btn"
          onClick={handleSearch}
          disabled={!query.trim()}
        >
          在当前文件中查找(&L)
        </button>
        <button className="dialog-btn" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  )
}

export default SearchDialog
