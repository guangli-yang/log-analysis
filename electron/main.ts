import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

let mainWindow: BrowserWindow | null = null

interface FileReadResult {
  filePath: string
  content: string
  fileName: string
  lineOffsets: number[]
}

function readFileWithLineOffsets(filePath: string): FileReadResult | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lineOffsets: number[] = [0]
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '\n') {
        lineOffsets.push(i + 1)
      }
    }
    return {
      filePath,
      content,
      fileName: path.basename(filePath),
      lineOffsets
    }
  } catch (err) {
    console.error(`Failed to read file ${filePath}:`, err)
    return null
  }
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开日志文件',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu-open-file')
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
              label: '关于',
              click: () => {
                dialog.showMessageBox({
                  type: 'info',
                  title: '关于 AI_Log_Analyzer',
                  message: 'AI_Log_Analyzer V1.2.0',
                  detail: 'AI_Log_Analyzer - 智能日志分析工具\n\n版本：V1.2.0\n作者：张亮\n邮件：liang.zhang001@pantum.local\n\n功能特性：\n• 多模式搜索（正则表达式、区分大小写、全词匹配）\n• 错误关键字分析与问题定位\n• 核心转储（Coredump）分析\n• 代码日志检索（离线/AI在线模式）\n• 日志提取（作业/开机/重启/错误）\n• 日志与代码模块匹配\n• AI智能助手分析\n• 搜索标签与历史管理\n• 支持拖拽文件导入'
                })
              }
            }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Log Files', extensions: ['log', 'txt', 'log.1', 'log.2', 'log.3'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    return readFileWithLineOffsets(filePath)
  }
  return null
})

ipcMain.handle('select-multiple-files', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const files: FileReadResult[] = []
    for (const filePath of result.filePaths) {
      const fileResult = readFileWithLineOffsets(filePath)
      if (fileResult) {
        files.push(fileResult)
      }
    }
    return files
  }
  return []
})

ipcMain.handle('select-json-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0]
    const dirFiles = fs.readdirSync(folderPath)
    const files: FileReadResult[] = []
    for (const file of dirFiles) {
      if (file.endsWith('.json')) {
        const fullPath = path.join(folderPath, file)
        const fileResult = readFileWithLineOffsets(fullPath)
        if (fileResult) {
          files.push(fileResult)
        }
      }
    }
    return files
  }
  return []
})

ipcMain.handle('select-import-config', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const files: FileReadResult[] = []
    for (const filePath of result.filePaths) {
      try {
        const stat = fs.statSync(filePath)
        if (stat.isDirectory()) {
          const dirFiles = fs.readdirSync(filePath)
          for (const file of dirFiles) {
            if (file.endsWith('.json')) {
              const fullPath = path.join(filePath, file)
              const fileResult = readFileWithLineOffsets(fullPath)
              if (fileResult) {
                files.push(fileResult)
              }
            }
          }
        } else {
          const fileResult = readFileWithLineOffsets(filePath)
          if (fileResult) {
            files.push(fileResult)
          }
        }
      } catch (err) {
        console.error(`Error processing path ${filePath}:`, err)
      }
    }
    return files
  }
  return []
})

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0]
    const files = fs.readdirSync(folderPath)
    const logFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase()
      return ext === '.log' || ext === '.txt' || file.match(/\.log\.\d+$/)
    })

    const fileContents: FileReadResult[] = []
    for (const file of logFiles) {
      const fullPath = path.join(folderPath, file)
      const result = readFileWithLineOffsets(fullPath)
      if (result) {
        fileContents.push(result)
      }
    }

    return { folderPath, files: fileContents }
  }
  return null
})

ipcMain.handle('read-file', async (_, filePath: string) => {
  return readFileWithLineOffsets(filePath)
})

ipcMain.handle('save-json', async (_, data: any, defaultName: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return true
  }
  return false
})

ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch (err) {
    console.error(`Failed to write ${filePath}:`, err)
    return false
  }
})

function getConfigPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'config.json')
}

ipcMain.handle('load-config', async () => {
  const configPath = getConfigPath()
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(content)
    }
  } catch (err) {
    console.error(`Failed to load config from ${configPath}:`, err)
  }
  return null
})

ipcMain.handle('save-config', async (_, config: any) => {
  const configPath = getConfigPath()
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error(`Failed to save config to ${configPath}:`, err)
    return false
  }
})

ipcMain.handle('export-config', async (_, config: any) => {
  const result = await dialog.showSaveDialog({
    defaultPath: 'log-analyzer-config.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })

  console.log('导出对话框结果：', result)

  if (result.canceled) {
    console.log('用户取消了导出操作')
    return { success: false, reason: 'cancelled' }
  }

  if (!result.filePath) {
    console.log('导出：未选择文件路径')
    return { success: false, reason: 'no_path' }
  }

  try {
    fs.writeFileSync(result.filePath, JSON.stringify(config, null, 2), 'utf-8')
    console.log('导出成功，保存路径：', result.filePath)
    return { success: true, reason: 'saved', path: result.filePath }
  } catch (err) {
    console.error('导出文件写入失败：', err)
    return { success: false, reason: 'write_error', error: String(err) }
  }
})

ipcMain.handle('import-config', async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  })

  console.log('导入对话框结果：', result)

  if (result.canceled) {
    console.log('用户取消了导入操作')
    return { success: false, reason: 'cancelled' }
  }

  if (!result.filePaths || result.filePaths.length === 0) {
    console.log('导入：未选择文件')
    return { success: false, reason: 'no_file' }
  }

  const filePath = result.filePaths[0]
  console.log('导入：正在读取文件：', filePath)

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    console.log('导入：文件内容长度：', content.length)

    const parsed = JSON.parse(content)
    console.log('导入：JSON 解析成功')
    return { success: true, reason: 'loaded', config: parsed, path: filePath }
  } catch (err) {
    console.error('导入配置文件失败：', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    const isJsonError = errorMessage.includes('JSON') || errorMessage.includes('parse')
    return {
      success: false,
      reason: isJsonError ? 'invalid_json' : 'read_error',
      error: errorMessage
    }
  }
})

const CODE_FILE_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx', '.java', '.cpp', '.h', '.py', '.go', '.c', '.cs']
const MAX_FILES = 2000
const MAX_RESULTS = 5000
const BATCH_SIZE = 20

function getFunctionName(line: string, content: string, lineIndex: number): string {
  let functionName = ''
  
  const funcPatterns = [
    /\b(?:function\s+(\w+)|(\w+)\s*=\s*function|\b(?:async\s+)?function\s*(\w+)|(\w+)\s*\(\s*\)\s*=>)/,
    /\b(?:class\s+(\w+))/,
    /\b(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:void\s+|int\s+|String\s+|boolean\s+|float\s+|double\s+)?(\w+)\s*\(/
  ]

  const match = funcPatterns.find(p => p.test(line))
  if (match) {
    const result = line.match(match)
    if (result) {
      functionName = result.slice(1).find(Boolean) || ''
    }
  }

  if (!functionName && lineIndex > 0) {
    for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 10); i--) {
      const prevLine = content.split('\n')[i]
      for (const pattern of funcPatterns) {
        const result = prevLine.match(pattern)
        if (result) {
          functionName = result.slice(1).find(Boolean) || ''
          if (functionName) break
        }
      }
      if (functionName) break
    }
  }

  return functionName
}

async function* walkDirectoryAsync(dir: string): AsyncGenerator<string> {
  const files = await fs.promises.readdir(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = await fs.promises.stat(fullPath)
    
    if (stat.isDirectory()) {
      yield* walkDirectoryAsync(fullPath)
    } else {
      const ext = path.extname(file).toLowerCase()
      if (CODE_FILE_EXTENSIONS.includes(ext)) {
        yield fullPath
      }
    }
  }
}

function extractPrintStaticString(line: string): string {
  const match = line.match(/["']([^"']+)["']/)
  if (match) {
    const str = match[1]
    return str
      .replace(/%[a-zA-Z#+\-.0-9]*[a-zA-Z]/g, '')
      .replace(/\\n/g, ' ')
      .replace(/\\t/g, ' ')
      .replace(/\\r/g, '')
      .replace(/\{[^}]+\}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return line.trim()
}

function extractKeywords(staticStr: string): string[] {
  if (!staticStr || staticStr.length === 0) return []
  return staticStr
    .split(/\s+/)
    .filter(kw => kw.length > 0)
    .map(kw => kw.trim())
}

async function processFile(
  filePath: string,
  enabledPatterns: Array<{ pattern: string; enabled: boolean; name: string }>
): Promise<Array<{
  fileName: string
  line: number
  functionName: string
  matchedPattern: string
  matchedText: string
  keywords: string[]
}>> {
  const results: Array<{
    fileName: string
    line: number
    functionName: string
    matchedPattern: string
    matchedText: string
    keywords: string[]
  }> = []
  
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    const fullPath = filePath
    
    for (const patternInfo of enabledPatterns) {
      let regex: RegExp
      try {
        regex = new RegExp(patternInfo.pattern, 'gi')
      } catch {
        continue
      }
      
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex]
        if (regex.test(line)) {
          const staticStr = extractPrintStaticString(line)
          results.push({
            fileName: fullPath,
            line: lineIndex + 1,
            functionName: getFunctionName(line, content, lineIndex),
            matchedPattern: patternInfo.name,
            matchedText: staticStr,
            keywords: extractKeywords(staticStr)
          })
        }
      }
    }
  } catch (err) {
    console.error(`Failed to read ${filePath}:`, err)
  }
  
  return results
}

ipcMain.handle('select-code-folder', async (_, patterns: Array<{ pattern: string; enabled: boolean; name: string }>) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0]
    const enabledPatterns = patterns.filter(p => p.enabled)
    
    const results: Array<{
      fileName: string
      line: number
      functionName: string
      matchedPattern: string
      matchedText: string
      keywords: string[]
    }> = []

    const filePaths: string[] = []
    for await (const filePath of walkDirectoryAsync(folderPath)) {
      filePaths.push(filePath)
      if (filePaths.length >= MAX_FILES) {
        break
      }
    }

    for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
      const batch = filePaths.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(fp => processFile(fp, enabledPatterns))
      )
      
      for (const fileResults of batchResults) {
        for (const r of fileResults) {
          if (results.length >= MAX_RESULTS) {
            break
          }
          results.push(r)
        }
        if (results.length >= MAX_RESULTS) {
          break
        }
      }
      if (results.length >= MAX_RESULTS) {
        break
      }
      
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    return { folderPath, results }
  }
  return null
})

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

ipcMain.handle('ai-chat', async (_, {
  apiUrl,
  apiKey,
  modelName,
  messages
}: {
  apiUrl: string
  apiKey: string
  modelName: string
  messages: ChatMessage[]
}) => {
  try {
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `API Error: ${response.status} - ${errorText}` }
    }

    const data = await response.json()
    return { success: true, content: data.choices[0]?.message?.content || '' }
  } catch (err) {
    console.error('AI chat error:', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('ai-test-connection', async (_, { apiUrl, apiKey, modelName }: { apiUrl: string; apiKey: string; modelName: string }) => {
  try {
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'Hi' }]
      })
    })

    if (!response.ok) {
      return { success: false, error: `连接失败: ${response.status}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

// 获取软件同级目录的 config 文件夹路径
function getAppConfigPath(): string {
  return path.join(path.dirname(app.getPath('exe')), 'config')
}

// 自动加载默认配置文件（支持多项目）
ipcMain.handle('auto-load-config', async () => {
  // 开发模式下跳过自动加载
  if (process.env.NODE_ENV === 'development') {
    console.log('开发模式，跳过自动加载配置文件')
    return { success: false, reason: 'development_mode' }
  }
  
  const configBasePath = getAppConfigPath()
  
  const result = {
    success: false,
    projects: [] as { name: string; codeSearch: any; moduleMapping: any }[]
  }
  
  try {
    // 检查 config 目录
    if (!fs.existsSync(configBasePath)) {
      console.log('未找到配置文件目录，跳过自动加载')
      return result
    }
    
    // 遍历 config 下的所有子目录作为项目
    const entries = fs.readdirSync(configBasePath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      
      const projectName = entry.name
      const projectPath = path.join(configBasePath, projectName)
      const codeSearchPath = path.join(projectPath, 'code-search')
      const moduleMappingPath = path.join(projectPath, 'module-mapping')
      
      const projectData: { name: string; codeSearch: any; moduleMapping: any } = {
        name: projectName,
        codeSearch: null,
        moduleMapping: null
      }
      
      // 检查 code-search 目录
      if (fs.existsSync(codeSearchPath)) {
        const files = fs.readdirSync(codeSearchPath).filter(f => f.endsWith('.json'))
        if (files.length > 0) {
          const filePath = path.join(codeSearchPath, files[0])
          const content = fs.readFileSync(filePath, 'utf-8')
          const config = JSON.parse(content)
          console.log(`自动加载代码搜索配置成功 [${projectName}]: ${filePath}`)
          projectData.codeSearch = config
        }
      }
      
      // 检查 module-mapping 目录
      if (fs.existsSync(moduleMappingPath)) {
        const files = fs.readdirSync(moduleMappingPath).filter(f => f.endsWith('.json'))
        if (files.length > 0) {
          const filePath = path.join(moduleMappingPath, files[0])
          const content = fs.readFileSync(filePath, 'utf-8')
          const config = JSON.parse(content)
          console.log(`自动加载模块映射配置成功 [${projectName}]: ${filePath}`)
          projectData.moduleMapping = config
        }
      }
      
      // 只有项目下有配置才添加
      if (projectData.codeSearch !== null || projectData.moduleMapping !== null) {
        result.projects.push(projectData)
      }
    }
    
    result.success = result.projects.length > 0
    
    if (!result.success) {
      console.log('未找到任何项目的配置文件，跳过自动加载')
    } else {
      console.log(`自动加载了 ${result.projects.length} 个项目的配置`)
    }
    
    return result
  } catch (err) {
    console.error('自动加载配置文件失败:', err)
    return { success: false, projects: [], reason: 'error', error: String(err) }
  }
})

// 获取项目列表
ipcMain.handle('get-config-projects', async () => {
  if (process.env.NODE_ENV === 'development') {
    return { success: false, projects: [] }
  }
  
  const configBasePath = getAppConfigPath()
  
  try {
    if (!fs.existsSync(configBasePath)) {
      return { success: true, projects: [] }
    }
    
    const entries = fs.readdirSync(configBasePath, { withFileTypes: true })
    const projects = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(name => !name.startsWith('.'))
    
    return { success: true, projects }
  } catch (err) {
    console.error('获取项目列表失败:', err)
    return { success: false, projects: [], error: String(err) }
  }
})

// ========== 项目级配置读写（config/<项目>/code-search|module-mapping） ==========

// 项目配置根目录：开发模式用工作区 config，生产模式用 exe 同级 config
function getProjectsBasePath(): string {
  if (process.env.NODE_ENV === 'development') {
    return path.join(process.cwd(), 'config')
  }
  return path.join(path.dirname(app.getPath('exe')), 'config')
}

// 目录保留名（非项目）
const RESERVED_DIR_NAMES = ['code-search', 'module-mapping']

function sanitizeName(name: string): string {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim()
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// 从解析后的 JSON 中提取代码日志数组
function extractCodeArray(parsed: any): any[] | null {
  if (Array.isArray(parsed)) return parsed
  if (parsed && Array.isArray(parsed.codeSearchResults)) return parsed.codeSearchResults
  if (parsed && parsed.data && Array.isArray(parsed.data.searchResults)) return parsed.data.searchResults
  return null
}

// 从解析后的 JSON 中提取模块映射数组
function extractMappingArray(parsed: any): any[] | null {
  if (Array.isArray(parsed)) return parsed
  if (parsed && Array.isArray(parsed.mappings)) return parsed.mappings
  if (parsed && parsed.data && Array.isArray(parsed.data.moduleMappings)) return parsed.data.moduleMappings
  return null
}

// 列出所有项目
ipcMain.handle('list-projects', async () => {
  const base = getProjectsBasePath()
  try {
    if (!fs.existsSync(base)) return { success: true, projects: [] }
    const entries = fs.readdirSync(base, { withFileTypes: true })
    const projects = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(name => !name.startsWith('.') && !RESERVED_DIR_NAMES.includes(name))
    return { success: true, projects }
  } catch (err) {
    console.error('列出项目失败:', err)
    return { success: false, projects: [], error: String(err) }
  }
})

// 创建项目
ipcMain.handle('create-project', async (_, name: string) => {
  const clean = sanitizeName(name)
  if (!clean) return { success: false, error: '项目名称无效' }
  if (RESERVED_DIR_NAMES.includes(clean)) return { success: false, error: '项目名称为保留字，请更换' }
  const projectPath = path.join(getProjectsBasePath(), clean)
  try {
    if (fs.existsSync(projectPath)) return { success: false, error: '项目已存在' }
    ensureDir(path.join(projectPath, 'code-search'))
    ensureDir(path.join(projectPath, 'module-mapping'))
    return { success: true, name: clean }
  } catch (err) {
    console.error('创建项目失败:', err)
    return { success: false, error: String(err) }
  }
})

// 删除项目
ipcMain.handle('delete-project', async (_, name: string) => {
  const clean = sanitizeName(name)
  const projectPath = path.join(getProjectsBasePath(), clean)
  try {
    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
    return { success: true }
  } catch (err) {
    console.error('删除项目失败:', err)
    return { success: false, error: String(err) }
  }
})

// 重命名项目
ipcMain.handle('rename-project', async (_, oldName: string, newName: string) => {
  const from = path.join(getProjectsBasePath(), sanitizeName(oldName))
  const clean = sanitizeName(newName)
  if (!clean) return { success: false, error: '项目名称无效' }
  if (RESERVED_DIR_NAMES.includes(clean)) return { success: false, error: '项目名称为保留字，请更换' }
  const to = path.join(getProjectsBasePath(), clean)
  try {
    if (!fs.existsSync(from)) return { success: false, error: '项目不存在' }
    if (fs.existsSync(to)) return { success: false, error: '目标项目已存在' }
    fs.renameSync(from, to)
    return { success: true, name: clean }
  } catch (err) {
    console.error('重命名项目失败:', err)
    return { success: false, error: String(err) }
  }
})

// 加载某个项目的模块数据（模块日志 + 模块负责人表）
ipcMain.handle('load-project-data', async (_, name: string) => {
  const clean = sanitizeName(name)
  const projectPath = path.join(getProjectsBasePath(), clean)
  const codeSearchPath = path.join(projectPath, 'code-search')
  const moduleMappingPath = path.join(projectPath, 'module-mapping')

  const moduleLogs: any[] = []
  const moduleMappings: any[] = []

  try {
    // 读取模块日志（code-search 下每个 json 视为一个模块日志）
    if (fs.existsSync(codeSearchPath)) {
      const files = fs.readdirSync(codeSearchPath).filter(f => f.endsWith('.json'))
      for (const file of files) {
        const full = path.join(codeSearchPath, file)
        try {
          const content = fs.readFileSync(full, 'utf-8')
          const parsed = JSON.parse(content)
          const arr = extractCodeArray(parsed)
          if (!arr) continue // 跳过模板/无效文件
          const stat = fs.statSync(full)
          moduleLogs.push({
            id: `module_${path.basename(file, '.json')}`,
            name: path.basename(file, '.json'),
            filePath: full,
            content: JSON.stringify(arr),
            lineCount: arr.length,
            importedAt: Math.floor(stat.mtimeMs)
          })
        } catch (e) {
          console.error(`解析模块日志失败 ${full}:`, e)
        }
      }
    }

    // 读取模块负责人表（module-mapping 下所有 json 合并）
    if (fs.existsSync(moduleMappingPath)) {
      const files = fs.readdirSync(moduleMappingPath).filter(f => f.endsWith('.json'))
      for (const file of files) {
        const full = path.join(moduleMappingPath, file)
        try {
          const content = fs.readFileSync(full, 'utf-8')
          const parsed = JSON.parse(content)
          const arr = extractMappingArray(parsed)
          if (!arr) continue
          for (const m of arr) {
            if (m && (m.codePath !== undefined || m.moduleName !== undefined)) {
              moduleMappings.push({
                codePath: m.codePath || '',
                moduleName: m.moduleName || '',
                contactName: m.contactName || ''
              })
            }
          }
        } catch (e) {
          console.error(`解析模块映射失败 ${full}:`, e)
        }
      }
    }

    return { success: true, moduleLogs, moduleMappings }
  } catch (err) {
    console.error('加载项目数据失败:', err)
    return { success: false, moduleLogs: [], moduleMappings: [], error: String(err) }
  }
})

// 保存某个项目的模块数据
ipcMain.handle('save-project-data', async (_, name: string, data: { moduleLogs?: any[]; moduleMappings?: any[] }) => {
  const clean = sanitizeName(name)
  if (!clean) return { success: false, error: '项目名称无效' }
  const projectPath = path.join(getProjectsBasePath(), clean)
  const codeSearchPath = path.join(projectPath, 'code-search')
  const moduleMappingPath = path.join(projectPath, 'module-mapping')

  try {
    ensureDir(codeSearchPath)
    ensureDir(moduleMappingPath)

    // 重写 code-search：清理旧 json，再按模块日志逐个写入
    for (const f of fs.readdirSync(codeSearchPath).filter(f => f.endsWith('.json'))) {
      fs.unlinkSync(path.join(codeSearchPath, f))
    }
    const usedNames = new Set<string>()
    for (const log of data.moduleLogs || []) {
      const baseName = (sanitizeName(log.name || 'module').replace(/\.json$/i, '')) || 'module'
      let fileName = baseName
      let i = 1
      while (usedNames.has(fileName.toLowerCase())) {
        fileName = `${baseName}_${i++}`
      }
      usedNames.add(fileName.toLowerCase())
      let toWrite = log.content || '[]'
      try {
        toWrite = JSON.stringify(JSON.parse(log.content), null, 2)
      } catch {
        // 保留原始内容
      }
      fs.writeFileSync(path.join(codeSearchPath, `${fileName}.json`), toWrite, 'utf-8')
    }

    // 重写 module-mapping：统一写入单文件 mappings.json
    for (const f of fs.readdirSync(moduleMappingPath).filter(f => f.endsWith('.json'))) {
      fs.unlinkSync(path.join(moduleMappingPath, f))
    }
    fs.writeFileSync(
      path.join(moduleMappingPath, 'mappings.json'),
      JSON.stringify({ version: '2.0', mappings: data.moduleMappings || [] }, null, 2),
      'utf-8'
    )

    return { success: true }
  } catch (err) {
    console.error('保存项目数据失败:', err)
    return { success: false, error: String(err) }
  }
})
