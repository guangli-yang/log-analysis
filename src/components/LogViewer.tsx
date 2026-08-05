import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { SearchResult, SearchOptions, HighlightConfig, SearchHighlight } from '../types'
import ContextMenu from './ContextMenu'
import './LogViewer.css'

interface LogViewerProps {
  content: string
  fontSize: number
  lineHeight: number
  searchResults: SearchResult[]
  currentResultIndex: number
  searchQuery: string
  searchOptions: SearchOptions
  searchHighlights: SearchHighlight[]
  lineOffsets?: number[]
  targetLine?: number
  highlightedLine?: number
  highlightConfig?: HighlightConfig
  onContentChange?: (newContent: string) => void
  onCreateNewFile?: () => void
}

const BUFFER_SIZE = 20

const LogViewer: React.FC<LogViewerProps> = React.memo(({
  content,
  fontSize,
  lineHeight,
  searchResults,
  currentResultIndex,
  searchQuery,
  searchOptions,
  searchHighlights,
  lineOffsets,
  targetLine,
  highlightedLine,
  onContentChange,
  onCreateNewFile
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [activeHighlight, setActiveHighlight] = useState<number | undefined>(undefined)
  const [selectedText, setSelectedText] = useState<string>('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState(content)

  // 大文件无 lineOffsets 时，一次性 split 并缓存，避免每行都 split 整个 content
  const cachedLines = useMemo(() => {
    if (lineOffsets && lineOffsets.length > 0) return null
    return content.split('\n')
  }, [content, lineOffsets])

  const lineCount = (lineOffsets && lineOffsets.length > 0)
    ? lineOffsets.length
    : (cachedLines ? cachedLines.length : content.split('\n').length)
  const totalHeight = lineCount * lineHeight

  const getLine = useCallback((index: number): string => {
    if (!content) return ''
    if (lineOffsets && lineOffsets.length > 0 && lineOffsets.length > index) {
      const start = lineOffsets[index]
      const end = index + 1 < lineOffsets.length ? lineOffsets[index + 1] - 1 : content.length
      return content.substring(start, end)
    }
    if (cachedLines && index < cachedLines.length) return cachedLines[index]
    return ''
  }, [content, lineOffsets, cachedLines])

  const startIndex = Math.max(0, Math.floor(scrollTop / lineHeight) - BUFFER_SIZE)
  const endIndex = Math.min(
    lineCount - 1,
    Math.ceil((scrollTop + containerHeight) / lineHeight) + BUFFER_SIZE
  )

  const findScrollableAncestor = useCallback((el: HTMLElement | null): HTMLElement | null => {
    let cur: HTMLElement | null = el
    while (cur && cur !== document.body) {
      const cs = window.getComputedStyle(cur)
      if (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflow === 'auto' || cs.overflow === 'scroll') {
        if (cur.scrollHeight > cur.clientHeight) {
          return cur
        }
      }
      cur = cur.parentElement
    }
    return null
  }, [])

  useEffect(() => {
    const inner = containerRef.current
    if (!inner) return
    const outer = findScrollableAncestor(inner.parentElement)
    if (!outer || outer === inner) return
    scrollerRef.current = outer
    const onOuterScroll = () => {
      setScrollTop(outer.scrollTop)
      setContainerHeight(outer.clientHeight)
    }
    setScrollTop(outer.scrollTop)
    setContainerHeight(outer.clientHeight)
    outer.addEventListener('scroll', onOuterScroll, { passive: true })
    const ro = new ResizeObserver(() => setContainerHeight(outer.clientHeight))
    ro.observe(outer)
    return () => {
      outer.removeEventListener('scroll', onOuterScroll)
      ro.disconnect()
    }
  }, [findScrollableAncestor])

  const visibleLines = useMemo(() => {
    const result = []
    for (let i = startIndex; i <= endIndex; i++) {
      result.push({ index: i, line: getLine(i) })
    }
    return result
  }, [startIndex, endIndex, getLine])

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])

  useEffect(() => {
    if (highlightedLine !== undefined) {
      setActiveHighlight(highlightedLine)
      const timer = setTimeout(() => {
        setActiveHighlight(undefined)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [highlightedLine])

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection()
      if (selection && selection.toString().trim()) {
        const text = selection.toString().trim()
        if (text.length > 1 && text.length < 100) {
          setSelectedText(text)
        }
      }
    }

    const handleDblClick = () => {
      const selection = window.getSelection()
      if (selection && selection.toString().trim()) {
        const text = selection.toString()
        navigator.clipboard.writeText(text)
      }
    }

    const handleClick = (e: MouseEvent) => {
      const selection = window.getSelection()
      if (!selection || !selection.toString().trim()) {
        if (e.target && !containerRef.current?.contains(e.target as Node)) {
          setSelectedText('')
        }
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'c') {
        const selection = window.getSelection()
        if (selection && selection.toString().trim()) {
          const text = selection.toString()
          navigator.clipboard.writeText(text)
        }
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    containerRef.current?.addEventListener('dblclick', handleDblClick)

    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
      containerRef.current?.removeEventListener('dblclick', handleDblClick)
    }
  }, [])

  useEffect(() => {
    if (targetLine === undefined) return

    const scroller = scrollerRef.current || containerRef.current
    if (!scroller) return

    const scrollerHeight = scroller.clientHeight
    const maxScroll = Math.max(0, scroller.scrollHeight - scrollerHeight)
    const targetTop = targetLine * lineHeight
    const halfViewport = scrollerHeight / 2
    let scrollTop = targetTop - halfViewport
    if (scrollTop < 0) {
      scrollTop = targetTop
    }
    if (scrollTop > maxScroll) {
      scrollTop = maxScroll
    }
    scroller.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: 'instant'
    })

    setScrollTop(Math.max(0, scrollTop))
  }, [targetLine, lineHeight])

  useEffect(() => {
    if (editMode) {
      setEditContent(content)
    }
  }, [editMode, content])

  const enterEditMode = useCallback(() => {
    setEditContent(content)
    setEditMode(true)
  }, [content])

  const saveEdit = useCallback(() => {
    if (onContentChange) {
      onContentChange(editContent)
    }
    setEditMode(false)
  }, [editContent, onContentChange])

  const cancelEdit = useCallback(() => {
    setEditMode(false)
    setEditContent(content)
  }, [content])

  useEffect(() => {
    if (!editMode) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveEdit()
      } else if (e.key === 'Escape') {
        cancelEdit()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editMode, saveEdit, cancelEdit])

  useEffect(() => {
    if (currentResultIndex >= 0 && searchResults[currentResultIndex] && containerRef.current) {
      const result = searchResults[currentResultIndex]
      const scrollTarget = result.line * lineHeight - containerHeight / 2 + lineHeight / 2
      containerRef.current.scrollTo({
        top: Math.max(0, scrollTarget),
        behavior: 'smooth'
      })
    }
  }, [currentResultIndex, searchResults, lineHeight, containerHeight])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleSelectAll = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'a' && !editMode) {
        e.preventDefault()
        const selection = window.getSelection()
        if (selection) {
          selection.removeAllRanges()
          const range = document.createRange()
          const contentEl = contentRef.current
          if (contentEl) {
            range.selectNodeContents(contentEl)
            selection.addRange(range)
          }
        }
      }
    }

    container.addEventListener('keydown', handleSelectAll)
    return () => container.removeEventListener('keydown', handleSelectAll)
  }, [editMode, content, startIndex, endIndex, lineHeight])

  // 高亮结果缓存：避免每次滚动都对相同行重复执行正则匹配
  const highlightCache = useRef<Map<string, string | JSX.Element[]>>(new Map())

  // 搜索条件变化时清空高亮缓存
  useEffect(() => {
    highlightCache.current.clear()
  }, [content, searchQuery, searchOptions, searchHighlights, selectedText, currentResultIndex])

  const highlightLine = useCallback((line: string, lineIndex: number) => {
    if (!searchQuery && !selectedText && searchHighlights.length === 0) return line

    // 构建缓存 key 并检查缓存
    const highlightHash = searchHighlights.map(h => `${h.query}|${h.options.caseSensitive}|${h.options.useRegex}|${h.options.wholeWord}|${h.color}`).join(',')
    const cacheKey = `${lineIndex}:${line.length}:${searchQuery}:${selectedText}:${currentResultIndex}:${highlightHash}`
    const cached = highlightCache.current.get(cacheKey)
    if (cached !== undefined) return cached

    const isCurrentResult = currentResultIndex >= 0 &&
      searchResults[currentResultIndex]?.line === lineIndex

    const highlightedText: { start: number; end: number; className: string; color?: string }[] = []

    const processSearchQuery = (query: string, options: SearchOptions, color?: string) => {
      let regex: RegExp
      try {
        if (options.useRegex) {
          regex = new RegExp(query, options.caseSensitive ? 'g' : 'gi')
        } else {
          const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const pattern = options.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery
          regex = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi')
        }
      } catch {
        return
      }

      let match: RegExpExecArray | null
      let safetyCounter = 0
      const maxIterations = 100

      while ((match = regex.exec(line)) !== null && safetyCounter < maxIterations) {
        safetyCounter++

        if (match[0].length === 0) {
          regex.lastIndex++
          continue
        }

        const isCurrentMatch = isCurrentResult && query === searchQuery && match.index === searchResults[currentResultIndex]?.start

        highlightedText.push({
          start: match.index,
          end: match.index + match[0].length,
          className: isCurrentMatch ? 'highlight-current' : 'highlight',
          color: color
        })

        if (regex.lastIndex === match.index) {
          regex.lastIndex++
        }
      }
    }

    if (searchQuery) {
      processSearchQuery(searchQuery, searchOptions)
    }

    for (const highlight of searchHighlights) {
      if (highlight.query !== searchQuery || JSON.stringify(highlight.options) !== JSON.stringify(searchOptions)) {
        processSearchQuery(highlight.query, highlight.options, highlight.color)
      }
    }

    if (selectedText) {
      const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escapedText, 'gi')

      let match: RegExpExecArray | null
      let safetyCounter = 0
      const maxIterations = 100

      while ((match = regex.exec(line)) !== null && safetyCounter < maxIterations) {
        safetyCounter++

        if (match[0].length === 0) {
          regex.lastIndex++
          continue
        }

        let hasConflict = false
        for (const existing of highlightedText) {
          if (!(match.index + match[0].length <= existing.start || match.index >= existing.end)) {
            hasConflict = true
            break
          }
        }

        if (!hasConflict) {
          highlightedText.push({
            start: match.index,
            end: match.index + match[0].length,
            className: 'highlight-selected'
          })
        }

        if (regex.lastIndex === match.index) {
          regex.lastIndex++
        }
      }
    }

    if (highlightedText.length === 0) return line

    highlightedText.sort((a, b) => {
      const priorityOrder: Record<string, number> = { 'highlight-current': 0, 'highlight': 1, 'highlight-selected': 2 }
      const priorityA = priorityOrder[a.className] ?? 3
      const priorityB = priorityOrder[b.className] ?? 3
      if (priorityA !== priorityB) return priorityA - priorityB
      return a.start - b.start
    })

    const mergedHighlights: typeof highlightedText = []
    for (const current of highlightedText) {
      let hasOverlap = false
      for (const existing of mergedHighlights) {
        if (!(current.end <= existing.start || current.start >= existing.end)) {
          hasOverlap = true
          break
        }
      }
      if (!hasOverlap) {
        mergedHighlights.push(current)
      }
    }

    mergedHighlights.sort((a, b) => a.start - b.start)

    const parts: JSX.Element[] = []
    let lastIndex = 0

    for (const highlight of mergedHighlights) {
      if (highlight.start > lastIndex) {
        parts.push(<span key={`${lineIndex}-${lastIndex}`}>{line.slice(lastIndex, highlight.start)}</span>)
      }
      parts.push(
        <span
          key={`${lineIndex}-${highlight.start}`}
          className={highlight.className}
          style={highlight.color ? { backgroundColor: highlight.color } : undefined}
        >
          {line.slice(highlight.start, highlight.end)}
        </span>
      )
      lastIndex = highlight.end
    }

    if (lastIndex < line.length) {
      parts.push(<span key={`${lineIndex}-end`}>{line.slice(lastIndex)}</span>)
    }

    const result = parts.length > 0 ? parts : line
    highlightCache.current.set(cacheKey, result)
    return result
  }, [searchQuery, selectedText, currentResultIndex, searchResults, searchOptions, searchHighlights])

  return (
    <div className="log-viewer">
      <div className="log-header">
        <span className="line-count">{lineCount.toLocaleString()} 行</span>
        <span className="hint">支持 Ctrl+F 查找 | Ctrl+G 跳转行 | Ctrl+A 全选</span>
        <div className="log-header-actions">
          {editMode ? (
            <>
              <button className="edit-btn save" onClick={saveEdit} title="保存编辑 (Ctrl+S)">💾 保存</button>
              <button className="edit-btn cancel" onClick={cancelEdit} title="取消编辑">✕ 取消</button>
            </>
          ) : (
            <button className="edit-btn" onClick={enterEditMode} title="编辑内容">✏️ 编辑</button>
          )}
        </div>
      </div>
      {editMode ? (
        <div className="edit-mode-container">
          <div className="edit-line-numbers" style={{ fontSize: `${fontSize}px`, lineHeight: `${lineHeight}px` }}>
            {editContent.split('\n').map((_, i) => (
              <div key={i} style={{ height: `${lineHeight}px` }}>{i + 1}</div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className="edit-textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: `${lineHeight}px`
            }}
            spellCheck={false}
          />
        </div>
      ) : (
      <div
        className="log-content"
        ref={containerRef}
        onScroll={handleScroll}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ position: 'absolute', top: startIndex * lineHeight, width: '100%' }} ref={contentRef}>
            {visibleLines.map(({ index, line }) => (
              <div
                key={index}
                data-line={index}
                className={`log-line ${activeHighlight === index ? 'active-highlight' : ''}`}
                style={{ 
                  fontSize: `${fontSize}px`, 
                  lineHeight: `${lineHeight}px`,
                  minHeight: `${lineHeight}px`
                }}
              >
                <span className="line-number">{index + 1}</span>
                <span className="line-text">{highlightLine(line, index)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: '复制',
              shortcut: 'Ctrl+C',
              action: () => {
                if (selectedText) {
                  navigator.clipboard.writeText(selectedText)
                }
              }
            },
            {
              label: '剪切',
              shortcut: 'Ctrl+X',
              action: () => {
                if (selectedText && onContentChange) {
                  navigator.clipboard.writeText(selectedText)
                }
              }
            },
            {
              label: '粘贴',
              shortcut: 'Ctrl+V',
              action: async () => {
                if (onContentChange) {
                  await navigator.clipboard.readText()
                }
              }
            },
            { label: '', divider: true, action: () => {} },
            {
              label: '全选',
              shortcut: 'Ctrl+A',
              action: () => {
                const selection = window.getSelection()
                if (selection && containerRef.current) {
                  const range = document.createRange()
                  range.selectNodeContents(containerRef.current)
                  selection.removeAllRanges()
                  selection.addRange(range)
                }
              }
            },
            { label: '', divider: true, action: () => {} },
            {
              label: '新建空白文件',
              shortcut: '',
              action: () => {
                if (onCreateNewFile) {
                  onCreateNewFile()
                }
              }
            }
          ]}
        />
      )}
    </div>
  )
})

export default LogViewer
