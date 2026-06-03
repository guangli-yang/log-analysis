import React, { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import Dexie from 'dexie'

class LogAnalyzerDB {
  constructor() {
    this.db = new Dexie('LogAnalyzerDB_Standalone_v2')
    this.db.version(1).stores({
      moduleMappings: '++id, codePath, moduleName, contactName',
      searchResults: '++id, functionName, matchedPattern'
    })
  }

  async getAll(table) {
    return await this.db[table].toArray()
  }

  async add(table, data) {
    return await this.db[table].add(data)
  }

  async update(table, key, data) {
    return await this.db[table].update(key, data)
  }

  async delete(table, key) {
    return await this.db[table].delete(key)
  }

  async clear(table) {
    return await this.db[table].clear()
  }

  async count(table) {
    return await this.db[table].count()
  }
}

const database = new LogAnalyzerDB()

function EditableCell({ value, onChange, type = 'text' }) {
  const handleChange = (e) => onChange(e.target.value)

  if (type === 'number') {
    return <input type="number" className="editable-input" value={value || ''} onChange={handleChange} />
  }

  return <input type="text" className="editable-input" value={value || ''} onChange={handleChange} />
}

async function generateChecksum(data: any): Promise<string> {
  const str = JSON.stringify({ version: data.version, exportedAt: data.exportedAt, data: data.data })
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `hash:${Math.abs(hash).toString(16)}`
}

async function exportData(targetTab: 'mappings' | 'results') {
  const deviceId = `standalone_${Date.now()}`
  const fileName = targetTab === 'mappings' ? 'ModuleMapping' : 'CodeLog'

  if (targetTab === 'mappings') {
    const mappings = await database.getAll('moduleMappings')
    const data: any = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      deviceId,
      deviceName: navigator.userAgent,
      data: { moduleMappings: mappings, searchResults: [], keywords: [] }
    }
    data.checksum = await generateChecksum(data)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `LogAnalyzer_${fileName}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    return { mappings: mappings.length, results: 0 }
  } else {
    const results = await database.getAll('searchResults')
    const data: any = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      deviceId,
      deviceName: navigator.userAgent,
      data: { moduleMappings: [], searchResults: results, keywords: [] }
    }
    data.checksum = await generateChecksum(data)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `LogAnalyzer_${fileName}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    return { mappings: 0, results: results.length }
  }
}

async function importData(fileData: any, targetTab: 'mappings' | 'results', mode: 'overwrite' | 'merge' = 'overwrite') {
  if (!fileData || typeof fileData !== 'object') {
    throw new Error('无效的文件格式')
  }

  if (targetTab === 'mappings') {
    if (mode === 'overwrite') {
      await database.clear('moduleMappings')
    }
    const moduleMappings = fileData.data?.moduleMappings || fileData.mappings || []
    if (moduleMappings?.length > 0) {
      await database.db.moduleMappings.bulkAdd(moduleMappings)
    }
    return { mappings: moduleMappings.length, results: 0 }
  } else {
    if (mode === 'overwrite') {
      await database.clear('searchResults')
    }
    const searchResults = fileData.data?.searchResults || fileData.searchResults || fileData.codeSearchResults || []
    if (searchResults?.length > 0) {
      await database.db.searchResults.bulkAdd(searchResults)
    }
    return { mappings: 0, results: searchResults.length }
  }
}

async function addSampleData() {
  const sampleMappings = [
    { codePath: 'project\\1', moduleName: '打印模块', contactName: '张三' },
    { codePath: 'project\\2', moduleName: '编码模块', contactName: '王五' },
    { codePath: 'project\\3', moduleName: '解码模块', contactName: '赵六' },
    { codePath: 'project\\4', moduleName: '网络模块', contactName: '李四' },
  ]

  const sampleResults = [
    { codeFile: { fileName: 'C:\\project\\2\\network.c' }, line: 88, functionName: 'sendData', matchedPattern: 'LOGE错误', matchedText: 'Network send error' },
    { codeFile: { fileName: 'C:\\project\\1\\audio.cpp' }, line: 200, functionName: 'playAudio', matchedPattern: 'LOGE错误', matchedText: 'Audio buffer underrun' },
    { codeFile: { fileName: 'C:\\project\\3\\decoder.c' }, line: 45, functionName: 'decodeFrame', matchedPattern: 'LOGE错误', matchedText: 'Decode failed' },
  ]

  await database.db.moduleMappings.bulkAdd(sampleMappings)
  await database.db.searchResults.bulkAdd(sampleResults)
}

function App() {
  const [activeTab, setActiveTab] = useState('mappings')
  const [counts, setCounts] = useState({ mappings: 0, results: 0 })
  const [mappings, setMappings] = useState([])
  const [results, setResults] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [toast, setToast] = useState(null)
  const [modifiedMappings, setModifiedMappings] = useState(new Set())
  const [modifiedResults, setModifiedResults] = useState(new Set())
  const [newMappings, setNewMappings] = useState([])
  const [newResults, setNewResults] = useState([])
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('overwrite')
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [m, r, cm, cr] = await Promise.all([
      database.getAll('moduleMappings'),
      database.getAll('searchResults'),
      database.count('moduleMappings'),
      database.count('searchResults')
    ])
    setMappings(m)
    setResults(r)
    setCounts({ mappings: cm, results: cr })
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleExport = async () => {
    try {
      const result = await exportData(activeTab)
      if (activeTab === 'mappings') {
        showToast(`导出成功！模块负责人表: ${result.mappings} 条`)
      } else {
        showToast(`导出成功！模块配置表: ${result.results} 条`)
      }
    } catch (err) {
      showToast('导出失败', 'error')
    }
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const result = await importData(data, activeTab, importMode)
      await loadData()
      setModifiedMappings(new Set())
      setModifiedResults(new Set())
      setNewMappings([])
      setNewResults([])
      const modeText = importMode === 'merge' ? '合并导入' : '覆盖导入'
      if (activeTab === 'mappings') {
        showToast(`${modeText}成功！模块负责人表: ${result.mappings} 条`)
      } else {
        showToast(`${modeText}成功！模块配置表: ${result.results} 条`)
      }
    } catch (err) {
      showToast('导入失败: ' + err.message, 'error')
    }

    e.target.value = ''
  }

  const handleAddSample = async () => {
    await addSampleData()
    await loadData()
    showToast('示例数据添加成功')
  }

  const handleMappingChange = (index, field, value) => {
    const newMappingsList = [...mappings]
    newMappingsList[index] = { ...newMappingsList[index], [field]: value }
    setMappings(newMappingsList)
    setModifiedMappings(prev => new Set([...prev, index]))
  }

  const handleResultChange = (index, field, value) => {
    const newResultsList = [...results]
    if (field === 'line') {
      newResultsList[index] = { ...newResultsList[index], [field]: parseInt(value) || 0 }
    } else if (field === 'fileName') {
      newResultsList[index] = { ...newResultsList[index], codeFile: { fileName: value } }
    } else {
      newResultsList[index] = { ...newResultsList[index], [field]: value }
    }
    setResults(newResultsList)
    setModifiedResults(prev => new Set([...prev, index]))
  }

  const handleAddMappingRow = () => {
    const timestamp = Date.now()
    setNewMappings(prev => [...prev, {
      codePath: `path\\module_${timestamp}`,
      moduleName: `模块_${timestamp}`,
      contactName: ''
    }])
  }

  const handleAddResultRow = () => {
    const timestamp = Date.now()
    setNewResults(prev => [...prev, {
      codeFile: { fileName: `C:\\project\\file_${timestamp}.c` },
      line: 0,
      functionName: `function_${timestamp}`,
      matchedPattern: 'LOGE错误',
      matchedText: ''
    }])
  }

  const handleNewMappingChange = (index, field, value) => {
    const updated = [...newMappings]
    updated[index] = { ...updated[index], [field]: value }
    setNewMappings(updated)
  }

  const handleNewResultChange = (index, field, value) => {
    const updated = [...newResults]
    if (field === 'line') {
      updated[index] = { ...updated[index], [field]: parseInt(value) || 0 }
    } else if (field === 'fileName') {
      updated[index] = { ...updated[index], codeFile: { fileName: value } }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setNewResults(updated)
  }

  const handleRemoveNewMapping = (index) => {
    setNewMappings(prev => prev.filter((_, i) => i !== index))
  }

  const handleRemoveNewResult = (index) => {
    setNewResults(prev => prev.filter((_, i) => i !== index))
  }

  const handleSaveAll = async () => {
    try {
      let savedMappings = 0
      let savedResults = 0

      for (const index of modifiedMappings) {
        const m = mappings[index]
        await database.update('moduleMappings', m.id, {
          codePath: m.codePath,
          moduleName: m.moduleName,
          contactName: m.contactName
        })
        savedMappings++
      }

      for (const index of modifiedResults) {
        const r = results[index]
        await database.update('searchResults', r.id, {
          codeFile: r.codeFile,
          line: r.line,
          functionName: r.functionName,
          matchedPattern: r.matchedPattern,
          matchedText: r.matchedText
        })
        savedResults++
      }

      for (const m of newMappings) {
        await database.add('moduleMappings', m)
        savedMappings++
      }

      for (const r of newResults) {
        await database.add('searchResults', r)
        savedResults++
      }

      setModifiedMappings(new Set())
      setModifiedResults(new Set())
      setNewMappings([])
      setNewResults([])
      await loadData()
      showToast(`保存成功！模块负责人表: ${savedMappings}, 模块配置表: ${savedResults}`)
    } catch (err) {
      showToast('保存失败: ' + err.message, 'error')
    }
  }

  const handleDelete = async (type, id) => {
    if (!confirm('确定要删除这条记录吗？')) return

    try {
      if (type === 'mapping') {
        await database.delete('moduleMappings', id)
      } else if (type === 'result') {
        await database.delete('searchResults', id)
      }
      await loadData()
      showToast('删除成功')
    } catch (err) {
      showToast('删除失败', 'error')
    }
  }

  const handleClearMappings = async () => {
    if (!confirm('确定要清除所有模块负责人表数据吗？此操作不可恢复！')) return
    try {
      await database.clear('moduleMappings')
      setMappings([])
      setCounts(prev => ({ ...prev, mappings: 0 }))
      showToast('模块负责人表已清空')
    } catch (err) {
      showToast('清除失败', 'error')
    }
  }

  const handleClearResults = async () => {
    if (!confirm('确定要清除所有模块配置表数据吗？此操作不可恢复！')) return
    try {
      await database.clear('searchResults')
      setResults([])
      setCounts(prev => ({ ...prev, results: 0 }))
      showToast('模块配置表已清空')
    } catch (err) {
      showToast('清除失败', 'error')
    }
  }

  const filteredMappings = mappings.filter(m =>
    m.codePath?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.moduleName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.contactName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredResults = results.filter(r =>
    r.functionName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.matchedPattern?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const hasModifications = modifiedMappings.size > 0 || modifiedResults.size > 0 || newMappings.length > 0 || newResults.length > 0

  return (
    React.createElement('div', { className: 'app-container' },
      React.createElement('div', { className: 'header' },
        React.createElement('h1', null, '📥 数据管理'),
        React.createElement('span', { className: 'device-info' }, '设备: ', navigator.userAgent.split(' ').slice(-2).join(' '))
      ),
      React.createElement('div', { className: 'toolbar' },
        React.createElement('input', {
          type: 'text',
          placeholder: '搜索...',
          value: searchTerm,
          onChange: e => setSearchTerm(e.target.value),
          className: 'search-input'
        }),
        React.createElement('button', { className: 'btn btn-primary', onClick: handleExport }, '📤 导出'),
        React.createElement('button', { className: 'btn btn-secondary', onClick: handleImportClick }, '📥 导入'),
        React.createElement('select', {
          value: importMode,
          onChange: e => setImportMode(e.target.value as 'overwrite' | 'merge'),
          style: { padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px' }
        },
          React.createElement('option', { value: 'overwrite' }, '覆盖导入'),
          React.createElement('option', { value: 'merge' }, '合并导入')
        ),
        React.createElement('input', {
          ref: fileInputRef,
          type: 'file',
          accept: '.json',
          style: { display: 'none' },
          onChange: handleFileSelect
        }),
        hasModifications && React.createElement('button', {
          className: 'btn btn-primary',
          onClick: handleSaveAll,
          style: { marginLeft: 'auto' }
        }, '💾 保存所有修改 (', modifiedMappings.size + modifiedResults.size + newMappings.length + newResults.length, ')')
      ),
      React.createElement('div', { className: 'tab-bar' },
        React.createElement('button', {
          className: `tab ${activeTab === 'mappings' ? 'active' : ''}`,
          onClick: () => setActiveTab('mappings')
        }, '模块负责人表 (', counts.mappings, ')'),
        React.createElement('button', {
          className: `tab ${activeTab === 'results' ? 'active' : ''}`,
          onClick: () => setActiveTab('results')
        }, '模块配置表 (', counts.results, ')')
      ),
      React.createElement('div', { className: 'data-section' },
        activeTab === 'mappings' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'section-header' },
            React.createElement('h3', null, '模块负责人表 ', React.createElement('span', { style: { fontSize: '12px', color: '#888' } }, '（可直接编辑单元格）')),
            React.createElement('div', { style: { display: 'flex', gap: '8px' } },
              React.createElement('button', { className: 'btn btn-primary btn-small', onClick: handleAddMappingRow }, '+ 新增'),
              React.createElement('button', { className: 'btn btn-danger btn-small', onClick: handleClearMappings, disabled: mappings.length === 0 }, '一键清空')
            )
          ),
          React.createElement('div', { className: 'table-container' },
            React.createElement('table', null,
              React.createElement('thead', null,
                React.createElement('tr', null,
                  React.createElement('th', { style: { width: '60px' } }, '#'),
                  React.createElement('th', null, '代码路径'),
                  React.createElement('th', null, '模块名称'),
                  React.createElement('th', null, '负责人'),
                  React.createElement('th', { style: { width: '100px' } }, '操作')
                )
              ),
              React.createElement('tbody', null,
                filteredMappings.length === 0 && newMappings.length === 0
                  ? React.createElement('tr', { className: 'empty-row' },
                      React.createElement('td', { colSpan: 5 }, '暂无数据')
                    )
                  : [
                      ...filteredMappings.map((m, i) =>
                        React.createElement('tr', { key: m.id },
                          React.createElement('td', null, i + 1),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: m.codePath,
                              onChange: (val) => handleMappingChange(i, 'codePath', val)
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: m.moduleName,
                              onChange: (val) => handleMappingChange(i, 'moduleName', val)
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: m.contactName,
                              onChange: (val) => handleMappingChange(i, 'contactName', val)
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement('div', { className: 'action-cell' },
                              React.createElement('button', {
                                className: 'btn btn-danger btn-small',
                                onClick: () => handleDelete('mapping', m.id)
                              }, '删除')
                            )
                          )
                        )
                      ),
                      ...newMappings.map((m, i) =>
                        React.createElement('tr', { key: `new-${i}`, style: { background: '#2a4a2a' } },
                          React.createElement('td', null, '新增'),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: m.codePath,
                              onChange: (val) => handleNewMappingChange(i, 'codePath', val)
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: m.moduleName,
                              onChange: (val) => handleNewMappingChange(i, 'moduleName', val)
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: m.contactName,
                              onChange: (val) => handleNewMappingChange(i, 'contactName', val)
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement('div', { className: 'action-cell' },
                              React.createElement('button', {
                                className: 'btn btn-danger btn-small',
                                onClick: () => handleRemoveNewMapping(i)
                              }, '取消')
                            )
                          )
                        )
                      )
                    ]
              )
            )
          )
        ),
        activeTab === 'results' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'section-header' },
            React.createElement('h3', null, '模块配置表 ', React.createElement('span', { style: { fontSize: '12px', color: '#888' } }, '（可直接编辑单元格）')),
            React.createElement('div', { style: { display: 'flex', gap: '8px' } },
              React.createElement('button', { className: 'btn btn-primary btn-small', onClick: handleAddResultRow }, '+ 新增'),
              React.createElement('button', { className: 'btn btn-danger btn-small', onClick: handleClearResults, disabled: results.length === 0 }, '一键清空')
            )
          ),
          React.createElement('div', { className: 'table-container' },
            React.createElement('table', null,
              React.createElement('thead', null,
                React.createElement('tr', null,
                  React.createElement('th', { style: { width: '60px' } }, 'ID'),
                  React.createElement('th', null, '文件名'),
                  React.createElement('th', { style: { width: '100px' } }, '行号'),
                  React.createElement('th', null, '函数名'),
                  React.createElement('th', null, '匹配模式'),
                  React.createElement('th', { style: { width: '100px' } }, '操作')
                )
              ),
              React.createElement('tbody', null,
                filteredResults.length === 0 && newResults.length === 0
                  ? React.createElement('tr', { className: 'empty-row' },
                      React.createElement('td', { colSpan: 6 }, '暂无数据')
                    )
                  : [
                      ...filteredResults.map((r, i) =>
                        React.createElement('tr', { key: r.id },
                          React.createElement('td', null, i + 1),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: r.codeFile?.fileName || '',
                              onChange: (val) => handleResultChange(i, 'fileName', val)
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: r.line,
                              onChange: (val) => handleResultChange(i, 'line', val),
                              type: 'number'
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: r.functionName,
                              onChange: (val) => handleResultChange(i, 'functionName', val)
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: r.matchedPattern,
                              onChange: (val) => handleResultChange(i, 'matchedPattern', val)
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement('div', { className: 'action-cell' },
                              React.createElement('button', {
                                className: 'btn btn-danger btn-small',
                                onClick: () => handleDelete('result', r.id)
                              }, '删除')
                            )
                          )
                        )
                      ),
                      ...newResults.map((r, i) =>
                        React.createElement('tr', { key: `new-${i}`, style: { background: '#2a4a2a' } },
                          React.createElement('td', null, '新增'),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: r.codeFile?.fileName || '',
                              onChange: (val) => handleNewResultChange(i, 'fileName', val)
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: r.line,
                              onChange: (val) => handleNewResultChange(i, 'line', val),
                              type: 'number'
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: r.functionName,
                              onChange: (val) => handleNewResultChange(i, 'functionName', val)
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement(EditableCell, {
                              value: r.matchedPattern,
                              onChange: (val) => handleNewResultChange(i, 'matchedPattern', val)
                            })
                          ),
                          React.createElement('td', null,
                            React.createElement('div', { className: 'action-cell' },
                              React.createElement('button', {
                                className: 'btn btn-danger btn-small',
                                onClick: () => handleRemoveNewResult(i)
                              }, '取消')
                            )
                          )
                        )
                      )
                    ]
              )
            )
          )
        ),
        counts.mappings + counts.results === 0 && React.createElement('div', { className: 'empty-state' },
          React.createElement('p', null, '数据库为空'),
          React.createElement('button', { className: 'btn btn-primary', onClick: handleAddSample }, '+ 添加示例数据')
        )
      ),
      toast && React.createElement('div', { className: `result-toast ${toast.type}` }, toast.message)
    )
  )
}

createRoot(document.getElementById('root')).render(React.createElement(App))