import React from 'react'
import { PerFileStatus } from '../types'
import './FolderAnalysisProgress.css'

interface FileProgress {
  fileName: string
  status: PerFileStatus
}

interface Props {
  isAnalyzing: boolean
  currentIndex: number
  total: number
  files: FileProgress[]
  cumulativeMatches: number
  cumulativeModules: number
  onCancel: () => void
  onClose?: () => void
}

const STATUS_ICONS: Record<PerFileStatus, string> = {
  waiting: '⏳',
  analyzing: '🔄',
  done: '✅',
  skipped: '⛔'
}

const STATUS_LABELS: Record<PerFileStatus, string> = {
  waiting: '等待',
  analyzing: '正在分析',
  done: '已完成',
  skipped: '已跳过'
}

const FolderAnalysisProgress: React.FC<Props> = ({
  isAnalyzing,
  currentIndex,
  total,
  files,
  cumulativeMatches,
  cumulativeModules,
  onCancel,
  onClose
}) => {
  const pct = total > 0 ? Math.round((currentIndex / total) * 100) : 0

  return (
    <div className="folder-progress-overlay" onClick={isAnalyzing ? undefined : onClose}>
      <div className="folder-progress-dialog" onClick={e => e.stopPropagation()}>
        <div className="fpd-header">
          <span className="fpd-title">🔄 批量快速分析进度</span>
          {isAnalyzing ? (
            <button className="fpd-close-btn disabled" disabled title="分析进行中，无法关闭">×</button>
          ) : (
            <button className="fpd-close-btn" onClick={onClose}>×</button>
          )}
        </div>

        <div className="fpd-progress-bar">
          <div className="fpd-progress-track">
            <div className="fpd-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="fpd-progress-text">
            {currentIndex}/{total} - {pct}%
          </div>
        </div>

        <div className="fpd-stats">
          <span>📊 当前累计：发现 {cumulativeMatches} 处匹配，涉及 {cumulativeModules} 个模块</span>
        </div>

        <div className="fpd-file-list">
          {files.map((f, i) => (
            <div key={i} className={`fpd-file-item ${f.status}`}>
              <span className="fpd-file-status">{STATUS_ICONS[f.status]}</span>
              <span className="fpd-file-name">{f.fileName}</span>
              <span className="fpd-file-label">{STATUS_LABELS[f.status]}</span>
            </div>
          ))}
        </div>

        <div className="fpd-footer">
          {isAnalyzing ? (
            <button className="fpd-btn cancel" onClick={onCancel}>
              ⏹ 取消分析
            </button>
          ) : (
            <span className="fpd-done-msg">✅ 分析完成！</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default FolderAnalysisProgress
