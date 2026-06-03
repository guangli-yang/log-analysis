import React, { useState, useEffect, useRef } from 'react'
import { SearchOptions } from '../types'
import './AddTagDialog.css'

interface AddTagDialogProps {
  isVisible: boolean
  currentSearchQuery: string
  currentSearchOptions: SearchOptions
  onConfirm: (name: string, query: string, options: SearchOptions) => void
  onCancel: () => void
}

const AddTagDialog: React.FC<AddTagDialogProps> = ({
  isVisible,
  currentSearchQuery,
  currentSearchOptions,
  onConfirm,
  onCancel
}) => {
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<SearchOptions>(currentSearchOptions)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isVisible) {
      setName('')
      setQuery(currentSearchQuery || '')
      setOptions(currentSearchOptions)
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 100)
    }
  }, [isVisible, currentSearchQuery, currentSearchOptions])

  const handleConfirm = () => {
    if (name.trim() && query.trim()) {
      onConfirm(name.trim(), query.trim(), options)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  const toggleOption = (key: keyof SearchOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (!isVisible) return null

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="add-tag-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-title">添加快捷标签</span>
          <button className="dialog-close" onClick={onCancel}>×</button>
        </div>
        <div className="dialog-content">
          <div className="form-group">
            <label className="form-label">标签名称</label>
            <input
              ref={nameInputRef}
              type="text"
              className="form-input"
              placeholder="例如：错误信息"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="form-group">
            <label className="form-label">搜索词条</label>
            <input
              type="text"
              className="form-input"
              placeholder="输入搜索关键词"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="form-group">
            <label className="form-label">搜索选项</label>
            <div className="options-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={options.caseSensitive}
                  onChange={() => toggleOption('caseSensitive')}
                />
                <span>区分大小写</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={options.wholeWord}
                  onChange={() => toggleOption('wholeWord')}
                />
                <span>全词匹配</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={options.useRegex}
                  onChange={() => toggleOption('useRegex')}
                />
                <span>正则表达式</span>
              </label>
            </div>
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn-cancel" onClick={onCancel}>取消</button>
          <button
            className="btn-confirm"
            onClick={handleConfirm}
            disabled={!name.trim() || !query.trim()}
          >
            确认添加
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddTagDialog