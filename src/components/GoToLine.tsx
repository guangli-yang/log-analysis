import React, { useState, useEffect, useRef } from 'react'
import './GoToLine.css'

interface GoToLineProps {
  onGoToLine: (lineNumber: number) => void
  totalLines: number
  isVisible: boolean
  onClose: () => void
}

const GoToLine: React.FC<GoToLineProps> = ({
  onGoToLine,
  totalLines,
  isVisible,
  onClose
}) => {
  const [lineNumber, setLineNumber] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isVisible])

  useEffect(() => {
    setError('')
  }, [lineNumber])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  const handleSubmit = () => {
    const trimmed = lineNumber.trim()
    
    if (!trimmed) {
      setError('请输入行号')
      return
    }

    const num = parseInt(trimmed, 10)
    
    if (isNaN(num)) {
      setError('请输入有效的数字')
      return
    }

    if (num < 1) {
      setError('行号必须大于0')
      return
    }

    if (num > totalLines) {
      setError(`行号不能超过总行数 ${totalLines}`)
      return
    }

    onGoToLine(num - 1)
    setLineNumber('')
    onClose()
  }

  if (!isVisible) return null

  return (
    <div className="goto-line-overlay" onClick={onClose}>
      <div className="goto-line-modal" onClick={(e) => e.stopPropagation()}>
        <div className="goto-line-header">
          <h3>跳转至指定行</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="goto-line-body">
          <div className="goto-line-info">
            <span>总行数: {totalLines.toLocaleString()}</span>
          </div>
          <div className="goto-line-input-group">
            <input
              ref={inputRef}
              type="text"
              className="goto-line-input"
              placeholder="输入行号..."
              value={lineNumber}
              onChange={(e) => setLineNumber(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="goto-line-btn" onClick={handleSubmit}>
              跳转
            </button>
          </div>
          {error && <div className="goto-line-error">{error}</div>}
          <div className="goto-line-hint">
            <span>快捷键: Ctrl+G</span>
            <span>按 Enter 确认，Esc 取消</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GoToLine
