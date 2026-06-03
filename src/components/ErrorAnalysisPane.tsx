import React, { useState } from 'react'
import { ErrorKeyword } from '../types'
import './ErrorAnalysisPane.css'

interface ErrorAnalysisPaneProps {
  content: string
  errorKeywords: ErrorKeyword[]
  onNavigateToLine: (line: number) => void
}

interface DetectedError {
  keyword: string
  description: string
  line: number
  context: string
}

const ErrorAnalysisPane: React.FC<ErrorAnalysisPaneProps> = ({
  content,
  errorKeywords,
  onNavigateToLine
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<DetectedError[]>([])

  const handleStartAnalysis = () => {
    if (!content) return

    setIsAnalyzing(true)

    setTimeout(() => {
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

      setAnalysisResults(errors.slice(0, 50))
      setIsAnalyzing(false)
    }, 100)
  }

  const detectedErrors = analysisResults

  return (
    <div className={`error-pane ${!isExpanded ? 'collapsed' : ''}`}>
      <div className="error-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="error-title">
          ⚠️ 错误分析
          {detectedErrors.length > 0 && (
            <span className="error-count">{detectedErrors.length}</span>
          )}
        </span>
        <span className="toggle-icon">{isExpanded ? '▼' : '▲'}</span>
      </div>

      {isExpanded && (
        <div className="error-content">
          {isAnalyzing ? (
            <div className="no-errors">分析中...</div>
          ) : detectedErrors.length === 0 ? (
            <div className="start-analysis">
              <div className="no-errors">点击下方按钮开始分析错误</div>
              <button
                className="start-analysis-btn"
                onClick={handleStartAnalysis}
                disabled={!content}
              >
                ▶ 开始分析
              </button>
            </div>
          ) : (
            <div className="error-list">
              <button
                className="re-analyze-btn"
                onClick={handleStartAnalysis}
              >
                🔄 重新分析
              </button>
              {detectedErrors.map((error, index) => (
                <div
                  key={index}
                  className="error-item"
                  onClick={() => onNavigateToLine(error.line - 1)}
                >
                  <span className="error-line">行 {error.line}</span>
                  <span className="error-keyword">{error.keyword}</span>
                  <span className="error-desc">{error.description}</span>
                  <span className="error-context">{error.context}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ErrorAnalysisPane