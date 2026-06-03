export interface LogEntry {
  timestamp: Date
  level: 'info' | 'warning' | 'error' | 'debug' | 'perf'
  category: string
  message: string
  details?: string
  duration?: number
  memory?: number
}

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 500
  private listeners: ((log: LogEntry) => void)[] = []
  private performanceMarks: Map<string, number> = new Map()
  private enabledCategories: Set<string> = new Set([
    'App', 'File', 'Search', 'Analysis', 'UI', 'Performance', 'Error', 'Render', 'State', 'API'
  ])

  private addLog(level: LogEntry['level'], category: string, message: string, details?: string, duration?: number) {
    const memory = (performance as any).memory?.usedJSHeapSize || 0
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      details,
      duration,
      memory: Math.round(memory / 1024 / 1024)
    }
    
    this.logs.unshift(entry)
    
    if (this.logs.length > this.maxLogs) {
      this.logs.pop()
    }
    
    this.listeners.forEach(listener => listener(entry))
    
    const timestamp = entry.timestamp.toLocaleTimeString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${category}]`
    const logMessage = `${prefix} ${message} ${details || ''} ${duration ? `${duration}ms` : ''} ${entry.memory ? `${entry.memory}MB` : ''}`
    const consoleMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : level === 'perf' ? 'time' : 'log'
    console[consoleMethod](logMessage)
  }

  info(category: string, message: string, details?: string) {
    if (this.enabledCategories.has(category)) {
      this.addLog('info', category, message, details)
    }
  }

  warning(category: string, message: string, details?: string) {
    this.addLog('warning', category, message, details)
  }

  error(category: string, message: string, details?: string) {
    this.addLog('error', category, message, details)
  }

  debug(category: string, message: string, details?: string) {
    if (this.enabledCategories.has(category)) {
      this.addLog('debug', category, message, details)
    }
  }

  perf(category: string, message: string, duration: number, details?: string) {
    this.addLog('perf', category, message, details, duration)
  }

  timeStart(label: string) {
    this.performanceMarks.set(label, performance.now())
  }

  timeEnd(label: string, category: string, message: string): number {
    const startTime = this.performanceMarks.get(label)
    if (startTime) {
      const duration = performance.now() - startTime
      this.performanceMarks.delete(label)
      this.perf(category, message, duration)
      return duration
    }
    return 0
  }

  trace(category: string, functionName: string, action: 'enter' | 'exit' | 'error', details?: string) {
    const message = action === 'enter' ? `→ ${functionName}` : action === 'exit' ? `← ${functionName}` : `✗ ${functionName}`
    this.debug(category, message, details)
  }

  stateChange(component: string, stateName: string, oldValue: any, newValue: any) {
    this.debug('State', `${component}.${stateName}`, `${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`)
  }

  renderStart(componentName: string) {
    this.timeStart(`render_${componentName}`)
    this.debug('Render', `开始渲染 ${componentName}`)
  }

  renderEnd(componentName: string) {
    const duration = this.timeEnd(`render_${componentName}`, 'Render', `渲染完成 ${componentName}`)
    if (duration > 16) {
      this.warning('Performance', `${componentName} 渲染耗时过长`, `${duration.toFixed(2)}ms`)
    }
  }

  apiStart(apiName: string) {
    this.timeStart(`api_${apiName}`)
    this.debug('API', `调用 ${apiName}`)
  }

  apiEnd(apiName: string, success: boolean) {
    const duration = this.timeEnd(`api_${apiName}`, 'API', `${success ? '成功' : '失败'} ${apiName}`)
    if (duration > 1000) {
      this.warning('Performance', `${apiName} 响应时间过长`, `${duration.toFixed(2)}ms`)
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logs.filter(log => log.level === level)
  }

  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter(log => log.category === category)
  }

  getPerformanceLogs(): LogEntry[] {
    return this.logs.filter(log => log.level === 'perf' || log.category === 'Performance')
  }

  clearLogs() {
    this.logs = []
    this.performanceMarks.clear()
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  exportLogsFormatted(): string {
    return this.logs.map(entry => {
      const timestamp = entry.timestamp.toLocaleString()
      const memory = entry.memory ? ` [Memory: ${entry.memory}MB]` : ''
      const duration = entry.duration ? ` [Duration: ${entry.duration.toFixed(2)}ms]` : ''
      return `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]${memory}${duration}\n  ${entry.message}${entry.details ? `\n  Details: ${entry.details}` : ''}`
    }).join('\n\n')
  }

  subscribe(listener: (log: LogEntry) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  enableCategory(category: string) {
    this.enabledCategories.add(category)
  }

  disableCategory(category: string) {
    this.enabledCategories.delete(category)
  }
}

export const logger = new Logger()

export const logCategories = {
  APP: 'App',
  FILE: 'File',
  SEARCH: 'Search',
  ANALYSIS: 'Analysis',
  UI: 'UI',
  PERFORMANCE: 'Performance',
  ERROR: 'Error',
  RENDER: 'Render',
  STATE: 'State',
  API: 'API'
} as const

export function withPerformanceLogging<T extends (...args: any[]) => any>(
  fn: T,
  name: string,
  category: string = 'Performance'
): T {
  return ((...args: any[]) => {
    logger.timeStart(name)
    try {
      const result = fn(...args)
      if (result instanceof Promise) {
        return result.then((res) => {
          logger.timeEnd(name, category, name)
          return res
        }).catch((err) => {
          logger.error(category, `${name} 失败`, err.message)
          throw err
        })
      }
      logger.timeEnd(name, category, name)
      return result
    } catch (error) {
      logger.error(category, `${name} 失败`, error instanceof Error ? error.message : String(error))
      throw error
    }
  }) as T
}
