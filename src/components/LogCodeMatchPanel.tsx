import React, { useState, useMemo } from 'react'
import { LogCodeMatch, ErrorKeyword, CodeSearchResult } from '../types'
import './LogCodeMatchPanel.css'

interface LogCodeMatchPanelProps {
  logContent: string
  errorKeywords: ErrorKeyword[]
  codeSearchResults: CodeSearchResult[]
  onNavigateToLogLine: (line: number) => void
}

const LogCodeMatchPanel: React.FC<LogCodeMatchPanelProps> = ({
  logContent,
  errorKeywords,
  codeSearchResults,
  onNavigateToLogLine
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeMatch, setActiveMatch] = useState<number | null>(null)

  const matches = useMemo((): LogCodeMatch[] => {
    if (!logContent || codeSearchResults.length === 0) {
      return []
    }

    const logLines = logContent.split('\n')
    const results: LogCodeMatch[] = []

    logLines.forEach((line, lineIndex) => {
      for (const keyword of errorKeywords) {
        if (keyword.enabled && line.toLowerCase().includes(keyword.keyword.toLowerCase())) {
          const matchingCodeResults = codeSearchResults.filter(codeResult => {
            const codeText = codeResult.matchedText.toLowerCase()
            return codeText.includes(keyword.keyword.toLowerCase())
          })

          for (const codeResult of matchingCodeResults) {
            results.push({
              logLine: lineIndex + 1,
              logText: line.trim(),
              errorKeyword: keyword.keyword,
              codeFile: codeResult.codeFile.fileName,
              codeLine: codeResult.line,
              codeFunction: codeResult.functionName,
              codeText: codeResult.matchedText
            })
          }
        }
      }
    })

    return results
  }, [logContent, errorKeywords, codeSearchResults])

  const handleMatchClick = (match: LogCodeMatch) => {
    setActiveMatch(matches.indexOf(match))
    onNavigateToLogLine(match.logLine)
  }

  return (
    <div className={`log-code-match-panel ${!isExpanded ? 'collapsed' : ''}`}>
      <div className="log-code-match-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="log-code-match-title">
          🔗 日志-代码匹配
          {matches.length > 0 && (
            <span className="match-count">{matches.length}</span>
          )}
        </span>
        <span className="toggle-icon">{isExpanded ? '▼' : '▲'}</span>
      </div>

      {isExpanded && (
        <div className="log-code-match-content">
          {matches.length === 0 && (
            <div className="no-matches">
              {!logContent ? (
                <span>📝 请先打开日志文件</span>
              ) : codeSearchResults.length === 0 ? (
                <span>📁 请先检索代码目录</span>
              ) : (
                <span>✅ 未找到匹配的日志-代码关系</span>
              )}
            </div>
          )}

          {matches.length > 0 && (
            <div className="matches-list">
              <h4>找到 {matches.length} 个匹配关系</h4>
              {matches.map((match, index) => (
                <div
                  key={index}
                  className={`match-item ${activeMatch === index ? 'active' : ''}`}
                  onClick={() => handleMatchClick(match)}
                >
                  <div className="match-log-section">
                    <div className="match-log-header">
                      <span className="match-log-line">日志行 {match.logLine}</span>
                      <span className="match-keyword">{match.errorKeyword}</span>
                    </div>
                    <div className="match-log-text">{match.logText}</div>
                  </div>
                  <div className="match-arrow">↓</div>
                  <div className="match-code-section">
                    <div className="match-code-header">
                      <span className="match-code-file">{match.codeFile}</span>
                      <span className="match-code-line">行 {match.codeLine}</span>
                      {match.codeFunction && (
                        <span className="match-code-function">函数: {match.codeFunction}</span>
                      )}
                    </div>
                    <div className="match-code-text">{match.codeText}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LogCodeMatchPanel