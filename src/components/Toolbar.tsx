import React from 'react'
import { LogFile } from '../types'
import { UserRole } from './RoleSelectionScreen'
import './Toolbar.css'

interface ToolbarProps {
  onOpenFile: () => void
  onShowHistory: () => void
  logFiles: LogFile[]
  currentFileIndex: number
  onFileChange: (index: number) => void
  onShowSearch: () => void
  onShowKeywordSettings: () => void
  onShowAnalysis: () => void
  onShowAI: () => void
  onShowCodeSearch: () => void
  onShowLogMatch: () => void
  onShowImportDialog: () => void
  onShowSettings: () => void
  userRole: UserRole
}

const Toolbar: React.FC<ToolbarProps> = ({
  onOpenFile,
  onShowHistory,
  logFiles,
  currentFileIndex,
  onFileChange,
  onShowSearch,
  onShowKeywordSettings,
  onShowAnalysis,
  onShowAI,
  onShowCodeSearch,
  onShowLogMatch,
  onShowImportDialog,
  onShowSettings,
  userRole
}) => {
  const isTester = userRole === 'tester'

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" onClick={onShowImportDialog} title="导入配置">
          <span className="icon">📥</span>
          导入配置
        </button>
        <div className="toolbar-divider"></div>
        <button className="toolbar-btn" onClick={onOpenFile} title="打开Log">
          <span className="icon">📄</span>
          打开Log
        </button>
        <button className="toolbar-btn" onClick={onShowLogMatch} title="快速分析">
          <span className="icon">🔗</span>
          快速分析
        </button>
        <button className="toolbar-btn" onClick={onShowHistory} title="历史记录">
          <span className="icon">⏱️</span>
          历史记录
        </button>

        {!isTester && (
          <>
            <div className="toolbar-divider"></div>
            <button className="toolbar-btn" onClick={onShowKeywordSettings} title="关键词设置">
              <span className="icon">⚙️</span>
              关键词设置
            </button>
            <button className="toolbar-btn primary" onClick={onShowAnalysis} title="分析工具">
              <span className="icon">📊</span>
              分析
            </button>
            <button className="toolbar-btn" onClick={onShowCodeSearch} title="代码日志检索">
              <span className="icon">📄</span>
              代码日志检索
            </button>
            <div className="toolbar-divider"></div>
            <button className="toolbar-btn ai" onClick={onShowAI} title="AI 智能助手">
              <span className="icon">🤖</span>
              AI助手
            </button>
            <button className="toolbar-btn" onClick={() => window.electronAPI.openSyncPanel()} title="数据管理">
              <span className="icon">🔄</span>
              数据管理
            </button>
          </>
        )}

        <div className="toolbar-divider"></div>
        <button className="toolbar-btn" onClick={onShowSearch} title="查找 (Ctrl+F)">
          <span className="icon">🔎</span>
          查找
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
        <button className="toolbar-btn" onClick={onShowSettings} title="软件设置">
          <span className="icon">⚙️</span>
          软件设置
        </button>
      </div>
    </div>
  )
}

export default Toolbar