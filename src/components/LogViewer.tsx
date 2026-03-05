import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { FixedSizeList as List } from 'react-window'
import { SearchResult, SearchOptions } from '../types'
import './LogViewer.css'

interface LogViewerProps {
  content: string
  fontSize: number
  lineHeight: number
  searchResults: SearchResult[]
  currentResultIndex: number
  searchQuery: string
  searchOptions: SearchOptions
  targetLine?: number
}

const LogViewer: React.FC<LogViewerProps> = ({
  content,
  fontSize,
  lineHeight,
  searchResults,
  currentResultIndex,
  searchQuery,
  searchOptions,
  targetLine
}) => {
  const listRef = useRef<List>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(400)
  const lines = useMemo(() => content.split('\n'), [content])
  const lineCount = lines.length

  const updateHeight = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const headerHeight = 36
      setContainerHeight(Math.max(rect.height - headerHeight, 100))
    }
  }, [])

  useEffect(() => {
    updateHeight()
    window.addEventListener('resize', updateHeight)
    
    const timer = setTimeout(updateHeight, 100)
    const timer2 = setTimeout(updateHeight, 500)
    
    return () => {
      window.removeEventListener('resize', updateHeight)
      clearTimeout(timer)
      clearTimeout(timer2)
    }
  }, [updateHeight])

  useEffect(() => {
    if (currentResultIndex >= 0 && searchResults[currentResultIndex] && listRef.current) {
      const line = searchResults[currentResultIndex].line
      listRef.current.scrollToItem(line, 'center')
    }
  }, [currentResultIndex, searchResults])

  useEffect(() => {
    if (targetLine !== undefined && targetLine >= 0 && listRef.current) {
      listRef.current.scrollToItem(targetLine, 'center')
    }
  }, [targetLine])

  const highlightLine = (line: string, lineIndex: number) => {
    if (!searchQuery) return line

    const isCurrentResult = currentResultIndex >= 0 && 
      searchResults[currentResultIndex]?.line === lineIndex

    let regex: RegExp
    try {
      if (searchOptions.useRegex) {
        regex = new RegExp(searchQuery, searchOptions.caseSensitive ? 'g' : 'gi')
      } else {
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = searchOptions.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery
        regex = new RegExp(pattern, searchOptions.caseSensitive ? 'g' : 'gi')
      }
    } catch {
      return line
    }

    const parts: JSX.Element[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null
    let safetyCounter = 0
    const maxIterations = 100

    while ((match = regex.exec(line)) !== null && safetyCounter < maxIterations) {
      safetyCounter++
      
      if (match[0].length === 0) {
        regex.lastIndex++
        continue
      }
      
      if (match.index > lastIndex) {
        parts.push(<span key={`${lineIndex}-${lastIndex}`}>{line.slice(lastIndex, match.index)}</span>)
      }
      const isCurrentMatch = isCurrentResult && 
        match.index === searchResults[currentResultIndex]?.start
      parts.push(
        <span
          key={`${lineIndex}-${match.index}`}
          className={isCurrentMatch ? 'highlight-current' : 'highlight'}
        >
          {match[0]}
        </span>
      )
      lastIndex = match.index + match[0].length
      
      if (regex.lastIndex === match.index) {
        regex.lastIndex++
      }
    }

    if (lastIndex < line.length) {
      parts.push(<span key={`${lineIndex}-end`}>{line.slice(lastIndex)}</span>)
    }

    return parts.length > 0 ? parts : line
  }

  const handleCopy = (line: string) => {
    navigator.clipboard.writeText(line)
  }

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const line = lines[index]
    const hasError = searchResults.some(r => r.line === index)
    const isCurrentResult = currentResultIndex >= 0 && 
      searchResults[currentResultIndex]?.line === index

    return (
      <div
        style={{ ...style, height: lineHeight, fontSize: `${fontSize}px`, lineHeight: `${lineHeight}px` }}
        className={`log-line ${hasError ? 'has-error' : ''} ${isCurrentResult ? 'current-result' : ''}`}
        onDoubleClick={() => handleCopy(line)}
      >
        <span className="line-number">{index + 1}</span>
        <span className="line-content">{highlightLine(line, index)}</span>
      </div>
    )
  }

  return (
    <div className="log-viewer" ref={containerRef}>
      <div className="log-header">
        <span className="line-count">共 {lineCount.toLocaleString()} 行</span>
        <span className="hint">双击行可复制内容</span>
      </div>
      <List
        ref={listRef}
        height={containerHeight}
        itemCount={lineCount}
        itemSize={lineHeight}
        width="100%"
        className="log-list"
      >
        {Row}
      </List>
    </div>
  )
}

export default LogViewer
