import React, { useState } from 'react'
import { LogFile, Theme } from '../types'
import './Toolbar.css'

interface ToolbarProps {
  onOpenFile: () => void
  onOpenFolder: () => void
  onShowHistory: () => void
  onIncreaseFont: () => void
  onDecreaseFont: () => void
  onGoToLine: () => void
  onThemeChange: (theme: Theme) => void
  theme: Theme
  fontSize: number
  logFiles: LogFile[]
  currentFileIndex: number
  onFileChange: (index: number) => void
}

const Toolbar: React.FC<ToolbarProps> = ({
  onOpenFile,
  onOpenFolder,
  onShowHistory,
  onIncreaseFont,
  onDecreaseFont,
  onGoToLine,
  onThemeChange,
  theme,
  fontSize,
  logFiles,
  currentFileIndex,
  onFileChange
}) => {
  const [showThemeMenu, setShowThemeMenu] = useState(false)

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" onClick={onOpenFile} title="打开日志文件">
          <span className="icon">📄</span>
          打开文件
        </button>
        <button className="toolbar-btn" onClick={onOpenFolder} title="打开文件夹">
          <span className="icon">📁</span>
          打开文件夹
        </button>
        <button className="toolbar-btn" onClick={onShowHistory} title="历史记录">
          <span className="icon">⏱️</span>
          历史记录
        </button>
      </div>
      
      {logFiles.length > 0 && (
        <div className="toolbar-center">
          <select
            className="file-selector"
            value={currentFileIndex}
            onChange={(e) => onFileChange(parseInt(e.target.value))}
          >
            {logFiles.map((file, index) => (
              <option key={index} value={index}>
                {file.fileName}
              </option>
            ))}
          </select>
        </div>
      )}
      
      <div className="toolbar-right">
        <div className="theme-wrapper" style={{ position: 'relative' }}>
          <button
            className="toolbar-btn theme-btn"
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            title="切换主题"
          >
            {theme === 'dark' ? '🌙' : '☀️'} {theme === 'dark' ? '深色' : '浅色'}
          </button>
          {showThemeMenu && (
            <div className="theme-menu">
              <button
                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => {
                  onThemeChange('dark')
                  setShowThemeMenu(false)
                }}
              >
                🌙 深色主题
              </button>
              <button
                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => {
                  onThemeChange('light')
                  setShowThemeMenu(false)
                }}
              >
                ☀️ 浅色主题
              </button>
            </div>
          )}
        </div>
        <div className="toolbar-divider"></div>
        <button className="toolbar-btn" onClick={onDecreaseFont} title="减小字体 (Ctrl+-)">
          <span className="icon">A-</span>
        </button>
        <span className="font-size">{fontSize}px</span>
        <button className="toolbar-btn" onClick={onIncreaseFont} title="增大字体 (Ctrl++)">
          <span className="icon">A+</span>
        </button>
        <div className="toolbar-divider"></div>
        <button className="toolbar-btn" onClick={onGoToLine} title="跳转至指定行 (Ctrl+G)">
          <span className="icon">📍</span>
          跳转行号
        </button>
      </div>
    </div>
  )
}

export default Toolbar
