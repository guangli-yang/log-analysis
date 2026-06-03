import React from 'react'
import './SettingsDialog.css'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  fontSize: number
  onFontSizeChange: (size: number) => void
  lineHeight: number
  onLineHeightChange: (height: number) => void
  showLogs: boolean
  onShowLogsChange: (show: boolean) => void
  onResetRole: () => void
  currentRole: string
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  fontSize,
  onFontSizeChange,
  lineHeight,
  onLineHeightChange,
  showLogs,
  onShowLogsChange,
  onResetRole,
  currentRole
}) => {
  if (!isOpen) return null

  const handleFontSizeDecrease = () => {
    const newSize = Math.max(fontSize - 2, 8)
    onFontSizeChange(newSize)
    onLineHeightChange(Math.max(lineHeight - 3, 12))
  }

  const handleFontSizeIncrease = () => {
    const newSize = Math.min(fontSize + 2, 32)
    onFontSizeChange(newSize)
    onLineHeightChange(Math.min(lineHeight + 3, 48))
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'developer': return '研发'
      case 'tester': return '测试'
      default: return role
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ 软件设置</h2>
          <button className="settings-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <h3>字体设置</h3>
            <div className="setting-item">
              <div className="setting-label">
                <span>字体大小</span>
                <span className="setting-value">{fontSize}px</span>
              </div>
              <div className="font-controls">
                <button className="font-btn" onClick={handleFontSizeDecrease}>A-</button>
                <div className="font-slider-container">
                  <input
                    type="range"
                    min="8"
                    max="32"
                    value={fontSize}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value)
                      const ratio = newSize / fontSize
                      onFontSizeChange(newSize)
                      onLineHeightChange(Math.round(lineHeight * ratio))
                    }}
                  />
                </div>
                <button className="font-btn" onClick={handleFontSizeIncrease}>A+</button>
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <span>行高</span>
                <span className="setting-value">{lineHeight}px</span>
              </div>
              <div className="font-slider-container">
                <input
                  type="range"
                  min="12"
                  max="48"
                  value={lineHeight}
                  onChange={(e) => onLineHeightChange(parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>界面显示</h3>
            <div className="setting-item">
              <div className="setting-label">
                <span>显示运行日志</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showLogs}
                  onChange={(e) => onShowLogsChange(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>角色设置</h3>
            <div className="setting-item">
              <div className="setting-label">
                <span>当前角色</span>
                <span className="setting-value">{getRoleDisplayName(currentRole)}</span>
              </div>
              <button className="reset-role-btn" onClick={onResetRole}>
                重新选择角色
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsDialog