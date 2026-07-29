import React, { useState, useCallback } from 'react'
import { FolderFileItem } from '../types'
import './LogFileSelectionDialog.css'

interface Props {
  folderPath: string
  files: FolderFileItem[]
  onConfirm: (selectedFiles: FolderFileItem[]) => void
  onCancel: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const LogFileSelectionDialog: React.FC<Props> = ({ folderPath, files, onConfirm, onCancel }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // 默认全选所有支持的文件
    return new Set(files.filter(f => f.supported).map(f => f.filePath))
  })

  const supportedFiles = files.filter(f => f.supported)
  const unsupportedFiles = files.filter(f => !f.supported)

  const toggleFile = useCallback((filePath: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === supportedFiles.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(supportedFiles.map(f => f.filePath)))
    }
  }, [selectedIds, supportedFiles])

  const handleConfirm = useCallback(() => {
    const selected = files.filter(f => selectedIds.has(f.filePath))
    if (selected.length === 0) return
    onConfirm(selected)
  }, [files, selectedIds, onConfirm])

  return (
    <div className="file-selection-overlay" onClick={onCancel}>
      <div className="file-selection-dialog" onClick={e => e.stopPropagation()}>
        <div className="fsd-header">
          <span className="fsd-title">📂 选择要分析的日志文件</span>
          <button className="fsd-close-btn" onClick={onCancel}>×</button>
        </div>

        <div className="fsd-info">
          <div className="fsd-folder-path">
            📁 文件夹：{folderPath}
          </div>
          <div className="fsd-summary">
            共 {files.length} 个文件，其中 {supportedFiles.length} 个支持分析
          </div>
        </div>

        {supportedFiles.length > 0 && (
          <div className="fsd-select-all-bar">
            <label className="fsd-select-all-label">
              <input
                type="checkbox"
                checked={selectedIds.size === supportedFiles.length && supportedFiles.length > 0}
                onChange={handleSelectAll}
              />
              <span>☑ 全选（共 {supportedFiles.length} 个支持文件）</span>
            </label>
          </div>
        )}

        <div className="fsd-file-list">
          {supportedFiles.map(file => (
            <label
              key={file.filePath}
              className={`fsd-file-item ${selectedIds.has(file.filePath) ? 'selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(file.filePath)}
                onChange={() => toggleFile(file.filePath)}
              />
              <span className="fsd-file-icon">✓</span>
              <span className="fsd-file-name">{file.fileName}</span>
              <span className="fsd-file-size">{formatSize(file.size)}</span>
            </label>
          ))}

          {unsupportedFiles.map(file => (
            <div key={file.filePath} className="fsd-file-item disabled">
              <span className="fsd-file-icon unsupported">⛔</span>
              <span className="fsd-file-name unsupported">{file.fileName}</span>
              <span className="fsd-file-tag">格式不支持</span>
              <span className="fsd-file-size">{formatSize(file.size)}</span>
            </div>
          ))}
        </div>

        <div className="fsd-hint">
          💡 仅 .log .txt .out .err 及 .log.N 格式支持分析
        </div>

        <div className="fsd-footer">
          <span className="fsd-selected-count">
            已选择 {selectedIds.size} 个文件
          </span>
          <div className="fsd-actions">
            <button className="fsd-btn cancel" onClick={onCancel}>取消</button>
            <button
              className="fsd-btn confirm"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
            >
              开始分析（{selectedIds.size} 个文件）
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LogFileSelectionDialog
