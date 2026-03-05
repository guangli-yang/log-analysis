import { useState, useEffect, useCallback } from 'react'
import { LogFile, ErrorKeyword, SearchOptions, SearchResult, Theme } from './types'
import Toolbar from './components/Toolbar'
import LogViewer from './components/LogViewer'
import SearchPanel from './components/SearchPanel'
import ErrorAnalysisPane from './components/ErrorAnalysisPane'
import HistoryPanel from './components/HistoryPanel'
import GoToLine from './components/GoToLine'
import SearchDialog from './components/SearchDialog'
import './App.css'

const defaultErrorKeywords: ErrorKeyword[] = [
  { keyword: 'print_err', description: '该错误为打印模块，请找打印团队分析' },
  { keyword: 'copy_err', description: '该错误为复制模块，请找文件传输团队分析' },
  { keyword: 'scan_err', description: '该错误为扫描模块，请找扫描团队分析' },
  { keyword: 'error', description: '通用错误，请检查日志上下文' },
  { keyword: 'exception', description: '异常抛出，请找开发团队分析' },
  { keyword: 'fatal', description: '致命错误，请立即联系运维团队' },
  { keyword: 'fail', description: '操作失败，请检查相关模块' },
  { keyword: 'warning', description: '警告信息，请留意相关日志' }
]

function App() {
  const [logFiles, setLogFiles] = useState<LogFile[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [history, setHistory] = useState<string[]>([])
  const [errorKeywords, setErrorKeywords] = useState<ErrorKeyword[]>(defaultErrorKeywords)
  const [showHistory, setShowHistory] = useState(false)
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
  const [showSearchDialog, setShowSearchDialog] = useState(false)
  const [targetLine, setTargetLine] = useState<number | undefined>(undefined)
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme
    return savedTheme || 'dark'
  })

  useEffect(() => {
    const savedHistory = localStorage.getItem('logHistory')
    const savedKeywords = localStorage.getItem('errorKeywords')
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
    if (savedKeywords) {
      setErrorKeywords(JSON.parse(savedKeywords))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('logHistory', JSON.stringify(history))
  }, [history])

  useEffect(() => {
    localStorage.setItem('errorKeywords', JSON.stringify(errorKeywords))
  }, [errorKeywords])

  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const addToHistory = (path: string) => {
    setHistory(prev => {
      const filtered = prev.filter(p => p !== path)
      return [path, ...filtered].slice(0, 20)
    })
  }

  const currentFile = logFiles[currentFileIndex]

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault()
        if (currentFile) {
          setShowGoToLine(true)
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        if (currentFile) {
          setShowSearchDialog(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentFile])

  const handleOpenFile = async () => {
    const result = await window.electronAPI.selectFile()
    if (result) {
      setLogFiles([result])
      setCurrentFileIndex(0)
      addToHistory(result.filePath)
    }
  }

  const handleOpenFolder = async () => {
    const result = await window.electronAPI.selectFolder()
    if (result && result.files.length > 0) {
      setLogFiles(result.files)
      setCurrentFileIndex(0)
      result.files.forEach((file: LogFile) => addToHistory(file.filePath))
    }
  }

  const handleOpenFromHistory = async (filePath: string) => {
    const result = await window.electronAPI.readFile(filePath)
    if (result) {
      const exists = logFiles.some(f => f.filePath === filePath)
      if (!exists) {
        setLogFiles(prev => [...prev, result])
        setCurrentFileIndex(logFiles.length)
      } else {
        setCurrentFileIndex(logFiles.findIndex(f => f.filePath === filePath))
      }
    }
  }

  const handleSearch = useCallback((query: string, options: SearchOptions) => {
    setSearchQuery(query)
    setSearchOptions(options)
    
    if (!query || logFiles.length === 0) {
      setSearchResults([])
      setCurrentResultIndex(-1)
      return
    }

    const lines = logFiles[currentFileIndex].content.split('\n')
    const results: SearchResult[] = []
    
    let regex: RegExp
    try {
      if (options.useRegex) {
        regex = new RegExp(query, options.caseSensitive ? 'g' : 'gi')
      } else {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = options.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery
        regex = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi')
      }
    } catch {
      return
    }

    lines.forEach((line, lineIndex) => {
      let match: RegExpExecArray | null
      while ((match = regex.exec(line)) !== null) {
        results.push({
          line: lineIndex,
          start: match.index,
          end: match.index + match[0].length,
          text: line
        })
      }
    })

    setSearchResults(results)
    setCurrentResultIndex(results.length > 0 ? 0 : -1)
  }, [logFiles, currentFileIndex])

  const navigateResult = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return
    
    if (direction === 'next') {
      setCurrentResultIndex(prev => (prev + 1) % searchResults.length)
    } else {
      setCurrentResultIndex(prev => (prev - 1 + searchResults.length) % searchResults.length)
    }
  }

  const handleGoToLine = (lineNumber: number) => {
    setTargetLine(lineNumber)
    setTimeout(() => setTargetLine(undefined), 100)
  }

  return (
    <div className="app" data-theme={theme}>
      <Toolbar
        onOpenFile={handleOpenFile}
        onOpenFolder={handleOpenFolder}
        onShowHistory={() => setShowHistory(!showHistory)}
        onIncreaseFont={() => {
          setFontSize(prev => Math.min(prev + 2, 32))
          setLineHeight(prev => Math.min(prev + 3, 48))
        }}
        onDecreaseFont={() => {
          setFontSize(prev => Math.max(prev - 2, 8))
          setLineHeight(prev => Math.max(prev - 3, 12))
        }}
        onGoToLine={() => setShowGoToLine(true)}
        onThemeChange={setTheme}
        theme={theme}
        fontSize={fontSize}
        logFiles={logFiles}
        currentFileIndex={currentFileIndex}
        onFileChange={setCurrentFileIndex}
      />
      
      <div className="main-content">
        {showHistory && (
          <HistoryPanel
            history={history}
            onOpen={handleOpenFromHistory}
            onClear={() => setHistory([])}
            onClose={() => setShowHistory(false)}
          />
        )}
        
        <div className="log-area">
          {currentFile && (
            <LogViewer
              content={currentFile.content}
              fontSize={fontSize}
              lineHeight={lineHeight}
              searchResults={searchResults}
              currentResultIndex={currentResultIndex}
              searchQuery={searchQuery}
              searchOptions={searchOptions}
              targetLine={targetLine}
            />
          )}
          {!currentFile && (
            <div className="welcome-screen">
              <h1>日志分析工具</h1>
              <p>点击工具栏的"打开文件"或"打开文件夹"开始分析日志</p>
            </div>
          )}
        </div>
        
        <ErrorAnalysisPane
          content={currentFile ? currentFile.content : ''}
          errorKeywords={errorKeywords}
          onKeywordsChange={setErrorKeywords}
        />
      </div>
      
      {currentFile && (
        <SearchPanel
          onSearch={handleSearch}
          searchResults={searchResults}
          currentResultIndex={currentResultIndex}
          onNavigate={navigateResult}
        />
      )}

      {currentFile && (
        <GoToLine
          onGoToLine={handleGoToLine}
          totalLines={currentFile.content.split('\n').length}
          isVisible={showGoToLine}
          onClose={() => setShowGoToLine(false)}
        />
      )}

      {currentFile && (
        <SearchDialog
          isVisible={showSearchDialog}
          onClose={() => setShowSearchDialog(false)}
          onSearch={handleSearch}
          searchResults={searchResults}
          currentResultIndex={currentResultIndex}
          onNavigate={navigateResult}
          initialQuery={searchQuery}
        />
      )}
    </div>
  )
}

export default App
