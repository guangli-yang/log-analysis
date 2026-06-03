import React from 'react'
import './ImportDialog.css'

interface ImportDialogProps {
  onImportModuleLog: () => void
  onImportModuleMapping: () => void
  onClose: () => void
}

const ImportDialog: React.FC<ImportDialogProps> = ({
  onImportModuleLog,
  onImportModuleMapping,
  onClose
}) => {

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="import-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">📥 导入配置</span>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>
        <div className="dialog-content">
          <p className="dialog-description">请选择导入类型：</p>
          <div className="import-options">
            <button
              className="import-option-btn"
              onClick={() => {
                onImportModuleLog()
                onClose()
              }}
            >
              <span className="option-icon">📄</span>
              <span className="option-text">导入模块日志配置</span>
              <span className="option-desc">导入模块日志的配置信息</span>
            </button>
            <button
              className="import-option-btn"
              onClick={() => {
                onImportModuleMapping()
                onClose()
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