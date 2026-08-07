import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { execFile } from 'child_process'

let mainWindow: BrowserWindow | null = null

/**
 * 从命令行参数中提取文件路径（用于拖文件到图标 / "打开方式" 等场景）
 * Electron 打包后 process.argv 形如: ['app.exe', 'C:\path\to\file.log']
 * 开发模式下形如: ['electron.exe', '.', 'C:\path\to\file.log']
 */
function getFileFromArgv(argv: string[]): string | null {
  for (let i = argv.length - 1; i >= 1; i--) {
    const arg = argv[i]
    if (arg.startsWith('-')) continue
    if (arg === '.') continue
    if (arg.endsWith('.js') || arg.endsWith('.ts')) continue
    if (arg.endsWith('.js.map')) continue
    // 排除 Electron/Node 自身的路径
    if (arg.includes('node_modules')) continue
    if (arg.includes('electron')) continue
    if (fs.existsSync(arg)) return arg
  }
  return null
}

/**
 * 向渲染进程发送打开文件指令（带文件名校验，非日志文件不发送）
 */
function sendOpenFileToRenderer(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  const isLogN = /\.log\.\d+$/.test(filePath)
  const name = path.basename(filePath).toLowerCase()
  const supported = ext === '.log' || ext === '.txt' || ext === '.out' || ext === '.err' || isLogN
  if (!supported) {
    console.log(`忽略非日志文件: ${filePath}`)
    return false
  }
  console.log(`发送 open-file 到渲染进程: ${filePath}`)
  mainWindow?.webContents.send('open-file', filePath)
  return true
}

// ═══════════════════════════════════════════
//  单实例锁：阻止重复启动，支持拖文件到图标
// ═══════════════════════════════════════════
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    // 已有实例运行时，用户拖文件到图标 → 激活窗口并打开文件
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    const filePath = getFileFromArgv(commandLine)
    if (filePath) {
      sendOpenFileToRenderer(filePath)
    }
  })
}

// macOS / Windows 文件关联打开事件
app.on('open-file', (_event, filePath) => {
  _event.preventDefault()
  sendOpenFileToRenderer(filePath)
})

interface FileReadResult {
  filePath: string
  content: string
  fileName: string
  lineOffsets: number[]
}

function readFileWithLineOffsets(filePath: string): FileReadResult | null {
  try {
    // 先用 stat 检查文件大小
    let stat: fs.Stats
    try {
      stat = fs.statSync(filePath)
    } catch {
      return null
    }

    const fileSize = stat.size
    // 大文件：使用异步读取，且不构建 lineOffsets（节省内存）
    const content = fs.readFileSync(filePath, 'utf-8')

    // 大文件不构建 lineOffsets 数组（百万行 = 数 MB 的额外内存）
    if (fileSize > LARGE_FILE_THRESHOLD) {
      console.warn(`大文件检测: ${path.basename(filePath)} (${(fileSize / 1024 / 1024).toFixed(1)}MB)，禁用行偏移索引以节省内存`)
      return {
        filePath,
        content,
        fileName: path.basename(filePath),
        lineOffsets: [] // 大文件不构建 lineOffsets
      }
    }

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
                  title: '关于 日志分析工具',
                  message: '日志分析工具 V1.4.0',
                  detail: '日志分析工具 - 嵌入式打印机固件日志分析工具\n\n版本：V1.4.0\n作者：张亮\n邮件：liang.zhang001@pantum.local\n\n功能特性：\n• 多标签页日志管理，支持拖拽文件导入\n• 多模式搜索（正则表达式、大小写敏感、全词匹配）\n• 错误关键字分析与行号跳转定位\n• 核心转储（Coredump）分析与GDB指令参考\n• 关键词过滤，生成过滤后的新文件\n• 日志提取（倒数第N个作业/最后开机重启/最后错误/自定义关键词）\n• 代码日志检索（离线ctags模式/AI在线模式）\n• 快速分析 — 日志与代码模块匹配、按负责人分组展示\n• 静态字符过滤与交叉搜索\n• 耗时分析 — 节点配置、轮次提取、区间耗时计算\n• AI智能助手分析\n• 数据管理 — 模块负责人表导入/导出/合并/覆盖\n• 项目切换与配置导入/导出\n• 搜索标签与历史记录管理'
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

  // 拦截 Ctrl+F / Ctrl+G：在主进程输入事件层用物理键码（input.code，不受输入法/大小写影响）
  // 抢先 preventDefault，避免触发 Electron/Chromium 默认行为，并转发给渲染进程打开对应对话框。
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && (input.code === 'KeyF' || input.code === 'KeyG')) {
      event.preventDefault()
      const channel = input.code === 'KeyF' ? 'shortcut:open-search' : 'shortcut:goto-line'
      mainWindow?.webContents.send(channel)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createMenu()
  createWindow()

  // 处理通过命令行传入的文件（拖文件到图标、右键"打开方式"等场景）
  const openedFile = getFileFromArgv(process.argv)
  if (openedFile) {
    // 等待渲染进程加载完毕后发送文件路径
    mainWindow?.webContents.once('did-finish-load', () => {
      sendOpenFileToRenderer(openedFile)
    })
  }

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
const MAX_FILES = 20000
const MAX_RESULTS = 50000
const BATCH_SIZE = 20
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024 // 10MB，超过该大小的文件使用异步读取并跳过 lineOffsets 构建

// ═══════════════════════════════════════════════════
//  ctags 集成 — 编译器级函数名索引
// ═══════════════════════════════════════════════════

/** 获取 ctags 可执行文件路径（开发/生产自动切换） */
function getCtagsPath(): string {
  const platform = process.platform
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'ctags')
    : path.join(__dirname, '../../resources/ctags')
  return platform === 'win32' ? path.join(base, 'ctags.exe') : path.join(base, 'ctags')
}

/**
 * 使用 ctags 扫描源码根目录，构建全局函数索引。
 * 返回 Map<文件绝对路径, Map<行号, 函数名>>
 */
interface CtagsResult {
  map: Map<string, Map<number, string>>
  error?: string
}

function buildGlobalFuncMap(rootDir: string): Promise<CtagsResult> {
  return new Promise((resolve) => {
    const map = new Map<string, Map<number, string>>()
    const ctags = getCtagsPath()

    if (!fs.existsSync(ctags)) {
      const msg = `ctags 二进制文件未找到：${ctags}`
      console.warn(msg)
      resolve({ map, error: msg })
      return
    }

    execFile(ctags, [
      '--sort=no',
      '--kinds-C=+pf',
      '--kinds-C++=+pf',
      '--fields=+n',
      '-R',
      '-o', '-',
      rootDir
    ], { maxBuffer: 200 * 1024 * 1024, timeout: 60000 }, (err, stdout) => {
      if (err) {
        let reason = err.message
        if (reason.includes('maxBuffer')) {
          reason = `输出内容超过缓冲区上限（200MB），可能源文件数量过多，建议分批检索`
        } else if (reason.includes('killed') || reason.includes('ETIMEDOUT')) {
          reason = `扫描超时（60秒），文件数量过多，已降级为正则解析`
        } else if (reason.includes('ENOENT')) {
          reason = `ctags 可执行文件不存在`
        }
        console.warn(`ctags scan failed for ${rootDir}:`, err.message)
        resolve({ map, error: reason })
        return
      }

      // 解析 ctags 输出格式：funcName\tfilePath\t...\tline:123
      const lines = stdout.split('\n')
      for (const line of lines) {
        // 提取函数名（第1列 和 第3列是函数名，第2列是文件路径）
        const parts = line.split('\t')
        if (parts.length < 3) continue

        const funcName = parts[0]
        const relPath = parts[1]

        // 从 extras 字段提取行号 (格式: line:123)
        const lineMatch = line.match(/line:(\d+)/)
        if (!lineMatch) continue

        const lineNum = parseInt(lineMatch[1], 10)
        const absPath = path.resolve(rootDir, relPath)

        if (!map.has(absPath)) {
          map.set(absPath, new Map())
        }
        map.get(absPath)!.set(lineNum, funcName)
      }

      console.log(`ctags indexed ${map.size} files with functions in ${rootDir}`)
      resolve({ map })
    })
  })
}

/**
 * 从单行代码中识别「函数定义」，返回非限定函数名（如 DispatchEvent / sendData）。
 * 用于定位调用日志的父函数。返回 '' 表示该行不是函数定义。
 */
function extractFuncDef(lineText: string): string {
  const t = lineText.trim()
  if (t.length === 0) return ''

  // 排除控制流关键字（这些不是函数定义）
  if (/^\s*(if|for|while|switch|catch|do|else|return|throw|try|case|default)\b/.test(t)) return ''

  // 排除日志宏 / 打印调用本身（避免出现 LOGE、console.log 等）
  if (/(LOGE|LOGI|LOGW|LOGD|LOGC|LOG_PRINT|LOG_ERR|LOG_INFO|printf|fprintf|console\.log|NSLog|qDebug|qInfo|qWarning|android_print)\s*\(/.test(t)) return ''

  // C/C++ 函数定义识别：支持返回类型(含模板/限定名)、ns::Class::method 限定名、
  // 指针/引用返回、__attribute__/__declspec 装饰器(可出现在返回类型前后)、extern "C" 链接说明、
  // template<>、尾置返回类型(auto f()->T)、成员初始化列表(:)、noexcept、
  // =0/default/delete、operator 重载、const/override/final、以及 K&R 风格(大括号另起一行)。
  // 例：void foo(int x) {   /   char *get_name(void) {   /   extern "C" void c_func(void) {
  //     __declspec(dllexport) int win_func(void) {   /   void foo(void) __attribute__((noreturn)) {
  //     MyClass::MyClass() : m_x(0) {   /   bool operator==(const Foo&) const {   /   template<typename T> void f() {
  const deco = '(?:__attribute__|__declspec)\\s*\\((?:[^()]*|\\([^()]*\\))*\\)\\s*'
  const cppRe = new RegExp(
    '^(?:' + deco + '|template\\s*<[^>]*>\\s*|(?!(?:operator)\\b)[A-Za-z_"][\\w"]*\\s+)*' + // 修饰词/装饰器/template 循环(可出现在返回类型前后;operator 除外)
    '(?:\\w+::)*' +                                    // 限定名 ns::Class::
    '(?:[*&]\\s*)*' +                                  // 指针/引用修饰符
    '((?:operator\\s*(?:[=<>!+\\-*/%&|^~()\\[\\]]+|\\w[\\w:<>&*\\s,\\[\\]]*?))|(?:\\w+))' + // 函数名 / operator(operator 优先)
    '\\s*\\(([^()]*)\\)' +                             // 参数
    '(?=[^;{]*[{=]|\\s*$)'                            // 零宽前瞻: 其后有 { 或 = (未被 ; 阻断)=>定义体/纯虚; 或参数后仅空白到行尾=>K&R 签名
  )
  let m = t.match(cppRe)
  if (m) {
    const name = (m[1] || '').replace(/\s+/g, ' ').trim()
    if (name && !/^(if|for|while|switch|catch|return|throw)$/.test(name)) return name
  }

  // C/C++ 箭头/lambda 不算，跳过

  // JS/TS: function name(...)
  m = t.match(/\bfunction\s+(\w+)/)
  if (m) return m[1]

  // JS/TS: const name = (...) =>  /  let name = async (...) =>
  m = t.match(/\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/)
  if (m) return m[1]

  // JS/TS: name: function(...)  /  name = function(...)
  m = t.match(/(\w+)\s*[:=]\s*function\b/)
  if (m) return m[1]

  // class 定义
  m = t.match(/\bclass\s+(\w+)/)
  if (m) return m[1]

  return ''
}

/**
 * 获取调用当前日志行的「父函数名」。
 * 不再在日志打印行本身匹配（那会抓到 LOGE/console.log），而是向上/向下各扫描至多 500 行，
 * 找到最近的函数定义，并兼容 C/C++ 与 JS/TS。
 * 优先向上扫描（函数定义通常位于日志行上方），向上未命中时再向下兜底扫描。
 */
function getCallerFunctionName(lineIndex: number, lines: string[]): string {
  const total = lines.length
  const SCAN_RANGE = 500 // 向上/向下扫描的最大行数

  // 向上扫描：函数定义通常在日志行的上方
  const upStart = Math.max(0, lineIndex)
  const upEnd = Math.max(0, lineIndex - SCAN_RANGE)
  for (let i = upStart; i >= upEnd; i--) {
    const fn = extractFuncDef(lines[i])
    if (fn) return fn
  }

  // 向上未找到时，向下扫描（兼容函数定义位于日志行下方的情况）
  const downEnd = Math.min(total - 1, lineIndex + SCAN_RANGE)
  for (let i = lineIndex + 1; i <= downEnd; i++) {
    const fn = extractFuncDef(lines[i])
    if (fn) return fn
  }

  return ''
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
  enabledPatterns: Array<{ pattern: string; enabled: boolean; name: string }>,
  globalFuncMap: Map<string, Map<number, string>> | null
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
    const fileFuncs = globalFuncMap?.get(filePath) ?? null

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

          // 查找函数名：优先 ctags 索引 O(1)，回退正则扫描
          let funcName = ''
          if (fileFuncs) {
            // ctags 索引：向上查找最近的函数定义行
            for (let j = lineIndex + 1; j >= 1; j--) {
              if (fileFuncs.has(j)) {
                funcName = fileFuncs.get(j)!
                break
              }
            }
          } else {
            // 降级：使用正则扫描
            funcName = getCallerFunctionName(lineIndex, lines)
          }

          results.push({
            fileName: fullPath,
            line: lineIndex + 1,
            functionName: funcName,
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
    
    // 通知前端：开始构建 ctags 索引
    mainWindow?.webContents.send('code-search-progress', {
      stage: 'ctags',
      title: '正在构建函数索引…',
      subtitle: '使用 ctags 扫描代码文件，请稍候'
    })
    
    // 构建 ctags 全局函数索引
    const ctagsResult = await buildGlobalFuncMap(folderPath)
    const globalFuncMap = ctagsResult.map
    const useCtags = globalFuncMap.size > 0

    if (!useCtags) {
      const errDetail = ctagsResult.error || '未知原因'
      mainWindow?.webContents.send('code-search-progress', {
        stage: 'warning',
        title: 'ctags 不可用，已降级为正则解析',
        subtitle: `原因：${errDetail}\n函数名提取可能不够精确，但不影响检索结果`
      })
    }
    
    const results: Array<{
      fileName: string
      line: number
      functionName: string
      matchedPattern: string
      matchedText: string
      keywords: string[]
    }> = []

    let truncatedReason = ''

    const filePaths: string[] = []
    try {
      for await (const filePath of walkDirectoryAsync(folderPath)) {
        filePaths.push(filePath)
        if (filePaths.length >= MAX_FILES) {
          truncatedReason = `源文件数量已达上限 ${MAX_FILES}，后续文件已跳过`
          break
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      mainWindow?.webContents.send('code-search-progress', {
        stage: 'error',
        title: '文件枚举失败',
        subtitle: `无法遍历目录：${errMsg}\n请检查文件夹是否存在或是否有访问权限`
      })
      return null
    }

    // 通知前端：进入批量处理阶段
    mainWindow?.webContents.send('code-search-progress', {
      stage: 'processing',
      title: '正在匹配日志打印…',
      subtitle: '逐文件正则匹配 + 函数名提取',
      current: 0,
      total: filePaths.length,
      foundCount: 0
    })

    for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
      const batch = filePaths.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(fp => processFile(fp, enabledPatterns, useCtags ? globalFuncMap : null))
      )
      
      for (const fileResults of batchResults) {
        for (const r of fileResults) {
          if (results.length >= MAX_RESULTS) {
            truncatedReason = truncatedReason || `匹配结果已达上限 ${MAX_RESULTS}，后续结果已截断`
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
      
      // 推送进度
      const processed = Math.min(i + BATCH_SIZE, filePaths.length)
      mainWindow?.webContents.send('code-search-progress', {
        stage: 'processing',
        title: '正在匹配日志打印…',
        subtitle: '逐文件正则匹配 + 函数名提取',
        current: processed,
        total: filePaths.length,
        foundCount: results.length
      })
      
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    return {
      folderPath,
      results,
      ...(truncatedReason ? {
        truncated: {
          reason: truncatedReason,
          fileCount: filePaths.length,
          resultCount: results.length
        }
      } : {})
    }
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

// ── 日志文件夹浏览（仅返回元信息，不读内容）──
ipcMain.handle('select-log-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0]
    const dirFiles = fs.readdirSync(folderPath)
    const files: Array<{
      fileName: string
      filePath: string
      size: number
      supported: boolean
      unsupportedReason?: string
    }> = []

    for (const file of dirFiles) {
      const fullPath = path.join(folderPath, file)
      try {
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) continue // 跳过子目录

        const ext = path.extname(file).toLowerCase()
        const isLogN = /\.log\.\d+$/.test(file)
        const supported = ext === '.log' || ext === '.txt' || ext === '.out' || ext === '.err' || isLogN

        files.push({
          fileName: file,
          filePath: fullPath,
          size: stat.size,
          supported,
          unsupportedReason: supported ? undefined : '不支持的文件格式（仅支持 .log/.txt/.out/.err 及 .log.N）'
        })
      } catch (err) {
        console.error(`Failed to stat ${fullPath}:`, err)
      }
    }

    return { folderPath, files }
  }
  return null
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
                contactName: m.contactName || '',
                contactInfo: m.contactInfo || ''
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
