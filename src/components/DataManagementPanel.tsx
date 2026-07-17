import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { ModuleLog, ModuleMapping } from '../types'
import ThinkingOverlay from './ThinkingOverlay'
import './DataManagementPanel.css'

interface DataManagementPanelProps {
  projectList: string[]
  activeProject: string
  moduleLogs: ModuleLog[]
  moduleMappings: ModuleMapping[]
  stagedModuleLogs: ModuleLog[]
  stagedModuleMappings: ModuleMapping[]
  isBusy?: boolean
  onSwitchProject: (name: string) => void
  onCreateProject: (name: string) => void
  onDeleteProject: (name: string) => void
  onChangeModuleMappings: (mappings: ModuleMapping[]) => void
  onRemoveModuleLog: (id: string) => void
  onUpdateModuleLog: (id: string, content: string) => void
  onStageImportModuleLog: () => void
  onMergeModuleLog: () => void
  onStageImportModuleMapping: () => void
  onMergeModuleMapping: () => void
  onClearStagedModuleLogs: () => void
  onClearStagedModuleMappings: () => void
  onShowNotification: (message: string) => void
  onClose: () => void
}

type TabKey = 'mappings' | 'logs'

// 从模块日志 content 中解析出逐条代码日志数组（兼容多种导入格式）
function parseEntries(content?: string): any[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.codeSearchResults)) return parsed.codeSearchResults
    if (parsed && parsed.data && Array.isArray(parsed.data.searchResults)) return parsed.data.searchResults
    return []
  } catch {
    return []
  }
}

function getFileName(e: any): string {
  if (e?.codeFile?.fileName) return e.codeFile.fileName
  if (e?.fileName) return e.fileName
  return ''
}

function setFileName(e: any, val: string): any {
  if (e?.codeFile) return { ...e, codeFile: { ...e.codeFile, fileName: val } }
  return { ...e, fileName: val }
}

// 日志分组组件，仅在展开时解析并渲染表格
const LogGroup = React.memo(({
  log,
  expanded,
  onToggle,
  onRemoveModuleLog,
  onUpdateModuleLog,
  onExportLog,
}: {
  log: ModuleLog
  expanded: boolean
  onToggle: () => void
  onRemoveModuleLog: (id: string) => void
  onUpdateModuleLog: (id: string, content: string) => void
  onExportLog: (log: ModuleLog) => void
}) => {
  const entries = useMemo(() => (expanded ? parseEntries(log.content) : []), [expanded, log.content])

  const updateEntry = useCallback((index: number, field: 'fileName' | 'line' | 'functionName' | 'matchedPattern' | 'matchedText', value: any) => {
    if (index < 0 || index >= entries.length) return
    const next = entries.map((e, i) => {
      if (i !== index) return e
      if (field === 'fileName') return setFileName(e, value)
      if (field === 'line') return { ...e, line: value }
      return { ...e, [field]: value }
    })
    onUpdateModuleLog(log.id, JSON.stringify(next, null, 2))
  }, [entries, log.id, onUpdateModuleLog])

  const deleteEntry = useCallback((index: number) => {
    const next = entries.filter((_, i) => i !== index)
    onUpdateModuleLog(log.id, JSON.stringify(next, null, 2))
  }, [entries, log.id, onUpdateModuleLog])

  const addEntry = useCallback(() => {
    const newEntry = { codeFile: { fileName: '' }, line: 0, functionName: '', matchedPattern: '', matchedText: '' }
    onUpdateModuleLog(log.id, JSON.stringify([...entries, newEntry], null, 2))
  }, [entries, log.id, onUpdateModuleLog])

  return (
    <div className="dm-log-group">
      <div className="dm-log-group-header" onClick={onToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onToggle() }}>
        <span className={`dm-log-group-arrow ${expanded ? 'expanded' : ''}`}>{expanded ? '▼' : '▶'}</span>
        <span className="dm-log-group-name">📄 {log.name}</span>
        <span className="dm-log-group-meta">
          {log.lineCount} 条 · 导入 {log.importedAt ? new Date(log.importedAt).toLocaleString() : '—'}
        </span>
        <button
          className="dm-btn small"
          title="导出此模块日志"
          onClick={(e) => {
            e.stopPropagation()
            onExportLog(log)
          }}
        >📤 导出</button>
        <button
          className="dm-btn danger small"
          title="删除整个文件"
          onClick={(e) => {
            e.stopPropagation()
            if (window.confirm(`确定要删除模块日志「${log.name}」吗？此操作不可恢复！`)) {
              onRemoveModuleLog(log.id)
            }
          }}
        >删除整个文件</button>
      </div>
      {expanded && (
        <>
          <div className="dm-table-wrap">
            <table className="dm-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>代码文件</th>
                  <th style={{ width: '70px' }}>行号</th>
                  <th>函数名</th>
                  <th>匹配模式</th>
                  <th>匹配文本</th>
                  <th style={{ width: '64px' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr className="dm-empty-row"><td colSpan={7}>该文件无有效条目</td></tr>
                ) : (
                  entries.map((entry, ei) => (
                    <tr key={ei}>
                      <td>{ei + 1}</td>
                      <td>
                        <input className="dm-cell-input" value={getFileName(entry)} onChange={(e) => updateEntry(ei, 'fileName', e.target.value)} />
                      </td>
                      <td>
                        <input className="dm-cell-input" type="number" value={entry.line ?? 0} onChange={(e) => updateEntry(ei, 'line', parseInt(e.target.value, 10) || 0)} />
                      </td>
                      <td>
                        <input className="dm-cell-input" value={entry.functionName || ''} onChange={(e) => updateEntry(ei, 'functionName', e.target.value)} />
                      </td>
                      <td>
                        <input className="dm-cell-input" value={entry.matchedPattern || ''} onChange={(e) => updateEntry(ei, 'matchedPattern', e.target.value)} />
                      </td>
                      <td>
                        <input className="dm-cell-input" value={entry.matchedText || ''} onChange={(e) => updateEntry(ei, 'matchedText', e.target.value)} />
                      </td>
                      <td>
                        <button className="dm-btn danger small" onClick={() => deleteEntry(ei)}>删除</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="dm-group-actions">
            <button className="dm-btn small" onClick={addEntry}>+ 新增条目</button>
          </div>
        </>
      )}
    </div>
  )
})

LogGroup.displayName = 'LogGroup'

const DataManagementPanel: React.FC<DataManagementPanelProps> = ({
  projectList,
  activeProject,
  moduleLogs,
  moduleMappings,
  stagedModuleLogs,
  stagedModuleMappings,
  isBusy,
  onSwitchProject,
  onCreateProject,
  onDeleteProject,
  onChangeModuleMappings,
  onRemoveModuleLog,
  onUpdateModuleLog,
  onStageImportModuleLog,
  onMergeModuleLog,
  onStageImportModuleMapping,
  onMergeModuleMapping,
  onClearStagedModuleLogs,
  onClearStagedModuleMappings,
  onShowNotification,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('mappings')
  const [searchTerm, setSearchTerm] = useState('')
  const [creating, setCreating] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }, [closing, onClose])

  const hasProject = !!activeProject

  const handleConfirmCreate = useCallback(() => {
    const name = newProjectName.trim()
    if (name) onCreateProject(name)
    setNewProjectName('')
    setCreating(false)
  }, [newProjectName, onCreateProject])

  const handleMappingChange = useCallback((index: number, field: keyof ModuleMapping, value: string) => {
    onChangeModuleMappings(moduleMappings.map((m, i) => (i === index ? { ...m, [field]: value } : m)))
  }, [moduleMappings, onChangeModuleMappings])

  const handleAddMapping = useCallback(() => {
    onChangeModuleMappings([...moduleMappings, { codePath: '', moduleName: '', contactName: '' }])
  }, [moduleMappings, onChangeModuleMappings])

  const handleDeleteMapping = useCallback((index: number) => {
    onChangeModuleMappings(moduleMappings.filter((_, i) => i !== index))
  }, [moduleMappings, onChangeModuleMappings])

  const handleClearMappings = useCallback(() => {
    if (moduleMappings.length === 0) return
    if (!window.confirm('确定要清空当前项目的模块负责人表吗？此操作不可恢复！')) return
    onChangeModuleMappings([])
    onShowNotification('模块负责人表已清空')
  }, [moduleMappings, onChangeModuleMappings, onShowNotification])

  const handleExportMappings = useCallback(async () => {
    const data = { version: '2.0', mappings: moduleMappings }
    await window.electronAPI.saveJson(data, `模块负责人表_${activeProject}_${new Date().toISOString().slice(0, 10)}.json`)
    onShowNotification('模块负责人表已导出')
  }, [moduleMappings, activeProject, onShowNotification])

  const handleExportModuleLog = useCallback(async (log: ModuleLog) => {
    await window.electronAPI.saveJson(log.content ? JSON.parse(log.content) : [], `${log.name}_${new Date().toISOString().slice(0, 10)}.json`)
    onShowNotification(`模块日志「${log.name}」已导出`)
  }, [onShowNotification])

  const toggleLogGroup = useCallback((id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpandedLogs(new Set(moduleLogs.map(l => l.id)))
  }, [moduleLogs])

  const collapseAll = useCallback(() => {
    setExpandedLogs(new Set())
  }, [])

  // 搜索时自动展开匹配的分组，展示匹配结果
  useEffect(() => {
    if (!searchTerm) return
    const t = searchTerm.toLowerCase()
    const ids = new Set<string>()
    moduleLogs.forEach(l => {
      if ((l.name || '').toLowerCase().includes(t)) { ids.add(l.id); return }
      const entries = parseEntries(l.content)
      if (entries.some(e =>
        getFileName(e).toLowerCase().includes(t) ||
        (e.functionName || '').toLowerCase().includes(t) ||
        (e.matchedPattern || '').toLowerCase().includes(t) ||
        (e.matchedText || '').toLowerCase().includes(t)
      )) { ids.add(l.id) }
    })
    setExpandedLogs(ids)
  }, [searchTerm, moduleLogs])

  const filteredMappings = useMemo(() =>
    moduleMappings
      .map((m, index) => ({ m, index }))
      .filter(({ m }) => {
        if (!searchTerm) return true
        const t = searchTerm.toLowerCase()
        return (
          (m.codePath || '').toLowerCase().includes(t) ||
          (m.moduleName || '').toLowerCase().includes(t) ||
          (m.contactName || '').toLowerCase().includes(t)
        )
      }),
    [moduleMappings, searchTerm]
  )

  // 模块日志过滤：搜索时解析条目内容做全字段匹配，空搜索时零解析
  const displayLogs = useMemo(() => {
    if (!searchTerm) return moduleLogs
    const t = searchTerm.toLowerCase()
    return moduleLogs.filter(l => {
      if ((l.name || '').toLowerCase().includes(t)) return true
      // 搜索条目内容：仅搜索时解析（与折叠态互不干扰）
      const entries = parseEntries(l.content)
      return entries.some(e =>
        getFileName(e).toLowerCase().includes(t) ||
        (e.functionName || '').toLowerCase().includes(t) ||
        (e.matchedPattern || '').toLowerCase().includes(t) ||
        (e.matchedText || '').toLowerCase().includes(t)
      )
    })
  }, [moduleLogs, searchTerm])

  const totalEntries = useMemo(() =>
    moduleLogs.reduce((sum, l) => sum + (l.lineCount || 0), 0),
    [moduleLogs]
  )

  return (
    <div className={`dm-overlay ${closing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`dm-panel ${closing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="dm-header">
          <span className="dm-title">🔄 数据管理</span>
          <div className="dm-project-area">
            <span className="dm-project-label">当前项目</span>
            {creating ? (
              <input
                className="dm-project-input"
                autoFocus
                placeholder="输入项目名称"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmCreate()
                  if (e.key === 'Escape') { setCreating(false); setNewProjectName('') }
                }}
                onBlur={handleConfirmCreate}
              />
            ) : (
              <select
                className="dm-project-select"
                value={activeProject}
                onChange={(e) => onSwitchProject(e.target.value)}
                disabled={projectList.length === 0}
              >
                {projectList.length === 0 && <option value="">（无项目）</option>}
                {projectList.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <button className="dm-mini-btn" title="新建项目" onClick={() => setCreating(true)}>＋</button>
            <button
              className="dm-mini-btn danger"
              title="删除当前项目"
              disabled={!hasProject}
              onClick={() => {
                if (!hasProject) return
                if (window.confirm(`确定要删除项目「${activeProject}」及其全部配置吗？此操作不可恢复！`)) {
                  onDeleteProject(activeProject)
                }
              }}
            >🗑</button>
          </div>
          <button className="dm-close" onClick={handleClose}>×</button>
        </div>

        <div className="dm-toolbar">
          <input
            className="dm-search"
            type="text"
            placeholder="搜索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="dm-tabs">
            <button
              className={`dm-tab ${activeTab === 'mappings' ? 'active' : ''}`}
              onClick={() => setActiveTab('mappings')}
            >
              模块负责人表 ({moduleMappings.length})
            </button>
            <button
              className={`dm-tab ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              模块日志表 ({moduleLogs.length} 文件 / {totalEntries} 条)
            </button>
          </div>
        </div>

        <div className="dm-content">
          {!hasProject ? (
            <div className="dm-empty">
              <p>暂无项目，请先新建一个项目</p>
              <button className="dm-btn primary" onClick={() => setCreating(true)}>＋ 新建项目</button>
            </div>
          ) : activeTab === 'mappings' ? (
            <>
              <div className="dm-section-header">
                <span className="dm-section-hint">可直接编辑单元格，修改自动保存到项目配置</span>
                <div className="dm-section-actions">
                  <button className="dm-btn primary" onClick={handleAddMapping}>+ 新增</button>
                  <button className="dm-btn" onClick={onStageImportModuleMapping}>+ 导入</button>
                  <button className="dm-btn" onClick={onMergeModuleMapping} disabled={stagedModuleMappings.length === 0}>合并 ({stagedModuleMappings.length})</button>
                  <button className="dm-btn" onClick={handleExportMappings} disabled={moduleMappings.length === 0}>📤 导出</button>
                  <button className="dm-btn danger" onClick={handleClearMappings} disabled={moduleMappings.length === 0}>一键清空</button>
                </div>
              </div>
              {stagedModuleMappings.length > 0 && (
                <div className="dm-staged-banner">
                  <span>📥 待合并映射表：{stagedModuleMappings.length} 条（{stagedModuleMappings.map(m => m.moduleName || m.codePath).filter(Boolean).join('、') || '未命名'}）</span>
                  <span className="dm-staged-actions">
                    <button className="dm-btn small primary" onClick={onMergeModuleMapping}>立即合并</button>
                    <button className="dm-btn small" onClick={onClearStagedModuleMappings}>清空暂存</button>
                  </span>
                </div>
              )}
              <div className="dm-table-wrap">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th style={{ width: '48px' }}>#</th>
                      <th>代码路径</th>
                      <th>模块名称</th>
                      <th>负责人</th>
                      <th style={{ width: '72px' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMappings.length === 0 ? (
                      <tr className="dm-empty-row"><td colSpan={5}>暂无数据</td></tr>
                    ) : (
                      filteredMappings.map(({ m, index }, i) => (
                        <tr key={index}>
                          <td>{i + 1}</td>
                          <td>
                            <input className="dm-cell-input" value={m.codePath || ''} onChange={(e) => handleMappingChange(index, 'codePath', e.target.value)} />
                          </td>
                          <td>
                            <input className="dm-cell-input" value={m.moduleName || ''} onChange={(e) => handleMappingChange(index, 'moduleName', e.target.value)} />
                          </td>
                          <td>
                            <input className="dm-cell-input" value={m.contactName || ''} onChange={(e) => handleMappingChange(index, 'contactName', e.target.value)} />
                          </td>
                          <td>
                            <button className="dm-btn danger small" onClick={() => handleDeleteMapping(index)}>删除</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="dm-section-header">
                <span className="dm-section-hint">模块日志按文件分组，点击展开编辑逐条明细（代码文件 / 行号 / 函数名 / 匹配模式 / 匹配文本）</span>
                <div className="dm-section-actions">
                  {expandedLogs.size < moduleLogs.length && (
                    <button className="dm-btn small" onClick={expandAll}>全部展开</button>
                  )}
                  {expandedLogs.size > 0 && (
                    <button className="dm-btn small" onClick={collapseAll}>全部折叠</button>
                  )}
                  <button className="dm-btn primary" onClick={onStageImportModuleLog}>+ 导入</button>
                  <button className="dm-btn" onClick={onMergeModuleLog} disabled={stagedModuleLogs.length === 0}>合并 ({stagedModuleLogs.length})</button>
                </div>
              </div>
              {stagedModuleLogs.length > 0 && (
                <div className="dm-staged-banner">
                  <span>📥 待合并模块日志：{stagedModuleLogs.length} 个（{stagedModuleLogs.map(l => l.name).join('、')}）</span>
                  <span className="dm-staged-actions">
                    <button className="dm-btn small primary" onClick={onMergeModuleLog}>立即合并</button>
                    <button className="dm-btn small" onClick={onClearStagedModuleLogs}>清空暂存</button>
                  </span>
                </div>
              )}
              <div className="dm-logs-groups">
                {displayLogs.length === 0 ? (
                  <div className="dm-empty"><p>暂无模块日志，点击右上角导入</p></div>
                ) : (
                  displayLogs.map((log) => (
                    <LogGroup
                      key={log.id}
                      log={log}
                      expanded={expandedLogs.has(log.id)}
                      onToggle={() => toggleLogGroup(log.id)}
                      onRemoveModuleLog={onRemoveModuleLog}
                      onUpdateModuleLog={onUpdateModuleLog}
                      onExportLog={handleExportModuleLog}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <ThinkingOverlay show={!!isBusy} title="正在处理…" subtitle="正在深度合并模块数据，请稍候" />
    </div>
  )
}

export default DataManagementPanel
