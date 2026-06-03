import React, { useState, useEffect } from 'react'
import { ErrorKeyword, JobKeyword, IgnoreKeyword, CoreDumpKeyword, HighlightConfig, AppConfig, SearchTag, CodeSearchPattern } from '../types'
import { logger, logCategories } from '../utils/logger'
import './KeywordSettingsDialog.css'

interface KeywordSettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  errorKeywords: ErrorKeyword[]
  jobKeywords: JobKeyword[]
  ignoreKeywords: IgnoreKeyword[]
  coreDumpKeywords: CoreDumpKeyword[]
  highlightConfig: HighlightConfig
  searchTags: SearchTag[]
  codeSearchPatterns: CodeSearchPattern[]
  onErrorKeywordsChange: (keywords: ErrorKeyword[]) => void
  onJobKeywordsChange: (keywords: JobKeyword[]) => void
  onIgnoreKeywordsChange: (keywords: IgnoreKeyword[]) => void
  onCoreDumpKeywordsChange: (keywords: CoreDumpKeyword[]) => void
  onHighlightConfigChange: (config: HighlightConfig) => void
  onSearchTagsChange: (tags: SearchTag[]) => void
  onCodeSearchPatternsChange: (patterns: CodeSearchPattern[]) => void
}

type TabType = 'errors' | 'job' | 'ignore' | 'coredump' | 'highlight' | 'codesearch'

const KeywordSettingsDialog: React.FC<KeywordSettingsDialogProps> = ({
  isOpen,
  onClose,
  errorKeywords,
  jobKeywords,
  ignoreKeywords,
  coreDumpKeywords,
  highlightConfig,
  searchTags,
  codeSearchPatterns,
  onErrorKeywordsChange,
  onJobKeywordsChange,
  onIgnoreKeywordsChange,
  onCoreDumpKeywordsChange,
  onHighlightConfigChange,
  onSearchTagsChange,
  onCodeSearchPatternsChange
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('errors')
  const [newKeyword, setNewKeyword] = useState('')
  const [newDescription, setNewDescription] = useState('')

  const [localErrorKeywords, setLocalErrorKeywords] = useState<ErrorKeyword[]>([])
  const [localJobKeywords, setLocalJobKeywords] = useState<JobKeyword[]>([])
  const [localIgnoreKeywords, setLocalIgnoreKeywords] = useState<IgnoreKeyword[]>([])
  const [localCoreDumpKeywords, setLocalCoreDumpKeywords] = useState<CoreDumpKeyword[]>([])
  const [localHighlightConfig, setLocalHighlightConfig] = useState<HighlightConfig>(highlightConfig)
  const [localSearchTags, setLocalSearchTags] = useState<SearchTag[]>(searchTags)
  const [localCodeSearchPatterns, setLocalCodeSearchPatterns] = useState<CodeSearchPattern[]>([])

  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importedConfig, setImportedConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    if (isOpen) {
      setLocalErrorKeywords([...errorKeywords])
      setLocalJobKeywords([...jobKeywords])
      setLocalIgnoreKeywords([...ignoreKeywords])
      setLocalCoreDumpKeywords([...coreDumpKeywords])
      setLocalHighlightConfig({ ...highlightConfig })
      setLocalSearchTags([...searchTags])
      setLocalCodeSearchPatterns([...codeSearchPatterns])
    }
  }, [isOpen, errorKeywords, jobKeywords, ignoreKeywords, coreDumpKeywords, highlightConfig, searchTags, codeSearchPatterns])

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'errors', label: '错误关键字', icon: '⚠️' },
    { key: 'job', label: '作业关键字', icon: '🔄' },
    { key: 'ignore', label: '忽略关键字', icon: '🚫' },
    { key: 'coredump', label: '核心转储关键字', icon: '💥' },
    { key: 'highlight', label: '高亮设置', icon: '🎨' },
    { key: 'codesearch', label: '代码检索', icon: '📄' }
  ]

  const getCurrentKeywords = () => {
    switch (activeTab) {
      case 'errors':
        return localErrorKeywords
      case 'job':
        return localJobKeywords
      case 'ignore':
        return localIgnoreKeywords
      case 'coredump':
        return localCoreDumpKeywords
      default:
        return []
    }
  }

  const handleApply = () => {
    onErrorKeywordsChange(localErrorKeywords)
    onJobKeywordsChange(localJobKeywords)
    onIgnoreKeywordsChange(localIgnoreKeywords)
    onCoreDumpKeywordsChange(localCoreDumpKeywords)
    onHighlightConfigChange(localHighlightConfig)
    onSearchTagsChange(localSearchTags)
    onCodeSearchPatternsChange(localCodeSearchPatterns)
    onClose()
  }

  const handleExport = async () => {
    logger.info(logCategories.APP, '用户点击导出配置按钮')
    try {
      const config: AppConfig = {
        errorKeywords: localErrorKeywords,
        jobKeywords: localJobKeywords,
        ignoreKeywords: localIgnoreKeywords,
        coreDumpKeywords: localCoreDumpKeywords,
        highlightConfig: localHighlightConfig,
        searchTags: localSearchTags
      }
      logger.debug(logCategories.API, '开始导出配置', `包含 ${config.errorKeywords.length} 个错误关键字，${config.searchTags.length} 个快捷标签`)
      const result = await window.electronAPI.exportConfig(config)
      logger.debug(logCategories.API, '导出结果', JSON.stringify(result))

      if (result.success) {
        logger.info(logCategories.APP, '配置导出成功', `保存位置：${result.path || '未知'}`)
        alert(`配置导出成功！\n保存位置：${result.path || '未知'}`)
      } else {
        switch (result.reason) {
          case 'cancelled':
            logger.info(logCategories.APP, '用户取消了导出操作')
            return
          case 'no_path':
            logger.warning(logCategories.APP, '未选择保存路径')
            alert('未选择保存路径')
            break
          case 'write_error':
            logger.error(logCategories.APP, '文件写入失败', result.error || '未知错误')
            alert(`文件写入失败：${result.error || '未知错误'}`)
            break
          default:
            logger.error(logCategories.APP, '配置导出失败', `原因：${result.reason}`)
            alert('配置导出失败')
        }
      }
    } catch (err) {
      logger.error(logCategories.ERROR, '导出操作发生异常', err instanceof Error ? err.message : String(err))
      alert(`配置导出失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleImport = async () => {
    logger.info(logCategories.APP, '用户点击导入配置按钮')
    try {
      logger.debug(logCategories.API, '开始导入配置')
      const result = await window.electronAPI.importConfig()
      logger.debug(logCategories.API, '导入结果', JSON.stringify(result))

      if (result.success) {
        if (result.config) {
          logger.info(logCategories.APP, '配置文件读取成功', `文件路径：${result.path || '未知'}`)
          setImportedConfig(result.config)
          setShowImportDialog(true)
        } else {
          logger.warning(logCategories.APP, '配置文件内容为空')
          alert('配置文件内容为空')
        }
      } else {
        switch (result.reason) {
          case 'cancelled':
            logger.info(logCategories.APP, '用户取消了导入操作')
            return
          case 'no_file':
            logger.warning(logCategories.APP, '未选择文件')
            alert('未选择文件')
            break
          case 'invalid_json':
            logger.error(logCategories.APP, 'JSON 格式无效', result.error || '无法解析文件内容')
            alert(`JSON 格式无效：${result.error || '无法解析文件内容'}`)
            break
          case 'read_error':
            logger.error(logCategories.APP, '文件读取失败', result.error || '未知错误')
            alert(`文件读取失败：${result.error || '未知错误'}`)
            break
          default:
            logger.error(logCategories.APP, '配置导入失败', `原因：${result.reason}`)
            alert('配置导入失败')
        }
      }
    } catch (err) {
      logger.error(logCategories.ERROR, '导入操作发生异常', err instanceof Error ? err.message : String(err))
      alert(`配置导入失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleImportMerge = () => {
    if (!importedConfig) return

    logger.info(logCategories.APP, '用户选择合并导入配置')

    const mergeKeywords = <T extends { keyword: string; enabled: boolean }>(current: T[], imported: T[]): T[] => {
      const existingKeywords = new Set(current.map(k => k.keyword.toLowerCase()))
      const newKeywords = imported.filter(k => !existingKeywords.has(k.keyword.toLowerCase()))
      return [...current, ...newKeywords]
    }

    setLocalErrorKeywords(prev => mergeKeywords(prev, importedConfig.errorKeywords || []))
    setLocalJobKeywords(prev => mergeKeywords(prev, importedConfig.jobKeywords || []))
    setLocalIgnoreKeywords(prev => mergeKeywords(prev, importedConfig.ignoreKeywords || []))
    setLocalCoreDumpKeywords(prev => mergeKeywords(prev, importedConfig.coreDumpKeywords || []))

    if (importedConfig.highlightConfig) {
      setLocalHighlightConfig(importedConfig.highlightConfig)
    }

    if (importedConfig.searchTags) {
      const existingTagNames = new Set(localSearchTags.map(t => t.name.toLowerCase()))
      const newTags = importedConfig.searchTags.filter(t => !existingTagNames.has(t.name.toLowerCase()))
      setLocalSearchTags(prev => [...prev, ...newTags])
    }

    logger.info(logCategories.APP, '合并导入完成', '新的关键字配置已生效')
    setShowImportDialog(false)
    setImportedConfig(null)
  }

  const handleImportReplace = () => {
    if (!importedConfig) return

    logger.info(logCategories.APP, '用户选择替换导入配置')

    if (importedConfig.errorKeywords) setLocalErrorKeywords(importedConfig.errorKeywords)
    if (importedConfig.jobKeywords) setLocalJobKeywords(importedConfig.jobKeywords)
    if (importedConfig.ignoreKeywords) setLocalIgnoreKeywords(importedConfig.ignoreKeywords)
    if (importedConfig.coreDumpKeywords) setLocalCoreDumpKeywords(importedConfig.coreDumpKeywords)
    if (importedConfig.highlightConfig) setLocalHighlightConfig(importedConfig.highlightConfig)
    if (importedConfig.searchTags) setLocalSearchTags(importedConfig.searchTags)

    logger.info(logCategories.APP, '替换导入完成', '导入的配置已完全替换当前配置')
    setShowImportDialog(false)
    setImportedConfig(null)
  }

  const handleImportCancel = () => {
    logger.info(logCategories.APP, '用户取消导入配置')
    setShowImportDialog(false)
    setImportedConfig(null)
  }

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return

    const newItem = {
      keyword: newKeyword.trim(),
      description: newDescription.trim() || '无描述',
      enabled: true
    }

    switch (activeTab) {
      case 'errors':
        setLocalErrorKeywords([...localErrorKeywords, newItem as ErrorKeyword])
        break
      case 'job':
        setLocalJobKeywords([...localJobKeywords, newItem as JobKeyword])
        break
      case 'ignore':
        setLocalIgnoreKeywords([...localIgnoreKeywords, newItem as IgnoreKeyword])
        break
      case 'coredump':
        setLocalCoreDumpKeywords([...localCoreDumpKeywords, newItem as CoreDumpKeyword])
        break
    }

    setNewKeyword('')
    setNewDescription('')
  }

  const handleRemoveKeyword = (index: number) => {
    switch (activeTab) {
      case 'errors':
        setLocalErrorKeywords(localErrorKeywords.filter((_, i) => i !== index))
        break
      case 'job':
        setLocalJobKeywords(localJobKeywords.filter((_, i) => i !== index))
        break
      case 'ignore':
        setLocalIgnoreKeywords(localIgnoreKeywords.filter((_, i) => i !== index))
        break
      case 'coredump':
        setLocalCoreDumpKeywords(localCoreDumpKeywords.filter((_, i) => i !== index))
        break
    }
  }

  const handleToggleKeyword = (index: number) => {
    switch (activeTab) {
      case 'errors':
        setLocalErrorKeywords(
          localErrorKeywords.map((kw, i) =>
            i === index ? { ...kw, enabled: !kw.enabled } : kw
          )
        )
        break
      case 'job':
        setLocalJobKeywords(
          localJobKeywords.map((kw, i) =>
            i === index ? { ...kw, enabled: !kw.enabled } : kw
          )
        )
        break
      case 'ignore':
        setLocalIgnoreKeywords(
          localIgnoreKeywords.map((kw, i) =>
            i === index ? { ...kw, enabled: !kw.enabled } : kw
          )
        )
        break
      case 'coredump':
        setLocalCoreDumpKeywords(
          localCoreDumpKeywords.map((kw, i) =>
            i === index ? { ...kw, enabled: !kw.enabled } : kw
          )
        )
        break
    }
  }

  const handleHighlightChange = (field: keyof HighlightConfig, value: string) => {
    setLocalHighlightConfig({ ...localHighlightConfig, [field]: value })
  }

  if (!isOpen) return null

  return (
    <div className="keyword-settings-overlay" onClick={onClose}>
      <div className="keyword-settings-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>关键字设置</h2>
          <div className="header-actions">
            <button className="export-btn" onClick={handleExport}>📤 导出</button>
            <button className="import-btn" onClick={handleImport}>📥 导入</button>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="dialog-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="dialog-content">
          {activeTab === 'highlight' ? (
            <>
              <h4>高亮样式设置</h4>
              <div className="highlight-settings">
                <div className="setting-item">
                  <label>背景颜色:</label>
                  <input
                    type="color"
                    value={localHighlightConfig.backgroundColor}
                    onChange={e => handleHighlightChange('backgroundColor', e.target.value)}
                  />
                </div>
                <div className="setting-item">
                  <label>文字颜色:</label>
                  <input
                    type="color"
                    value={localHighlightConfig.textColor}
                    onChange={e => handleHighlightChange('textColor', e.target.value)}
                  />
                </div>
                <div className="setting-item">
                  <label>边框颜色:</label>
                  <input
                    type="color"
                    value={localHighlightConfig.borderColor}
                    onChange={e => handleHighlightChange('borderColor', e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : activeTab === 'codesearch' ? (
            <>
              <h4>代码检索模式配置</h4>
              <div className="code-search-patterns-info">
                <p>配置代码日志检索使用的正则表达式模式（离线模式）</p>
              </div>
              <div className="pattern-list">
                {localCodeSearchPatterns.map((pattern, index) => (
                  <div key={pattern.id} className="pattern-item">
                    <input
                      type="checkbox"
                      checked={pattern.enabled}
                      onChange={() => {
                        const newPatterns = [...localCodeSearchPatterns]
                        newPatterns[index] = { ...newPatterns[index], enabled: !newPatterns[index].enabled }
                        setLocalCodeSearchPatterns(newPatterns)
                      }}
                    />
                    <span className="pattern-name">{pattern.name}</span>
                    <span className="pattern-pattern">{pattern.pattern}</span>
                    <span className="pattern-desc">{pattern.description}</span>
                    <button
                      className="remove-btn"
                      onClick={() => {
                        setLocalCodeSearchPatterns(localCodeSearchPatterns.filter((_, i) => i !== index))
                      }}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
              <div className="add-pattern">
                <input
                  type="text"
                  placeholder="模式名称"
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="正则表达式"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                />
                <button
                  className="add-btn"
                  onClick={() => {
                    if (newKeyword.trim() && newDescription.trim()) {
                      setLocalCodeSearchPatterns([
                        ...localCodeSearchPatterns,
                        {
                          id: Date.now().toString(),
                          name: newKeyword.trim(),
                          pattern: newDescription.trim(),
                          description: '',
                          enabled: true
                        }
                      ])
                      setNewKeyword('')
                      setNewDescription('')
                    }
                  }}
                >
                  添加
                </button>
              </div>
              <button
                className="reset-btn"
                onClick={() => {
                  const defaultPatterns = [
                    { id: '1', name: 'LOGE错误', pattern: 'LOGE\\s*\\(\\s*"[^"]*"', description: 'C/C++ LOGE打印错误', enabled: true },
                    { id: '2', name: 'VIDEO_LOGE错误', pattern: 'VIDEO_LOGE\\s*\\(\\s*"[^"]*"', description: 'C/C++ VIDEO_LOGE打印错误', enabled: true }
                  ]
                  setLocalCodeSearchPatterns(defaultPatterns)
                }}
              >
                恢复默认
              </button>
            </>
          ) : (
            <>
              <h4>{tabs.find(t => t.key === activeTab)?.label}</h4>
              <div className="keyword-list">
                {getCurrentKeywords().map((item, index) => (
                  <div key={index} className="keyword-item">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => handleToggleKeyword(index)}
                    />
                    <span className="keyword-text">{item.keyword}</span>
                    <span className="keyword-desc">{item.description}</span>
                    <button className="remove-btn" onClick={() => handleRemoveKeyword(index)}>
                      删除
                    </button>
                  </div>
                ))}
              </div>
              <div className="add-keyword">
                <input
                  type="text"
                  placeholder="关键字"
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleAddKeyword()}
                />
                <input
                  type="text"
                  placeholder="描述（可选）"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleAddKeyword()}
                />
                <button className="add-btn" onClick={handleAddKeyword}>添加</button>
              </div>
            </>
          )}
        </div>

        <div className="dialog-footer">
          <button className="apply-btn" onClick={handleApply}>应用</button>
          <button className="cancel-btn" onClick={onClose}>关闭</button>
        </div>

        {showImportDialog && (
          <div className="import-dialog-overlay">
            <div className="import-dialog">
              <h3>导入配置</h3>
              <p>检测到配置文件，请选择导入方式：</p>
              <div className="import-options">
                <button className="import-option-btn" onClick={handleImportMerge}>
                  🔄 合并导入<br/>
                  <span className="option-desc">保留当前配置，添加新的配置项</span>
                </button>
                <button className="import-option-btn" onClick={handleImportReplace}>
                  📝 完全替换<br/>
                  <span className="option-desc">使用导入的配置完全替换当前配置</span>
                </button>
              </div>
              <button className="cancel-btn" onClick={handleImportCancel}>取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default KeywordSettingsDialog