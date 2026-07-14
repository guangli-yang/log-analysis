import React, { useState, useCallback } from 'react'
import './ImportDialog.css'

interface ImportDialogProps {
  projectList: string[]
  activeProject: string
  onImportModuleLog: (projectName: string, mode: 'overwrite' | 'merge') => void
  onImportModuleMapping: (projectName: string, mode: 'overwrite' | 'merge') => void
  onClose: () => void
}

const ImportDialog: React.FC<ImportDialogProps> = ({
  projectList,
  activeProject,
  onImportModuleLog,
  onImportModuleMapping,
  onClose
}) => {
  const [projectName, setProjectName] = useState(activeProject || '')
  const [mode, setMode] = useState<'overwrite' | 'merge'>('merge')
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }, [closing, onClose])

  const trimmedName = projectName.trim()
  const canImport = trimmedName.length > 0

  return (
    <div className={`dialog-overlay ${closing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`import-dialog ${closing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">📥 导入配置</span>
          <button className="dialog-close" onClick={handleClose}>×</button>
        </div>
        <div className="dialog-content">
          <div className="import-field">
            <label className="import-label">项目名称</label>
            <input
              className="import-project-input"
              list="import-project-list"
              placeholder="输入新项目名称，或选择已有项目"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
            <datalist id="import-project-list">
              {projectList.map(p => <option key={p} value={p} />)}
            </datalist>
            <span className="import-hint">
              {trimmedName && !projectList.includes(trimmedName)
                ? '将新建该项目并导入'
                : '导入到该项目'}
            </span>
          </div>

          <div className="import-field">
            <label className="import-label">导入模式</label>
            <div className="import-mode-group">
              <label className={`import-mode-item ${mode === 'merge' ? 'active' : ''}`}>
                <input type="radio" name="import-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
                合并导入
              </label>
              <label className={`import-mode-item ${mode === 'overwrite' ? 'active' : ''}`}>
                <input type="radio" name="import-mode" checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} />
                覆盖导入
              </label>
            </div>
          </div>

          <p className="dialog-description">请选择导入类型：</p>
          <div className="import-options">
            <button
              className="import-option-btn"
              disabled={!canImport}
              onClick={() => {
                onImportModuleLog(trimmedName, mode)
                handleClose()
              }}
            >
              <span className="option-icon">📄</span>
              <span className="option-text">导入模块日志配置</span>
              <span className="option-desc">导入模块日志（代码日志）的配置信息</span>
            </button>
            <button
              className="import-option-btn"
              disabled={!canImport}
              onClick={() => {
                onImportModuleMapping(trimmedName, mode)
                handleClose()
              }}
            >
              <span className="option-icon">📋</span>
              <span className="option-text">导入模块负责人配置</span>
              <span className="option-desc">导入模块负责人的映射关系</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImportDialog
