import React, { useState, useEffect } from 'react'
import { JobKeyword, ErrorKeyword } from '../types'
import './LogExtractDialog.css'

export type ExtractMode = 'job' | 'boot' | 'error' | 'custom'

interface LogExtractDialogProps {
  isOpen: boolean
  onClose: () => void
  onExtract: (mode: ExtractMode, params: { count?: number; keyword?: string }) => void
  jobKeywords: JobKeyword[]
  errorKeywords: ErrorKeyword[]
}

const LogExtractDialog: React.FC<LogExtractDialogProps> = ({
  isOpen,
  onClose,
  onExtract,
  jobKeywords,
  errorKeywords
}) => {
  const [mode, setMode] = useState<ExtractMode>('job')
  const [jobCount, setJobCount] = useState(1)
  const [customKeyword, setCustomKeyword] = useState('')

  useEffect(() => {
    if (isOpen) {
      setMode('job')
      setJobCount(1)
      setCustomKeyword('')
    }
  }, [isOpen])

  const handleExtract = () => {
    if (mode === 'custom' && !customKeyword.trim()) {
      return
    }
    onExtract(mode, {
      count: mode === 'job' ? jobCount : undefined,
      keyword: mode === 'custom' ? customKeyword.trim() : undefined
    })
    onClose()
  }

  if (!isOpen) return null

  const bootPatterns = ['boot', 'startup', '开机', '启动', 'reboot', 'restart', '系统启动']

  return (
    <div className="log-extract-overlay" onClick={onClose}>
      <div className="log-extract-dialog" onClick={e => e.stopPropagation()}>
        <div className="log-extract-header">
          <h3>📋 日志提取</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="log-extract-content">
          <div className="extract-mode-group">
            <label className="mode-label">提取模式</label>
            <div className="mode-options">
              <label className={`mode-option ${mode === 'job' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="mode"
                  value="job"
                  checked={mode === 'job'}
                  onChange={() => setMode('job')}
                />
                <span className="mode-icon">📁</span>
                <span className="mode-text">
                  <strong>倒数第N个作业</strong>
                  <small>基于作业开始标记</small>
                </span>
              </label>

              <label className={`mode-option ${mode === 'boot' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="mode"
                  value="boot"
                  checked={mode === 'boot'}
                  onChange={() => setMode('boot')}
                />
                <span className="mode-icon">🖥️</span>
                <span className="mode-text">
                  <strong>最后开机/重启</strong>
                  <small>系统启动后的日志</small>
                </span>
              </label>

              <label className={`mode-option ${mode === 'error' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="mode"
                  value="error"
                  checked={mode === 'error'}
                  onChange={() => setMode('error')}
                />
                <span className="mode-icon">❌</span>
                <span className="mode-text">
                  <strong>最后错误</strong>
                  <small>基于错误关键词</small>
                </span>
              </label>

              <label className={`mode-option ${mode === 'custom' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="mode"
                  value="custom"
                  checked={mode === 'custom'}
                  onChange={() => setMode('custom')}
                />
                <span className="mode-icon">🔍</span>
                <span className="mode-text">
                  <strong>自定义关键词</strong>
                  <small>用户指定关键词</small>
                </span>
              </label>
            </div>
          </div>

          {mode === 'job' && (
            <div className="extract-params">
              <label className="param-label">倒数第几个作业</label>
              <div className="count-selector">
                <button
                  className="count-btn"
                  onClick={() => setJobCount(prev => Math.max(1, prev - 1))}
                >-</button>
                <input
                  type="number"
                  min="1"
                  value={jobCount}
                  onChange={e => setJobCount(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <button
                  className="count-btn"
                  onClick={() => setJobCount(prev => prev + 1)}
                >+</button>
              </div>
              <small className="param-hint">作业关键词: {jobKeywords.filter(k => k.enabled).map(k => k.keyword).join(', ')}</small>
            </div>
          )}

          {mode === 'boot' && (
            <div className="extract-params">
              <small className="param-hint">检测以下模式: {bootPatterns.join(', ')}</small>
            </div>
          )}

          {mode === 'error' && (
            <div className="extract-params">
              <small className="param-hint">错误关键词: {errorKeywords.filter(k => k.enabled).map(k => k.keyword).join(', ')}</small>
            </div>
          )}

          {mode === 'custom' && (
            <div className="extract-params">
              <label className="param-label">自定义关键词</label>
              <input
                type="text"
                className="keyword-input"
                value={customKeyword}
                onChange={e => setCustomKeyword(e.target.value)}
                placeholder="输入关键词..."
              />
            </div>
          )}
        </div>

        <div className="log-extract-footer">
          <button className="cancel-btn" onClick={onClose}>取消</button>
          <button
            className="extract-btn"
            onClick={handleExtract}
            disabled={mode === 'custom' && !customKeyword.trim()}
          >
            开始提取
          </button>
        </div>
      </div>
    </div>
  )
}

export default LogExtractDialog