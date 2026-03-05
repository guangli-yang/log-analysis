import React, { useState, useEffect, useMemo } from 'react'
import { ErrorKeyword } from '../types'
import './ErrorAnalysisPane.css'

interface ErrorAnalysisPaneProps {
  content: string
  errorKeywords: ErrorKeyword[]
  onKeywordsChange: (keywords: ErrorKeyword[]) => void
}

interface DetectedError {
  keyword: string
  description: string
  line: number
  context: string
}

const ErrorAnalysisPane: React.FC<ErrorAnalysisPaneProps> = ({
  content,
  errorKeywords,
  onKeywordsChange
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editKeyword, setEditKeyword] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const detectedErrors = useMemo(() => {
    const errors: DetectedError[] = []
    const lines = content.split('\n')

    lines.forEach((line, lineIndex) => {
      errorKeywords.forEach(({ keyword, description }) => {
        if (line.toLowerCase().includes(keyword.toLowerCase())) {
          errors.push({
            keyword,
            description,
            line: lineIndex + 1,
            context: line.trim()
          })
        }
      })
    })

    return errors
  }, [content, errorKeywords])

  useEffect(() => {
    if (detectedErrors.length > 0 && !isExpanded) {
      setIsExpanded(true)
    }
  }, [detectedErrors.length])

  const handleAddKeyword = () => {
    if (newKeyword.trim()) {
      onKeywordsChange([
        ...errorKeywords,
        { keyword: newKeyword.trim(), description: newDescription.trim() }
      ])
      setNewKeyword('')
      setNewDescription('')
    }
  }

  const handleEditKeyword = (index: number) => {
    setEditingIndex(index)
    setEditKeyword(errorKeywords[index].keyword)
    setEditDescription(errorKeywords[index].description)
  }

  const handleSaveEdit = () => {
    if (editingIndex !== null && editKeyword.trim()) {
      const newKeywords = [...errorKeywords]
      newKeywords[editingIndex] = {
        keyword: editKeyword.trim(),
        description: editDescription.trim()
      }
      onKeywordsChange(newKeywords)
      setEditingIndex(null)
      setEditKeyword('')
      setEditDescription('')
    }
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditKeyword('')
    setEditDescription('')
  }

  const handleDeleteKeyword = (index: number) => {
    onKeywordsChange(errorKeywords.filter((_, i) => i !== index))
  }

  const handleExport = async () => {
    await window.electronAPI.saveJson(errorKeywords, 'error-keywords.json')
  }

  return (
    <div className={`error-pane ${!isExpanded ? 'collapsed' : ''}`}>
      <div className="error-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="error-title">
          ⚠️ 错误分析
          {detectedErrors.length > 0 && (
            <span className="error-count">{detectedErrors.length}</span>
          )}
        </span>
        <div className="error-header-actions">
          <button
            className="icon-btn config-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowConfig(!showConfig)
            }}
            title="配置错误关键字"
          >
            {showConfig ? '✓ 完成配置' : '⚙️ 配置'}
          </button>
          <span className="toggle-icon">{isExpanded ? '◀' : '▶'}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="error-content">
          {showConfig && (
            <div className="config-section">
              <h4>错误关键字配置</h4>
              <div className="config-inputs">
                <input
                  type="text"
                  placeholder="关键字"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  className="config-input"
                />
                <input
                  type="text"
                  placeholder="描述信息 (格式：该错误为XXX模块，请找某某团队某部分某模块分析)"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="config-input"
                />
                <button onClick={handleAddKeyword} className="add-btn">
                  添加
                </button>
              </div>
              <div className="keyword-list">
                {errorKeywords.map((kw, index) => (
                  <div key={index} className="keyword-item">
                    {editingIndex === index ? (
                      <>
                        <input
                          type="text"
                          value={editKeyword}
                          onChange={(e) => setEditKeyword(e.target.value)}
                          className="edit-input"
                        />
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="edit-input"
                        />
                        <button onClick={handleSaveEdit} className="save-btn">
                          ✓
                        </button>
                        <button onClick={handleCancelEdit} className="cancel-btn">
                          ✗
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="kw-keyword">{kw.keyword}</span>
                        <span className="kw-desc">{kw.description}</span>
                        <button
                          onClick={() => handleEditKeyword(index)}
                          className="edit-btn"
                          title="编辑"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteKeyword(index)}
                          className="delete-btn"
                          title="删除"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={handleExport} className="export-btn">
                导出配置
              </button>
            </div>
          )}

          {!showConfig && detectedErrors.length === 0 && (
            <div className="no-errors">
              {content ? (
                <span>✅ 未检测到错误</span>
              ) : (
                <div className="welcome-config">
                  <span>📝 请先打开日志文件</span>
                  <span style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                    或点击上方「⚙️ 配置」按钮预设错误关键字
                  </span>
                </div>
              )}
            </div>
          )}

          {!showConfig && detectedErrors.length > 0 && (
            <div className="detected-errors">
              <h4>检测到 {detectedErrors.length} 个错误</h4>
              <div className="errors-list">
                {detectedErrors.map((error, index) => (
                  <div key={index} className="error-item">
                    <div className="error-line">行 {error.line}</div>
                    <div className="error-keyword">{error.keyword}</div>
                    <div className="error-description">{error.description}</div>
                    <div className="error-context">{error.context}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ErrorAnalysisPane
