import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
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
      .trim()
  }
  return line.trim()
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
}>> {
  const results: Array<{
    fileName: string
    line: number
    functionName: string
    matchedPattern: string
    matchedText: string
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
          results.push({
            fileName: fullPath,
            line: lineIndex + 1,
            functionName: getFunctionName(line, content, lineIndex),
            matchedPattern: patternInfo.name,
            matchedText: extractPrintStaticString(line)
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

ipcMain.handle('open-sync-panel', async () => {
  const isDev = process.env.NODE_ENV === 'development'
  const syncPanelPath = isDev
    ? path.join(__dirname, '..', '..', 'sync-panel.html')
    : path.join(path.dirname(app.getPath('exe')), 'sync-panel.html')
  await shell.openPath(syncPanelPath)
})
