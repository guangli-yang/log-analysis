import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Panel, Group, Separator } from 'react-resizable-panels'
import { LogFile, ErrorKeyword, SearchOptions, SearchResult, CodeSearchPattern, CodeSearchResult, CodeSearchResultItem, JobKeyword, IgnoreKeyword, CoreDumpKeyword, HighlightConfig, SearchHistory, SearchTag, AppConfig, SearchHighlight, SEARCH_HIGHLIGHT_COLORS, AIConfig, ModuleLog, ModuleMapping } from './types'
import Toolbar from './components/Toolbar'
import LogViewer from './components/LogViewer'
import HistoryPanel from './components/HistoryPanel'
import AnalysisPanel from './components/AnalysisPanel'
import LogMatchPanel from './components/LogMatchPanel'
import GoToLine from './components/GoToLine'
import { defaultPatterns } from './components/CodeSearchPanel'
import CodeSearchPanel from './components/CodeSearchPanel'
import SearchResultsPanel from './components/SearchResultsPanel'
import SearchDialog from './components/SearchDialog'
import LogPanel from './components/LogPanel'
import KeywordSettingsDialog from './components/KeywordSettingsDialog'
import AIDialog from './components/AIDialog'
import LogExtractDialog from './components/LogExtractDialog'
import ImportDialog from './components/ImportDialog'
import DataManagementPanel from './components/DataManagementPanel'
import RoleSelectionScreen, { UserRole } from './components/RoleSelectionScreen'
import SettingsDialog from './components/SettingsDialog'
import ContextMenu from './components/ContextMenu'
import { logger, logCategories } from './utils/logger'
import { deepMergeModuleLogs, deepMergeModuleMappings } from './utils/mergeData'
import './App.css'

const defaultErrorKeywords: ErrorKeyword[] = [
  { keyword: 'print_err', description: '该错误为打印模块，请找打印团队分析', enabled: true },
  { keyword: 'copy_err', description: '该错误为复制模块，请找文件传输团队分析', enabled: true },
  { keyword: 'scan_err', description: '该错误为扫描模块，请找扫描团队分析', enabled: true },
  { keyword: 'error', description: '通用错误，请检查日志上下文', enabled: true },
  { keyword: 'exception', description: '异常抛出，请找开发团队分析', enabled: true },
  { keyword: 'fatal', description: '致命错误，请立即联系运维团队', enabled: true },
  { keyword: 'fail', description: '操作失败，请检查相关模块', enabled: true },
  { keyword: 'warning', description: '警告信息，请留意相关日志', enabled: true }
]

const defaultJobKeywords: JobKeyword[] = [
  { keyword: 'new job,', description: '作业开始标记', enabled: true },
  { keyword: 'start job', description: '作业开始', enabled: true },
  { keyword: 'begin job', description: '作业开始', enabled: true }
]

const defaultIgnoreKeywords: IgnoreKeyword[] = [
  { keyword: 'DEBUG', description: '调试信息', enabled: true },
  { keyword: 'INFO', description: '普通信息', enabled: true },
  { keyword: 'TRACE', description: '跟踪信息', enabled: true }
]

const defaultCoreDumpKeywords: CoreDumpKeyword[] = [
  { keyword: 'coredump', description: '核心转储', enabled: true },
  { keyword: 'core dump', description: '核心转储', enabled: true },
  { keyword: 'segmentation fault', description: '段错误', enabled: true },
  { keyword: 'SIGSEGV', description: '段错误信号', enabled: true },
  { keyword: 'core dumped', description: '核心已转储', enabled: true }
]

const defaultHighlightConfig: HighlightConfig = {
  backgroundColor: '#ffeb3b',
  textColor: '#000000',
  borderColor: '#f9a825'
}

const defaultAIConfig: AIConfig = {
  apiUrl: '',
  apiKey: '',
  modelName: 'gpt-3.5-turbo',
  enabled: false,
  contextLines: 100
}

interface HistoryState {
  logFiles: LogFile[]
  currentFileIndex: number
}

function App() {
  useEffect(() => {
    logger.renderStart('App')
    return () => {
      logger.renderEnd('App')
    }
  })

  const [configLoaded, setConfigLoaded] = useState(false)

  const [logFiles, setLogFiles] = useState<LogFile[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [history, setHistory] = useState<string[]>([])
  const [errorKeywords, setErrorKeywords] = useState<ErrorKeyword[]>(defaultErrorKeywords)
  const [undoStack, setUndoStack] = useState<HistoryState[]>([])
  const [jobKeywords, setJobKeywords] = useState<JobKeyword[]>(defaultJobKeywords)
  const [ignoreKeywords, setIgnoreKeywords] = useState<IgnoreKeyword[]>(defaultIgnoreKeywords)
  const [coreDumpKeywords, setCoreDumpKeywords] = useState<CoreDumpKeyword[]>(defaultCoreDumpKeywords)
  const [highlightConfig, setHighlightConfig] = useState<HighlightConfig>(() => {
    const saved = localStorage.getItem('highlightConfig')
    return saved ? JSON.parse(saved) : defaultHighlightConfig
  })
  const [highlightedLine, setHighlightedLine] = useState<number | undefined>(undefined)
  const [userRole, setUserRole] = useState<UserRole>(() => {
    if (new URLSearchParams(window.location.search).get('reset-role') === '1') {
      localStorage.removeItem('userRole')
      return null
    }
    const saved = localStorage.getItem('userRole')
    return saved as UserRole || null
  })
  const [showHistory, setShowHistory] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [showCodeSearch, setShowCodeSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false
  })
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [currentResultIndex, setCurrentResultIndex] = useState(-1)
  const [fontSize, setFontSize] = useState(14)
  const [lineHeight, setLineHeight] = useState(20)
  const [showGoToLine, setShowGoToLine] = useState(false)
  const [targetLine, setTargetLine] = useState<number | undefined>(undefined)
  const [codeSearchPatterns, setCodeSearchPatterns] = useState<CodeSearchPattern[]>(defaultPatterns)
  const [codeSearchResults, setCodeSearchResults] = useState<CodeSearchResult[]>([])
  const [moduleLogs, setModuleLogs] = useState<ModuleLog[]>([])
  const [moduleMappings, setModuleMappings] = useState<ModuleMapping[]>([])
  const [projectList, setProjectList] = useState<string[]>([])
  const [activeProject, setActiveProject] = useState<string>('')
  const [projectSystemReady, setProjectSystemReady] = useState(false)
  const [showDataManagement, setShowDataManagement] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([])
  const [searchTags, setSearchTags] = useState<SearchTag[]>([])
  const [searchHighlights, setSearchHighlights] = useState<SearchHighlight[]>([])
  const [showSearchHistory, setShowSearchHistory] = useState(false)
  const [showSearchDialog, setShowSearchDialog] = useState(false)
  const [showSearchResultsPanel, setShowSearchResultsPanel] = useState(true)
  const [showLogPanel, setShowLogPanel] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showKeywordSettings, setShowKeywordSettings] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [notificationHiding, setNotificationHiding] = useState(false)
  const [welcomeContextMenu, setWelcomeContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [showAIDialog, setShowAIDialog] = useState(false)
  const [aiConfig, setAIConfig] = useState<AIConfig>(defaultAIConfig)
  const [showLogExtract, setShowLogExtract] = useState(false)
  const [showLogMatchPanel, setShowLogMatchPanel] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  // 数据管理：导入暂存（未提交到项目 JSON）与合并状态
  const [stagedModuleLogs, setStagedModuleLogs] = useState<ModuleLog[]>([])
  const [stagedModuleMappings, setStagedModuleMappings] = useState<ModuleMapping[]>([])
  const [dmBusy, setDmBusy] = useState(false)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await window.electronAPI.loadConfig()
        if (config) {
          if (config.errorKeywords && config.errorKeywords.length > 0) {
            setErrorKeywords(config.errorKeywords)
          }
          if (config.jobKeywords && config.jobKeywords.length > 0) {
            setJobKeywords(config.jobKeywords)
          }
          if (config.ignoreKeywords && config.ignoreKeywords.length > 0) {
            setIgnoreKeywords(config.ignoreKeywords)
          }
          if (config.coreDumpKeywords && config.coreDumpKeywords.length > 0) {
            setCoreDumpKeywords(config.coreDumpKeywords)
          }
          if (config.highlightConfig) {
            setHighlightConfig(config.highlightConfig)
          }
          if (config.searchTags && config.searchTags.length > 0) {
            setSearchTags(config.searchTags)
          }
          if (config.aiConfig) {
            setAIConfig(config.aiConfig)
          }
        }
        setConfigLoaded(true)
      } catch (err) {
        console.error('Failed to load config:', err)
        setConfigLoaded(true)
      }
    }
    loadConfig()
  }, [])

  useEffect(() => {
    if (notification) {
      setNotificationHiding(false)
      const timer = setTimeout(() => {
        setNotificationHiding(true)
        setTimeout(() => {
          setNotification(null)
          setNotificationHiding(false)
        }, 300)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  useEffect(() => {
    if (!configLoaded) return

    const saveConfig = async () => {
      try {
        const config: AppConfig = {
          errorKeywords,
          jobKeywords,
          ignoreKeywords,
          coreDumpKeywords,
          highlightConfig,
          searchTags,
          aiConfig,
          codeSearchResults
        }
        await window.electronAPI.saveConfig(config)
      } catch (err) {
        console.error('Failed to save config:', err)
      }
    }
    saveConfig()
  }, [errorKeywords, jobKeywords, ignoreKeywords, coreDumpKeywords, highlightConfig, searchTags, configLoaded, aiConfig, codeSearchResults])

  const debounceRef = useRef<number | null>(null)
  const loadingProjectRef = useRef(false)

  // ========== 项目级模块数据：加载 / 切换 / 持久化 ==========
  const switchProject = useCallback(async (name: string) => {
    if (!name) return
    loadingProjectRef.current = true
    try {
      const data = await window.electronAPI.loadProjectData(name)
      setModuleLogs(data?.moduleLogs || [])
      setModuleMappings(data?.moduleMappings || [])
      setActiveProject(name)
      localStorage.setItem('activeProject', name)
    } catch (err) {
      console.error('切换项目失败:', err)
    } finally {
      setTimeout(() => { loadingProjectRef.current = false }, 0)
    }
  }, [])

  useEffect(() => {
    const initProjects = async () => {
      try {
        const res = await window.electronAPI.listProjects()
        const projects = res?.projects || []
        setProjectList(projects)
        const saved = localStorage.getItem('activeProject') || ''
        const initial = projects.includes(saved) ? saved : (projects[0] || '')
        if (initial) {
          await switchProject(initial)
        }
      } catch (err) {
        console.error('初始化项目失败:', err)
      } finally {
        setProjectSystemReady(true)
      }
    }
    initProjects()
  }, [switchProject])

  useEffect(() => {
    if (!projectSystemReady) return
    if (!activeProject) return
    if (loadingProjectRef.current) return
    const timer = setTimeout(() => {
      window.electronAPI.saveProjectData(activeProject, { moduleLogs, moduleMappings })
        .catch(err => console.error('保存项目数据失败:', err))
    }, 400)
    return () => clearTimeout(timer)
  }, [moduleLogs, moduleMappings, activeProject, projectSystemReady])

  const handleCreateProject = useCallback(async (name: string) => {
    const clean = (name || '').trim()
    if (!clean) return
    const res = await window.electronAPI.createProject(clean)
    if (res.success) {
      const finalName = res.name || clean
      setProjectList(prev => (prev.includes(finalName) ? prev : [...prev, finalName]))
      await switchProject(finalName)
      setNotification(`已创建并切换到项目：${finalName}`)
    } else {
      setNotification(res.error || '创建项目失败')
    }
  }, [switchProject])

  const handleDeleteProject = useCallback(async (name: string) => {
    const res = await window.electronAPI.deleteProject(name)
    if (res.success) {
      const remaining = projectList.filter(p => p !== name)
      setProjectList(remaining)
      if (activeProject === name) {
        if (remaining.length > 0) {
          await switchProject(remaining[0])
        } else {
          loadingProjectRef.current = true
          setActiveProject('')
          localStorage.removeItem('activeProject')
          setModuleLogs([])
          setModuleMappings([])
          setTimeout(() => { loadingProjectRef.current = false }, 0)
        }
      }
      setNotification(`已删除项目：${name}`)
    } else {
      setNotification(res.error || '删除项目失败')
    }
  }, [projectList, activeProject, switchProject])

  useEffect(() => {
    const savedHistory = localStorage.getItem('logHistory')
    const savedKeywords = localStorage.getItem('errorKeywords')
    const savedPatterns = localStorage.getItem('codeSearchPatterns')
    const savedSearchHistory = localStorage.getItem('searchHistory')
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
    if (savedKeywords) {
      setErrorKeywords(JSON.parse(savedKeywords))
    }
    if (savedPatterns) {
      setCodeSearchPatterns(JSON.parse(savedPatterns))
    }
    if (savedSearchHistory) {
      setSearchHistory(JSON.parse(savedSearchHistory))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('codeSearchPatterns', JSON.stringify(codeSearchPatterns))
  }, [codeSearchPatterns])

  useEffect(() => {
    localStorage.setItem('logHistory', JSON.stringify(history))
  }, [history])

  useEffect(() => {
    localStorage.setItem('errorKeywords', JSON.stringify(errorKeywords))
  }, [errorKeywords])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  useEffect(() => {
    localStorage.setItem('highlightConfig', JSON.stringify(highlightConfig))
  }, [highlightConfig])

  useEffect(() => {
    localStorage.setItem('jobKeywords', JSON.stringify(jobKeywords))
  }, [jobKeywords])

  useEffect(() => {
    localStorage.setItem('ignoreKeywords', JSON.stringify(ignoreKeywords))
  }, [ignoreKeywords])

  useEffect(() => {
    localStorage.setItem('coreDumpKeywords', JSON.stringify(coreDumpKeywords))
  }, [coreDumpKeywords])

  useEffect(() => {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory))
  }, [searchHistory])

  useEffect(() => {
    const savedJobKeywords = localStorage.getItem('jobKeywords')
    const savedIgnoreKeywords = localStorage.getItem('ignoreKeywords')
    const savedCoreDumpKeywords = localStorage.getItem('coreDumpKeywords')
    if (savedJobKeywords) {
      setJobKeywords(JSON.parse(savedJobKeywords))
    }
    if (savedIgnoreKeywords) {
      setIgnoreKeywords(JSON.parse(savedIgnoreKeywords))
    }
    if (savedCoreDumpKeywords) {
      setCoreDumpKeywords(JSON.parse(savedCoreDumpKeywords))
    }
  }, [])

  const addToHistory = (path: string) => {
    setHistory(prev => {
      const filtered = prev.filter(p => p !== path)
      return [path, ...filtered].slice(0, 20)
    })
  }

  const currentFile = logFiles[currentFileIndex]
  const lines = useMemo(() => currentFile?.content.split('\n') || [], [currentFile?.content])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.code === 'KeyG') {
        e.preventDefault()
        if (currentFile) setShowGoToLine(true)
      } else if (e.code === 'KeyF') {
        e.preventDefault()
        setShowSearchDialog(true)
      }
    }
    // 捕获阶段监听，抢在输入框 / Electron 默认行为之前
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [currentFile])

  // 主进程 before-input-event 转发过来的快捷键（物理键码，覆盖输入法/大小写/布局场景）
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.on) return
    const offSearch = api.on('shortcut:open-search', () => setShowSearchDialog(true))
    const offGoto = api.on('shortcut:goto-line', () => { if (currentFile) setShowGoToLine(true) })
    return () => { offSearch(); offGoto() }
  }, [currentFile])

  const handleOpenFile = async () => {
    logger.trace(logCategories.FILE, 'handleOpenFile', 'enter')
    logger.apiStart('selectFile')
    try {
      const result = await window.electronAPI.selectFile()
      logger.apiEnd('selectFile', !!result)
      
      if (result) {
        logger.info(logCategories.FILE, `文件打开成功: ${result.fileName}`, `大小: ${(result.content.length / 1024).toFixed(2)}KB, 行数: ${result.content.split('\n').length}`)
        logger.timeStart('setLogFiles')
        setLogFiles([result])
        setCurrentFileIndex(0)
        addToHistory(result.filePath)
        setSearchResults([])
        setCurrentResultIndex(-1)
        setSearchQuery('')
        logger.timeEnd('setLogFiles', logCategories.STATE, '状态更新完成')
      } else {
        logger.info(logCategories.FILE, '用户取消选择文件')
      }
    } catch (error) {
      logger.apiEnd('selectFile', false)
      logger.error(logCategories.FILE, '文件打开失败', error instanceof Error ? error.stack || error.message : String(error))
    }
    logger.trace(logCategories.FILE, 'handleOpenFile', 'exit')
  }

  const handleOpenFromHistory = async (filePath: string) => {
    logger.info(logCategories.FILE, '从历史记录打开文件', `文件路径: ${filePath}`)
    const result = await window.electronAPI.readFile(filePath)
    if (result) {
      const exists = logFiles.some(f => f.filePath === filePath)
      if (!exists) {
        setLogFiles(prev => [...prev, result])
        setCurrentFileIndex(logFiles.length)
        logger.info(logCategories.FILE, '文件已添加到标签页', `文件: ${result.fileName}`)
      } else {
        setCurrentFileIndex(logFiles.findIndex(f => f.filePath === filePath))
        logger.info(logCategories.FILE, '切换到已打开的文件', `文件: ${result.fileName}`)
      }
      setSearchResults([])
      setCurrentResultIndex(-1)
      setSearchQuery('')
    } else {
      logger.warning(logCategories.FILE, '从历史记录打开文件失败', `文件路径: ${filePath}`)
    }
  }

  const handleSelectCodeFolder = async () => {
    logger.info(logCategories.SEARCH, '开始代码日志检索')
    setCodeSearchResults([])
    setIsSearching(true)
    try {
      const result = await window.electronAPI.selectCodeFolder(codeSearchPatterns)
      setIsSearching(false)
      if (result && result.results.length > 0) {
        logger.info(logCategories.SEARCH, `代码日志检索完成，找到 ${result.results.length} 个匹配`)
        const results: CodeSearchResult[] = result.results.map((r: CodeSearchResultItem) => ({
          codeFile: {
            fileName: r.fileName
          },
          line: r.line,
          functionName: r.functionName,
          matchedPattern: r.matchedPattern,
          matchedText: r.matchedText,
          keywords: r.keywords || []
        }))
        setCodeSearchResults(results)
      } else {
        logger.info(logCategories.SEARCH, '代码日志检索完成，未找到匹配')
      }
    } catch (error) {
      setIsSearching(false)
      logger.error(logCategories.SEARCH, '代码日志检索失败', error instanceof Error ? error.message : String(error))
    }
  }

  const handleOnlineCodeSearch = async (folderPath: string) => {
    logger.info(logCategories.SEARCH, '开始在线代码日志检索')
    setCodeSearchResults([])
    setIsSearching(true)

    try {
      if (!folderPath) {
        const result = await window.electronAPI.selectFolder()
        if (!result || !result.folderPath) {
          setIsSearching(false)
          return
        }
        folderPath = result.folderPath
      }

      const enabledPatterns = codeSearchPatterns.filter(p => p.enabled)
      const patternNames = enabledPatterns.map(p => p.name).join('、')

      const prompt = `你是代码日志检索助手。请分析以下源代码目录中的日志打印语句。

支持的日志模式：${patternNames}

要求：
1. 找出所有匹配的日志打印语句
2. 提取静态字符串（不包含变量占位符）
3. 提取函数名和行号
4. 文件路径请返回相对于 "${folderPath}" 的相对路径
5. matchedPattern 字段使用对应的模式名称

请以JSON格式返回结果：
[{"fileName":"相对路径","line":行号,"functionName":"函数名","matchedPattern":"模式名称","matchedText":"静态字符串"}]

只返回JSON数组，不要其他内容。`

      const messages = [
        { role: 'user' as const, content: `代码目录: ${folderPath}\n\n${prompt}` }
      ]

      const response = await fetch(`${aiConfig.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: aiConfig.modelName || 'gpt-3.5-turbo',
          messages,
          temperature: 0.1
        })
      })

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`)
      }

      const data = await response.json()
      const assistantMessage = data.choices?.[0]?.message?.content || ''

      let jsonMatch = assistantMessage.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsedResults = JSON.parse(jsonMatch[0])
        const results: CodeSearchResult[] = parsedResults.map((r: any) => ({
          codeFile: {
            fileName: folderPath.replace(/\\+$/, '') + '\\' + (r.fileName || 'unknown')
          },
          line: r.line || 0,
          functionName: r.functionName || '',
          matchedPattern: r.matchedPattern || 'LOGE错误',
          matchedText: r.matchedText || ''
        }))
        setCodeSearchResults(results)
        logger.info(logCategories.SEARCH, `在线代码日志检索完成，找到 ${results.length} 个匹配`)
      } else {
        logger.warning(logCategories.SEARCH, 'AI返回格式无法解析')
      }
    } catch (error) {
      logger.error(logCategories.SEARCH, '在线代码日志检索失败', error instanceof Error ? error.message : String(error))
    } finally {
      setIsSearching(false)
    }
  }

  const createRegex = (query: string, options: SearchOptions): RegExp | null => {
    try {
      if (options.useRegex) {
        if (options.wholeWord) {
          const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          return new RegExp(`\\b${escapedQuery}\\b`, options.caseSensitive ? 'g' : 'gi')
        }
        return new RegExp(query, options.caseSensitive ? 'g' : 'gi')
      } else {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = options.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery
        return new RegExp(pattern, options.caseSensitive ? 'g' : 'gi')
      }
    } catch {
      return null
    }
  }

  const executeSearch = useCallback((query: string, options: SearchOptions) => {
    logger.trace(logCategories.SEARCH, 'executeSearch', 'enter', `query: "${query}"`)
    logger.timeStart('executeSearch')
    
    if (!query || logFiles.length === 0) {
      setSearchResults([])
      setCurrentResultIndex(-1)
      logger.timeEnd('executeSearch', logCategories.SEARCH, '搜索完成: 无结果')
      logger.trace(logCategories.SEARCH, 'executeSearch', 'exit')
      return
    }

    logger.timeStart('createRegex')
    const regex = createRegex(query, options)
    logger.timeEnd('createRegex', logCategories.SEARCH, '正则表达式创建完成')
    
    if (!regex) {
      logger.warning(logCategories.SEARCH, '搜索失败: 无效的正则表达式')
      logger.trace(logCategories.SEARCH, 'executeSearch', 'error', '无效的正则表达式')
      return
    }

    const startTime = performance.now()
    const results: SearchResult[] = []
    const content = logFiles[currentFileIndex].content
    
    logger.timeStart('splitLines')
    const lines = content.split('\n')
    logger.timeEnd('splitLines', logCategories.SEARCH, `分割行完成，共 ${lines.length} 行`)
    
    logger.timeStart('searchLoop')
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]
      regex.lastIndex = 0
      let match: RegExpExecArray | null
      
      while ((match = regex.exec(line)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++
          continue
        }
        results.push({
          line: lineIndex,
          start: match.index,
          end: match.index + match[0].length,
          text: line
        })
        if (regex.lastIndex === match.index) {
          regex.lastIndex++
        }
      }
      
      if (lineIndex % 10000 === 0 && lineIndex > 0) {
        logger.debug(logCategories.SEARCH, `搜索进度: ${lineIndex}/${lines.length} 行`)
      }
    }
    logger.timeEnd('searchLoop', logCategories.SEARCH, '搜索循环完成')

    const duration = performance.now() - startTime
    logger.perf(logCategories.SEARCH, `搜索完成: 找到 ${results.length} 个匹配`, duration, `查询: "${query}", 行数: ${lines.length}`)

    logger.timeStart('setSearchResults')
    setSearchResults(results)
    setCurrentResultIndex(results.length > 0 ? 0 : -1)
    logger.timeEnd('setSearchResults', logCategories.STATE, '搜索结果状态更新完成')

    setSearchHistory(prev => {
      const existingIndex = prev.findIndex(h => 
        h.query === query && 
        JSON.stringify(h.options) === JSON.stringify(options)
      )
      
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          timestamp: Date.now(),
          count: updated[existingIndex].count + 1
        }
        return updated.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20)
      } else {
        return [{
          id: Date.now().toString(),
          query,
          options,
          timestamp: Date.now(),
          count: 1
        }, ...prev].slice(0, 20)
      }
    })
    
    logger.timeEnd('executeSearch', logCategories.SEARCH, 'executeSearch完成')
    logger.trace(logCategories.SEARCH, 'executeSearch', 'exit')
  }, [logFiles, currentFileIndex])

  const handleSearch = useCallback((query: string, options: SearchOptions) => {
    logger.info(logCategories.SEARCH, '用户发起搜索', `查询: "${query}", 区分大小写: ${options.caseSensitive}, 全词匹配: ${options.wholeWord}, 正则: ${options.useRegex}`)
    setSearchQuery(query)
    setSearchOptions(options)

    setSearchHighlights(prev => {
      const existingIndex = prev.findIndex(h => h.query === query && JSON.stringify(h.options) === JSON.stringify(options))
      if (existingIndex >= 0) {
        return prev
      }
      const colorIndex = prev.length % SEARCH_HIGHLIGHT_COLORS.length
      const newHighlight: SearchHighlight = {
        query,
        options,
        color: SEARCH_HIGHLIGHT_COLORS[colorIndex]
      }
      return [...prev, newHighlight]
    })

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = window.setTimeout(() => {
      executeSearch(query, options)
    }, 150)
  }, [executeSearch])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const navigateResult = (directionOrIndex: 'next' | 'prev' | number) => {
    if (searchResults.length === 0) return
    
    if (typeof directionOrIndex === 'number') {
      logger.info(logCategories.SEARCH, '跳转到指定搜索结果', `索引: ${directionOrIndex + 1}/${searchResults.length}`)
      const targetIdx = directionOrIndex
      setCurrentResultIndex(targetIdx)
      const result = searchResults[targetIdx]
      if (result) {
        setHighlightedLine(result.line)
        setTargetLine(result.line)
        setTimeout(() => {
          setTargetLine(undefined)
          setHighlightedLine(undefined)
        }, 2000)
      }
    } else if (directionOrIndex === 'next') {
      logger.info(logCategories.SEARCH, '查找下一个搜索结果', `当前: ${currentResultIndex + 1}/${searchResults.length}`)
      const nextIdx = (currentResultIndex + 1) % searchResults.length
      setCurrentResultIndex(nextIdx)
      const result = searchResults[nextIdx]
      if (result) {
        setHighlightedLine(result.line)
        setTargetLine(result.line)
        setTimeout(() => {
          setTargetLine(undefined)
          setHighlightedLine(undefined)
        }, 2000)
      }
    } else {
      logger.info(logCategories.SEARCH, '查找上一个搜索结果', `当前: ${currentResultIndex + 1}/${searchResults.length}`)
      const prevIdx = (currentResultIndex - 1 + searchResults.length) % searchResults.length
      setCurrentResultIndex(prevIdx)
      const result = searchResults[prevIdx]
      if (result) {
        setHighlightedLine(result.line)
        setTargetLine(result.line)
        setTimeout(() => {
          setTargetLine(undefined)
          setHighlightedLine(undefined)
        }, 2000)
      }
    }
  }

  const handleAddSearchTag = useCallback((name: string, query: string, options: SearchOptions) => {
    const existingTag = searchTags.find(
      tag => tag.name === name || (tag.query === query && JSON.stringify(tag.options) === JSON.stringify(options))
    )
    if (existingTag) {
      logger.info(logCategories.SEARCH, '添加搜索标签失败', '标签已存在')
      setNotification('该标签已存在')
      return
    }
    const newTag: SearchTag = {
      id: Date.now().toString(),
      name,
      query,
      options,
      createdAt: Date.now()
    }
    setSearchTags(prev => [...prev, newTag])
    logger.info(logCategories.SEARCH, '添加搜索标签', `标签名: "${name}", 搜索词: "${query}"`)
    setNotification(`已添加快捷标签: "${name}"`)
  }, [searchTags])

  const handleDeleteSearchTag = useCallback((id: string) => {
    const tagToDelete = searchTags.find(tag => tag.id === id)
    setSearchTags(prev => prev.filter(tag => tag.id !== id))
    logger.info(logCategories.SEARCH, '删除搜索标签', `标签: "${tagToDelete?.name || '未知'}"`)
  }, [searchTags])

  const handleTagClick = useCallback((tag: SearchTag) => {
    logger.info(logCategories.SEARCH, '点击快捷标签搜索', `标签名: "${tag.name}", 搜索词: "${tag.query}"`)
    handleSearch(tag.query, tag.options)
  }, [handleSearch])

  const handleRemoveSearchHighlight = useCallback((query: string, options: SearchOptions) => {
    setSearchHighlights(prev => prev.filter(h => !(h.query === query && JSON.stringify(h.options) === JSON.stringify(options))))
    logger.info(logCategories.SEARCH, '移除搜索高亮', `搜索词: "${query}"`)
  }, [])

  const handleClearAllSearchHighlights = useCallback(() => {
    setSearchHighlights([])
    setSearchQuery('')
    setSearchResults([])
    logger.info(logCategories.SEARCH, '清除所有搜索高亮', '')
  }, [])

  const handleGoToLine = (lineNumber: number) => {
    logger.info(logCategories.APP, '跳转到指定行', `行号: ${lineNumber}`)
    setTargetLine(lineNumber)
    setHighlightedLine(lineNumber)
    setTimeout(() => setHighlightedLine(undefined), 2000)
    setTimeout(() => setTargetLine(undefined), 500)
  }

  const saveHistoryState = useCallback(() => {
    const state: HistoryState = {
      logFiles: logFiles.map(file => ({ ...file })),
      currentFileIndex
    }
    setUndoStack(prev => [...prev, state])
  }, [logFiles, currentFileIndex])

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) {
      logger.warning(logCategories.APP, '撤销操作失败', '撤销栈为空')
      setNotification('没有可撤销的操作')
      return
    }
    
    logger.info(logCategories.APP, '撤销操作', `撤销前有 ${undoStack.length} 个操作`)
    const prevState = undoStack[undoStack.length - 1]
    setLogFiles(prevState.logFiles)
    setCurrentFileIndex(prevState.currentFileIndex)
    setUndoStack(prev => prev.slice(0, -1))
    logger.info(logCategories.APP, '撤销操作完成', `撤销后剩余 ${undoStack.length - 1} 个操作`)
  }, [undoStack])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'KeyZ') {
        e.preventDefault()
        handleUndo()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleUndo])

  const handleHighlightLine = (lineNumber: number) => {
    setHighlightedLine(lineNumber)
    setTargetLine(lineNumber)
  }

  const handleContentChange = useCallback((newContent: string) => {
    const newLineOffsets: number[] = [0]
    for (let i = 0; i < newContent.length; i++) {
      if (newContent[i] === '\n') {
        newLineOffsets.push(i + 1)
      }
    }
    setLogFiles(prev => prev.map((file, index) =>
      index === currentFileIndex ? { ...file, content: newContent, lineOffsets: newLineOffsets } : file
    ))
  }, [currentFileIndex])

  const handleCreateNewFile = useCallback(() => {
    const newFile: LogFile = {
      filePath: '',
      fileName: '新建日志.txt',
      content: '',
      lineOffsets: [0]
    }
    setLogFiles(prev => [...prev, newFile])
    setCurrentFileIndex(prev => prev + 1)
    logger.info(logCategories.APP, '新建空白文件')
  }, [])

  type ExtractMode = 'job' | 'boot' | 'error' | 'custom'

  const handleLogExtract = useCallback(async (mode: ExtractMode, params: { count?: number; keyword?: string }) => {
    if (!currentFile) return

    logger.info(logCategories.APP, '日志提取', `模式: ${mode}`)
    saveHistoryState()

    const content = currentFile.content.replace(/\r/g, '')
    const lines = content.split('\n')

    const bootPatterns = ['boot', 'startup', '开机', '启动', 'reboot', 'restart', '系统启动', 'system startup']
    const findAllMatches = (keywords: string[]): number[] => {
      const matches: number[] = []
      for (let i = 0; i < lines.length; i++) {
        if (keywords.some(kw => lines[i].toLowerCase().includes(kw.toLowerCase()))) {
          matches.push(i)
        }
      }
      return matches
    }

    let targetLine = -1
    let modeName = ''

    if (mode === 'job') {
      const count = params.count || 1
      const jobKeywordsList = jobKeywords.filter(k => k.enabled).map(k => k.keyword)
      const matches = findAllMatches(jobKeywordsList)
      if (matches.length >= count) {
        targetLine = matches[matches.length - count]
        modeName = `倒数第${count}个作业`
      }
    } else if (mode === 'boot') {
      const matches = findAllMatches(bootPatterns)
      if (matches.length > 0) {
        targetLine = matches[matches.length - 1]
        modeName = '最后开机/重启'
      }
    } else if (mode === 'error') {
      const errorKeywordsList = errorKeywords.filter(k => k.enabled).map(k => k.keyword)
      const matches = findAllMatches(errorKeywordsList)
      if (matches.length > 0) {
        targetLine = matches[matches.length - 1]
        modeName = '最后错误'
      }
    } else if (mode === 'custom' && params.keyword) {
      const matches = findAllMatches([params.keyword])
      if (matches.length > 0) {
        targetLine = matches[matches.length - 1]
        modeName = `关键词: ${params.keyword}`
      }
    }

    if (targetLine >= 0) {
      const extractedLines = lines.slice(targetLine)
      const extractedContent = extractedLines.join('\n')

      const newLineOffsets: number[] = [0]
      for (let i = 0; i < extractedContent.length; i++) {
        if (extractedContent[i] === '\n') {
          newLineOffsets.push(i + 1)
        }
      }

      const newFileName = `提取_${modeName}_${currentFile.fileName}`
      const extractedFile: LogFile = {
        fileName: newFileName,
        filePath: currentFile.filePath + '_extracted',
        content: extractedContent,
        lineOffsets: newLineOffsets
      }

      setLogFiles(prev => {
        const newIndex = prev.length
        setCurrentFileIndex(newIndex)
        return [...prev, extractedFile]
      })

      logger.info(logCategories.APP, '日志提取完成', `提取了 ${lines.length - targetLine} 行`)
      setNotification(`已提取${modeName}到新标签，共 ${lines.length - targetLine} 行`)
    } else {
      logger.warning(logCategories.APP, '日志提取失败', `未找到${modeName}`)
      setNotification(`未找到${modeName}`)
    }
  }, [currentFile, jobKeywords, errorKeywords, currentFileIndex, saveHistoryState])

  const handleExportCodeResults = useCallback(async (results: CodeSearchResult[]) => {
    if (results.length === 0) return
    logger.info(logCategories.ANALYSIS, '导出代码日志检索结果', `共 ${results.length} 条`)
    try {
      const result = await window.electronAPI.exportConfig({
        codeSearchResults: results,
        exportedAt: new Date().toISOString()
      })
      if (result.success) {
        setNotification(`已导出 ${results.length} 条检索结果`)
      } else {
        setNotification('导出失败')
      }
    } catch (err) {
      console.error('Export code results error:', err)
      setNotification('导出失败')
    }
  }, [])

  const handleImportCodeResults = useCallback(async () => {
    logger.info(logCategories.ANALYSIS, '导入代码日志检索结果')
    try {
      const result = await window.electronAPI.importConfig()
      if (result.success && result.config) {
        const config = result.config as any
        // 支持两种格式：config.codeSearchResults 或 config.data.searchResults
        const codeSearchResults = config.codeSearchResults || (config.data && config.data.searchResults)
        if (codeSearchResults && Array.isArray(codeSearchResults)) {
          setCodeSearchResults(codeSearchResults)
          setNotification(`已导入 ${codeSearchResults.length} 条检索结果`)
        } else {
          setNotification('导入失败或文件无效')
        }
      } else if (result.reason === 'cancelled') {
      } else {
        setNotification('导入失败或文件无效')
      }
    } catch (err) {
      console.error('Import code results error:', err)
      setNotification('导入失败')
    }
  }, [])

  // 确保项目存在（不存在则创建），返回可用的项目名
  const ensureProject = useCallback(async (projectName: string): Promise<string | null> => {
    const clean = (projectName || '').trim()
    if (!clean) {
      setNotification('请先输入项目名称')
      return null
    }
    if (projectList.includes(clean)) return clean
    const res = await window.electronAPI.createProject(clean)
    if (!res.success) {
      setNotification(res.error || '创建项目失败')
      return null
    }
    const finalName = res.name || clean
    setProjectList(prev => (prev.includes(finalName) ? prev : [...prev, finalName]))
    return finalName
  }, [projectList])

  const handleImportModuleLog = useCallback(async (projectName: string, mode: 'overwrite' | 'merge') => {
    logger.info(logCategories.ANALYSIS, '导入模块日志', `项目: ${projectName}, 模式: ${mode}`)
    try {
      const target = await ensureProject(projectName)
      if (!target) return
      const results = await window.electronAPI.selectImportConfig()
      if (!results || results.length === 0) return

      const newModules: ModuleLog[] = results.map((fileResult) => {
        const rawName = fileResult.fileName || fileResult.filePath.split(/[\\/]/).pop() || '未知模块'
        const name = rawName.replace(/\.json$/i, '')
        const content = fileResult.content || ''
        let lineCount = 0
        try {
          const parsed = JSON.parse(content)
          const arr = Array.isArray(parsed) ? parsed : (parsed.codeSearchResults || parsed.data?.searchResults || [])
          lineCount = Array.isArray(arr) ? arr.length : 0
        } catch {
          lineCount = content.split('\n').length
        }
        return {
          id: `module_${name}`,
          name,
          filePath: fileResult.filePath,
          content,
          lineCount,
          importedAt: Date.now()
        }
      })

      const existing = await window.electronAPI.loadProjectData(target)
      const existingLogs = existing?.moduleLogs || []
      const existingMappings = existing?.moduleMappings || []
      const mergedLogs = mode === 'overwrite' ? newModules : [...existingLogs, ...newModules]

      await window.electronAPI.saveProjectData(target, { moduleLogs: mergedLogs, moduleMappings: existingMappings })
      await switchProject(target)

      const modeText = mode === 'merge' ? '合并导入' : '覆盖导入'
      setNotification(`${modeText}成功：项目「${target}」新增 ${newModules.length} 个模块日志`)
    } catch (err) {
      console.error('Import module log error:', err)
      setNotification('导入模块日志失败')
    }
  }, [ensureProject, switchProject])

  const handleRemoveModuleLog = useCallback((id: string) => {
    logger.info(logCategories.ANALYSIS, '移除模块日志', `ID: ${id}`)
    setModuleLogs(prev => prev.filter(m => m.id !== id))
    setNotification('已移除模块')
  }, [])

  const handleUpdateModuleLog = useCallback((id: string, content: string) => {
    let count = 0
    try {
      const arr = JSON.parse(content)
      count = Array.isArray(arr) ? arr.length : 0
    } catch {
      count = 0
    }
    setModuleLogs(prev => prev.map(m => (m.id === id ? { ...m, content, lineCount: count } : m)))
  }, [])

  const handleImportModuleMapping = useCallback(async (projectName: string, mode: 'overwrite' | 'merge') => {
    logger.info(logCategories.ANALYSIS, '导入模块映射表', `项目: ${projectName}, 模式: ${mode}`)
    try {
      const target = await ensureProject(projectName)
      if (!target) return
      const result = await window.electronAPI.importConfig()
      if (result.success && result.config) {
        const config = result.config as any
        const rawMappings = config.mappings || (config.data && config.data.moduleMappings) || (Array.isArray(config) ? config : null)
        if (rawMappings && Array.isArray(rawMappings)) {
          const mappings: ModuleMapping[] = rawMappings.map((m: any) => ({
            codePath: m.codePath || '',
            moduleName: m.moduleName || '',
            contactName: m.contactName || ''
          }))
          const existing = await window.electronAPI.loadProjectData(target)
          const existingLogs = existing?.moduleLogs || []
          const existingMappings = existing?.moduleMappings || []
          const mergedMappings = mode === 'overwrite' ? mappings : [...existingMappings, ...mappings]

          await window.electronAPI.saveProjectData(target, { moduleLogs: existingLogs, moduleMappings: mergedMappings })
          await switchProject(target)

          const modeText = mode === 'merge' ? '合并导入' : '覆盖导入'
          setNotification(`${modeText}成功：项目「${target}」导入 ${mappings.length} 条映射关系`)
        } else {
          setNotification('文件格式无效：缺少 mappings 字段')
        }
      } else if (result.reason === 'cancelled') {
        // 用户取消
      } else {
        setNotification('导入映射表失败')
      }
    } catch (err) {
      console.error('Import module mapping error:', err)
      setNotification('导入映射表失败')
    }
  }, [ensureProject, switchProject])

  // ========== 模块数据：导入（暂存）与合并（深度合并）拆分 ==========
  // 导入：仅接收、解析并暂存到内存，不直接改动项目 JSON
  const handleStageImportModuleLog = useCallback(async () => {
    logger.info(logCategories.ANALYSIS, '暂存导入模块日志（未提交）')
    try {
      const results = await window.electronAPI.selectImportConfig()
      if (!results || results.length === 0) return

      const parsed: ModuleLog[] = results.map((fileResult) => {
        const rawName = fileResult.fileName || fileResult.filePath.split(/[\\/]/).pop() || '未知模块'
        const name = rawName.replace(/\.json$/i, '')
        const content = fileResult.content || ''
        let lineCount = 0
        try {
          const p = JSON.parse(content)
          const arr = Array.isArray(p) ? p : (p.codeSearchResults || (p.data && p.data.searchResults) || [])
          lineCount = Array.isArray(arr) ? arr.length : 0
        } catch {
          lineCount = content.split('\n').length
        }
        return {
          id: `module_${name}`,
          name,
          filePath: fileResult.filePath,
          content,
          lineCount,
          importedAt: Date.now()
        }
      })

      setStagedModuleLogs(prev => deepMergeModuleLogs(prev, parsed))
      setNotification(`已暂存 ${parsed.length} 个模块日志，待合并到项目「${activeProject || '（未选择）'}」`)
    } catch (err) {
      console.error('Stage import module log error:', err)
      setNotification('导入模块日志失败')
    }
  }, [activeProject])

  // 合并：将暂存数据深度合并到当前项目的现存 JSON
  const handleMergeModuleLog = useCallback(async () => {
    if (stagedModuleLogs.length === 0) {
      setNotification('没有待合并的模块日志，请先导入')
      return
    }
    if (!activeProject) {
      setNotification('请先选择或创建项目')
      return
    }
    logger.info(logCategories.ANALYSIS, '深度合并模块日志', `项目: ${activeProject}`)
    setDmBusy(true)
    try {
      const existing = await window.electronAPI.loadProjectData(activeProject)
      const merged = deepMergeModuleLogs(existing?.moduleLogs || [], stagedModuleLogs)
      await window.electronAPI.saveProjectData(activeProject, {
        moduleLogs: merged,
        moduleMappings: existing?.moduleMappings || []
      })
      await switchProject(activeProject)
      setStagedModuleLogs([])
      setNotification(`深度合并完成：项目「${activeProject}」现有 ${merged.length} 个模块日志`)
    } catch (err) {
      console.error('Merge module log error:', err)
      setNotification('合并模块日志失败')
    } finally {
      setDmBusy(false)
    }
  }, [stagedModuleLogs, activeProject, switchProject])

  const handleStageImportModuleMapping = useCallback(async () => {
    logger.info(logCategories.ANALYSIS, '暂存导入模块映射表（未提交）')
    try {
      const result = await window.electronAPI.importConfig()
      if (result.success && result.config) {
        const config = result.config as any
        const rawMappings = config.mappings || (config.data && config.data.moduleMappings) || (Array.isArray(config) ? config : null)
        if (rawMappings && Array.isArray(rawMappings)) {
          const mappings: ModuleMapping[] = rawMappings.map((m: any) => ({
            codePath: m.codePath || '',
            moduleName: m.moduleName || '',
            contactName: m.contactName || ''
          }))
          setStagedModuleMappings(prev => deepMergeModuleMappings(prev, mappings))
          setNotification(`已暂存 ${mappings.length} 条映射关系，待合并到项目「${activeProject || '（未选择）'}」`)
        } else {
          setNotification('文件格式无效：缺少 mappings 字段')
        }
      } else if (result.reason === 'cancelled') {
        // 用户取消
      } else {
        setNotification('导入映射表失败')
      }
    } catch (err) {
      console.error('Stage import module mapping error:', err)
      setNotification('导入映射表失败')
    }
  }, [activeProject])

  const handleMergeModuleMapping = useCallback(async () => {
    if (stagedModuleMappings.length === 0) {
      setNotification('没有待合并的映射表，请先导入')
      return
    }
    if (!activeProject) {
      setNotification('请先选择或创建项目')
      return
    }
    logger.info(logCategories.ANALYSIS, '深度合并模块映射表', `项目: ${activeProject}`)
    setDmBusy(true)
    try {
      const existing = await window.electronAPI.loadProjectData(activeProject)
      const merged = deepMergeModuleMappings(existing?.moduleMappings || [], stagedModuleMappings)
      await window.electronAPI.saveProjectData(activeProject, {
        moduleLogs: existing?.moduleLogs || [],
        moduleMappings: merged
      })
      await switchProject(activeProject)
      setStagedModuleMappings([])
      setNotification(`深度合并完成：项目「${activeProject}」现有 ${merged.length} 条映射关系`)
    } catch (err) {
      console.error('Merge module mapping error:', err)
      setNotification('合并映射表失败')
    } finally {
      setDmBusy(false)
    }
  }, [stagedModuleMappings, activeProject, switchProject])

  const handleClearStagedModuleLogs = useCallback(() => setStagedModuleLogs([]), [])
  const handleClearStagedModuleMappings = useCallback(() => setStagedModuleMappings([]), [])

  const handleFilterComplete = useCallback(async (filteredContent: string, filteredFileName: string, removedCount: number) => {
    if (!currentFile) return

    logger.info(logCategories.APP, '关键词过滤完成', `删除了 ${removedCount} 行`)
    saveHistoryState()

    const filteredFilePath = currentFile.filePath.replace(/(\.[^.]+)$/, `_filtered.$1`)
    await window.electronAPI.writeFile(filteredFilePath, filteredContent)

    const newLogFile: LogFile = {
      filePath: filteredFilePath,
      content: filteredContent,
      fileName: filteredFileName
    }

    setLogFiles(prev => [...prev, newLogFile])
    setCurrentFileIndex(logFiles.length)
    addToHistory(filteredFilePath)

    setNotification(`已过滤 ${removedCount} 行，新文件已保存`)
  }, [currentFile, logFiles.length, saveHistoryState])

  useEffect(() => {
    const setupResize = (handleId: string, _containerId: string, direction: 'horizontal' | 'vertical', minSize: number, oppositeMinSize: number) => {
      const handle = document.getElementById(handleId)
      if (!handle) return

      const onMouseDown = (e: MouseEvent) => {
        e.preventDefault()
        const container = handle.parentElement
        if (!container) return
        
        const children = Array.from(container.children).filter(
          (el): el is HTMLElement => el !== handle && el instanceof HTMLElement
        )
        
        if (children.length < 2) return

        const firstEl = children[0]
        const secondEl = children[1]
        const startPos = direction === 'horizontal' ? e.clientX : e.clientY
        const containerRect = container.getBoundingClientRect()
        const containerSize = direction === 'horizontal' ? containerRect.width : containerRect.height
        const firstSize = direction === 'horizontal' ? firstEl.offsetWidth : firstEl.offsetHeight
        const secondSize = direction === 'horizontal' ? secondEl.offsetWidth : secondEl.offsetHeight

        const onMouseMove = (moveEvent: MouseEvent) => {
          moveEvent.preventDefault()
          const currentPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY
          const delta = currentPos - startPos
          
          let newFirstSize = firstSize + delta
          let newSecondSize = secondSize - delta
          
          if (newFirstSize < minSize) {
            newFirstSize = minSize
            newSecondSize = containerSize - minSize - (direction === 'horizontal' ? handle.offsetWidth : handle.offsetHeight)
          }
          if (newSecondSize < oppositeMinSize) {
            newSecondSize = oppositeMinSize
            newFirstSize = containerSize - oppositeMinSize - (direction === 'horizontal' ? handle.offsetWidth : handle.offsetHeight)
          }

          if (direction === 'horizontal') {
            firstEl.style.width = `${newFirstSize}px`
            firstEl.style.flex = 'none'
            secondEl.style.width = `${newSecondSize}px`
            secondEl.style.flex = 'none'
          } else {
            firstEl.style.height = `${newFirstSize}px`
            firstEl.style.flex = 'none'
            secondEl.style.height = `${newSecondSize}px`
            secondEl.style.flex = 'none'
          }
        }

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove)
          document.removeEventListener('mouseup', onMouseUp)
          document.body.style.cursor = ''
          document.body.style.userSelect = ''
        }

        document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
        document.body.style.userSelect = 'none'
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
      }

      handle.addEventListener('mousedown', onMouseDown)
      return () => handle.removeEventListener('mousedown', onMouseDown)
    }

    const cleanupVertical = setupResize('vertical-resize-handle', 'app-top-area', 'horizontal', 300, 250)
    const cleanupHorizontal = setupResize('horizontal-resize-handle', 'app-main-container', 'vertical', 200, 80)

    return () => {
      if (cleanupVertical) cleanupVertical()
      if (cleanupHorizontal) cleanupHorizontal()
    }
  }, [])

  const handleSelectRole = (role: 'developer' | 'tester') => {
    setUserRole(role)
    localStorage.setItem('userRole', role)
    logger.info(logCategories.APP, '用户选择角色', role === 'developer' ? '研发' : '测试')
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const logFiles = files.filter(f =>
      f.name.endsWith('.log') ||
      f.name.endsWith('.txt') ||
      f.name.endsWith('.out') ||
      f.name.endsWith('.err')
    )

    if (logFiles.length === 0) {
      setNotification('请拖拽 .log、.txt、.out 或 .err 文件')
      return
    }

    logger.info(logCategories.APP, '拖拽文件打开', `文件数量: ${logFiles.length}`)

    for (const file of logFiles) {
      const filePath = (file as any).path as string
      if (filePath) {
        const result = await window.electronAPI.readFile(filePath)
        if (result) {
          const newLogFile: LogFile = {
            filePath: result.filePath,
            content: result.content,
            fileName: result.fileName
          }
          setLogFiles(prev => [...prev, newLogFile])
          setCurrentFileIndex(logFiles.length)
          addToHistory(result.filePath)
          logger.info(logCategories.FILE, `拖拽文件打开成功: ${result.fileName}`)
        }
      }
    }

    if (logFiles.length > 1) {
      setNotification(`已打开 ${logFiles.length} 个文件`)
    }
  }

  if (!userRole) {
    return <RoleSelectionScreen onSelectRole={handleSelectRole} />
  }

  return (
    <div
      className={`app ${isDragOver ? 'drag-over' : ''}`}
      data-theme="dark"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="drag-overlay">
          <div className="drag-overlay-content">
            <div className="drag-overlay-icon">📂</div>
            <div className="drag-overlay-text">释放文件以打开</div>
          </div>
        </div>
      )}
      <Toolbar
        onOpenFile={handleOpenFile}
        onShowHistory={() => {
          logger.info(logCategories.APP, '切换历史记录面板', `当前状态: ${!showHistory ? '显示' : '隐藏'}`)
          setShowHistory(!showHistory)
        }}
        logFiles={logFiles}
        currentFileIndex={currentFileIndex}
        onFileChange={(index) => {
          logger.info(logCategories.FILE, '切换文件标签', `切换到: ${logFiles[index]?.fileName || index}, 索引: ${index}`)
          setCurrentFileIndex(index)
        }}
        onShowSearch={() => {
          logger.info(logCategories.SEARCH, '打开搜索对话框')
          setShowSearchDialog(true)
        }}
        onShowKeywordSettings={() => {
          logger.info(logCategories.APP, '打开关键词设置对话框')
          setShowKeywordSettings(true)
        }}
        onShowAnalysis={() => {
          logger.info(logCategories.APP, '打开分析面板', `当前文件: ${currentFile?.fileName || '未打开文件'}`)
          setShowAnalysis(true)
        }}
        onShowAI={() => {
          logger.info(logCategories.APP, '打开AI助手')
          setShowAIDialog(true)
        }}
        onShowCodeSearch={() => {
          logger.info(logCategories.APP, '打开代码检索面板')
          setShowCodeSearch(true)
        }}
        onShowLogMatch={() => {
          logger.info(logCategories.APP, '打开日志匹配面板')
          setShowLogMatchPanel(true)
        }}
        onShowImportDialog={() => setShowImportDialog(true)}
        onShowDataManagement={() => setShowDataManagement(true)}
        onShowSettings={() => setShowSettings(true)}
        userRole={userRole}
        projectList={projectList}
        activeProject={activeProject}
        onSwitchProject={switchProject}
        onCreateProject={handleCreateProject}
      />

      {showImportDialog && (
        <ImportDialog
          projectList={projectList}
          activeProject={activeProject}
          onImportModuleLog={handleImportModuleLog}
          onImportModuleMapping={handleImportModuleMapping}
          onClose={() => setShowImportDialog(false)}
        />
      )}

      {showDataManagement && (
        <DataManagementPanel
          projectList={projectList}
          activeProject={activeProject}
          moduleLogs={moduleLogs}
          moduleMappings={moduleMappings}
          stagedModuleLogs={stagedModuleLogs}
          stagedModuleMappings={stagedModuleMappings}
          isBusy={dmBusy}
          onSwitchProject={switchProject}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onChangeModuleMappings={setModuleMappings}
          onRemoveModuleLog={handleRemoveModuleLog}
          onUpdateModuleLog={handleUpdateModuleLog}
          onStageImportModuleLog={handleStageImportModuleLog}
          onMergeModuleLog={handleMergeModuleLog}
          onStageImportModuleMapping={handleStageImportModuleMapping}
          onMergeModuleMapping={handleMergeModuleMapping}
          onClearStagedModuleLogs={handleClearStagedModuleLogs}
          onClearStagedModuleMappings={handleClearStagedModuleMappings}
          onShowNotification={setNotification}
          onClose={() => setShowDataManagement(false)}
        />
      )}

      {showHistory && (
        <HistoryPanel
          history={history}
          onOpen={handleOpenFromHistory}
          onClear={() => {
            logger.info(logCategories.APP, '清空历史记录')
            setHistory([])
          }}
          onClose={() => {
            logger.info(logCategories.APP, '关闭历史记录面板')
            setShowHistory(false)
          }}
        />
      )}

      {showAnalysis && (
        <AnalysisPanel
          onClose={() => {
            logger.info(logCategories.APP, '关闭分析面板')
            setShowAnalysis(false)
          }}
          content={currentFile ? currentFile.content : ''}
          errorKeywords={errorKeywords}
          coreDumpKeywords={coreDumpKeywords}
          ignoreKeywords={ignoreKeywords}
          onNavigateToError={(line) => {
            logger.info(logCategories.ANALYSIS, '导航到错误位置', `行号: ${line + 1}`)
            handleHighlightLine(line)
          }}
          onShowNotification={setNotification}
          onOpenLogExtract={() => setShowLogExtract(true)}
          onFilterComplete={handleFilterComplete}
        />
      )}

      {showLogMatchPanel && (
        <LogMatchPanel
          onClose={() => {
            logger.info(logCategories.APP, '关闭日志匹配面板')
            setShowLogMatchPanel(false)
          }}
          content={currentFile ? currentFile.content : ''}
          moduleLogs={moduleLogs}
          onNavigateToError={(line) => {
            logger.info(logCategories.ANALYSIS, '导航到错误位置', `行号: ${line + 1}`)
            handleHighlightLine(line)
          }}
          onShowNotification={setNotification}
          onRemoveModuleLog={handleRemoveModuleLog}
          moduleMappings={moduleMappings}
        />
      )}

      {showCodeSearch && (
        <div className="code-search-container">
          <CodeSearchPanel
            results={codeSearchResults}
            onSearch={handleSelectCodeFolder}
            onOnlineSearch={handleOnlineCodeSearch}
            isSearching={isSearching}
            aiConfig={aiConfig}
            onExport={() => handleExportCodeResults(codeSearchResults)}
            onImport={handleImportCodeResults}
            onClose={() => setShowCodeSearch(false)}
          />
        </div>
      )}

      <div className="app-main-container">
        <div className="app-top-area">
          {currentFile ? (
            <Group orientation="vertical">
              <Panel defaultSize={70}>
                <LogViewer
                  content={currentFile.content}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  searchResults={searchResults}
                  currentResultIndex={currentResultIndex}
                  searchQuery={searchQuery}
                  searchOptions={searchOptions}
                  searchHighlights={searchHighlights}
                  lineOffsets={currentFile.lineOffsets}
                  targetLine={targetLine}
                  highlightedLine={highlightedLine}
                  highlightConfig={highlightConfig}
                  onContentChange={handleContentChange}
                  onCreateNewFile={handleCreateNewFile}
                />
              </Panel>
              {showSearchResultsPanel && (
                <>
                  <Separator className="resize-handle-horizontal" />
                  <Panel defaultSize={30}>
                    <SearchResultsPanel
                      results={searchResults}
                      currentIndex={currentResultIndex}
                      searchQuery={searchQuery}
                      searchOptions={searchOptions}
                      searchHistory={searchHistory}
                      searchTags={searchTags}
                      searchHighlights={searchHighlights}
                      onNavigate={navigateResult}
                      onSearchHistory={handleSearch}
                      onToggleHistory={() => setShowSearchHistory(!showSearchHistory)}
                      onAddTag={handleAddSearchTag}
                      onDeleteTag={handleDeleteSearchTag}
                      onTagClick={handleTagClick}
                      onRemoveHighlight={handleRemoveSearchHighlight}
                      onClearAllHighlights={handleClearAllSearchHighlights}
                      showHistory={showSearchHistory}
                      fileName={currentFile?.fileName}
                      onCollapse={() => setShowSearchResultsPanel(false)}
                    />
                  </Panel>
                </>
              )}
              {!showSearchResultsPanel && (
                <button
                  className="expand-search-results-btn"
                  onClick={() => setShowSearchResultsPanel(true)}
                  title="展开搜索结果面板"
                >
                  ▼ 展开搜索结果
                </button>
              )}
            </Group>
          ) : (
            <div
              className="welcome-screen"
              onContextMenu={(e) => {
                e.preventDefault()
                setWelcomeContextMenu({ x: e.clientX, y: e.clientY })
              }}
            >
              <div className="welcome-card">
                <div className="welcome-icon">🔍</div>
                <h1 className="welcome-title">日志分析工具</h1>
                <p className="welcome-subtitle">快速定位问题 · 智能匹配模块 · 一键导出报告</p>

                <div
                  className={`welcome-dropzone ${isDragOver ? 'active' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="welcome-dropzone-icon">📂</div>
                  <div className="welcome-dropzone-text">
                    {isDragOver ? '释放文件以打开' : '拖拽日志文件到此处'}
                  </div>
                  <div className="welcome-dropzone-hint">支持 .log .txt .json 格式</div>
                </div>

                <div className="welcome-actions">
                  <button className="welcome-btn primary" onClick={handleOpenFile}>
                    <span className="welcome-btn-icon">📂</span> 打开文件
                  </button>
                  <button className="welcome-btn" onClick={() => setShowImportDialog(true)}>
                    <span className="welcome-btn-icon">📥</span> 导入配置
                  </button>
                </div>

                {history.length > 0 && (
                  <div className="welcome-recent">
                    <div className="welcome-recent-title">最近打开</div>
                    <div className="welcome-recent-list">
                      {history.slice(0, 5).map((filePath, i) => (
                        <button
                          key={i}
                          className="welcome-recent-item"
                          onClick={() => handleOpenFromHistory(filePath)}
                          title={filePath}
                        >
                          📄 {filePath.split(/[\\/]/).pop() || filePath}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="welcome-tips">
                  <span>💡 提示：导入模块映射表后可进行快速分析匹配</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {currentFile && (
        <GoToLine
          onGoToLine={handleGoToLine}
          totalLines={lines.length}
          isVisible={showGoToLine}
          onClose={() => setShowGoToLine(false)}
        />
      )}

      <SearchDialog
        isOpen={showSearchDialog}
        onClose={() => setShowSearchDialog(false)}
        onSearch={handleSearch}
        onFindNext={() => navigateResult('next')}
        onFindPrev={() => navigateResult('prev')}
        searchHistory={searchHistory}
        currentQuery={searchQuery}
        searchOptions={searchOptions}
        onOptionsChange={setSearchOptions}
        resultCount={searchResults.length}
        currentIndex={currentResultIndex}
      />

      <LogPanel
        isOpen={showLogPanel}
        onClose={() => setShowLogPanel(false)}
      />

      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        lineHeight={lineHeight}
        onLineHeightChange={setLineHeight}
        showLogs={showLogPanel}
        onShowLogsChange={setShowLogPanel}
        onResetRole={() => {
          localStorage.removeItem('userRole')
          window.location.reload()
        }}
        currentRole={userRole || ''}
      />

      <KeywordSettingsDialog
        isOpen={showKeywordSettings}
        onClose={() => setShowKeywordSettings(false)}
        errorKeywords={errorKeywords}
        jobKeywords={jobKeywords}
        ignoreKeywords={ignoreKeywords}
        coreDumpKeywords={coreDumpKeywords}
        highlightConfig={highlightConfig}
        searchTags={searchTags}
        codeSearchPatterns={codeSearchPatterns}
        onErrorKeywordsChange={setErrorKeywords}
        onJobKeywordsChange={setJobKeywords}
        onIgnoreKeywordsChange={setIgnoreKeywords}
        onCoreDumpKeywordsChange={setCoreDumpKeywords}
        onHighlightConfigChange={setHighlightConfig}
        onSearchTagsChange={setSearchTags}
        onCodeSearchPatternsChange={setCodeSearchPatterns}
      />

      <AIDialog
        isOpen={showAIDialog}
        onClose={() => setShowAIDialog(false)}
        aiConfig={aiConfig}
        onSaveConfig={setAIConfig}
        recentLines={currentFile ? currentFile.content.split('\n') : []}
      />

      <LogExtractDialog
        isOpen={showLogExtract}
        onClose={() => setShowLogExtract(false)}
        onExtract={handleLogExtract}
        jobKeywords={jobKeywords}
        errorKeywords={errorKeywords}
      />

      {notification && (
        <div className={`notification ${notificationHiding ? 'hiding' : ''}`} onClick={() => setNotification(null)}>
          {notification}
        </div>
      )}

      {welcomeContextMenu && (
        <ContextMenu
          x={welcomeContextMenu.x}
          y={welcomeContextMenu.y}
          onClose={() => setWelcomeContextMenu(null)}
          items={[
            {
              label: '新建空白文件',
              shortcut: '',
              action: () => {
                handleCreateNewFile()
                setWelcomeContextMenu(null)
              }
            }
          ]}
        />
      )}
    </div>
  )
}

export default App