import React, { useState, useCallback } from 'react'
import './HistoryPanel.css'

interface HistoryPanelProps {
  history: string[]
  onOpen: (filePath: string) => void
  onClear: () => void
  onClose: () => void
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  onOpen,
  onClear,
  onClose
}) => {
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }, [closing, onClose])

  const getFileName = (path: string) => {
    const parts = path.split(/[/\\]/)
    return parts[parts.length - 1]
  }

  const getDirectory = (path: string) => {
    const parts = path.split(/[/\\]/)
    return parts.slice(0, -1).join('/')
  }

  return (
    <div className={`history-panel ${closing ? 'closing' : ''}`}>
      <div className="history-header">
        <h3>历史记录</h3>
        <div className="history-actions">
          {history.length > 0 && (
            <button className="clear-btn" onClick={onClear}>
              清空
            </button>
          )}
          <button className="close-btn" onClick={handleClose}>
            ×
          </button>
        </div>
      </div>
      
      <div className="history-content">
        {history.length === 0 ? (
          <div className="no-history">
            <span>暂无历史记录</span>
          </div>
        ) : (
          <div className="history-list">
            {history.map((path, index) => (
              <div
                key={index}
                className="history-item"
                onClick={() => onOpen(path)}
              >
                <span className="history-icon">📄</span>
                <div className="history-info">
                  <span className="history-name">{getFileName(path)}</span>
                  <span className="history-path">{getDirectory(path)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryPanel
