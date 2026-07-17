import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectMultipleFiles: () => ipcRenderer.invoke('select-multiple-files'),
  selectJsonFolder: () => ipcRenderer.invoke('select-json-folder'),
  selectImportConfig: () => ipcRenderer.invoke('select-import-config'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  saveJson: (data: any, defaultName: string) => ipcRenderer.invoke('save-json', data, defaultName),
  selectCodeFolder: (patterns: Array<{ pattern: string; enabled: boolean }>) => ipcRenderer.invoke('select-code-folder', patterns),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', filePath, content),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  exportConfig: (config: any) => ipcRenderer.invoke('export-config', config),
  importConfig: () => ipcRenderer.invoke('import-config'),
  getConfigProjects: () => ipcRenderer.invoke('get-config-projects'),
  aiChat: (params: { apiUrl: string; apiKey: string; modelName: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> }) =>
    ipcRenderer.invoke('ai-chat', params),
  aiTestConnection: (params: { apiUrl: string; apiKey: string; modelName: string }) =>
    ipcRenderer.invoke('ai-test-connection', params),
  listProjects: () => ipcRenderer.invoke('list-projects'),
  createProject: (name: string) => ipcRenderer.invoke('create-project', name),
  deleteProject: (name: string) => ipcRenderer.invoke('delete-project', name),
  renameProject: (oldName: string, newName: string) => ipcRenderer.invoke('rename-project', oldName, newName),
  loadProjectData: (name: string) => ipcRenderer.invoke('load-project-data', name),
  saveProjectData: (name: string, data: any) => ipcRenderer.invoke('save-project-data', name, data),
  // 供主进程 before-input-event 转发快捷键等场景使用：订阅主进程消息，返回取消订阅函数
  on: (channel: string, callback: (...args: any[]) => void) => {
    const subscription = (_event: unknown, ...args: any[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => { ipcRenderer.removeListener(channel, subscription) }
  }
})

export interface ExportResult {
  success: boolean
  reason: 'cancelled' | 'no_path' | 'write_error' | 'saved'
  path?: string
  error?: string
}

export interface ImportResult {
  success: boolean
  reason: 'cancelled' | 'no_file' | 'invalid_json' | 'read_error' | 'loaded'
  config?: any
  path?: string
  error?: string
}

declare global {
  interface Window {
    electronAPI: {
      selectFile: () => Promise<{ filePath: string; content: string; fileName: string; lineOffsets: number[] } | null>
      selectMultipleFiles: () => Promise<Array<{ filePath: string; content: string; fileName: string; lineOffsets: number[] }>>
      selectFolder: () => Promise<{ folderPath: string; files: Array<{ filePath: string; content: string; fileName: string; lineOffsets: number[] }> } | null>
      readFile: (filePath: string) => Promise<{ filePath: string; content: string; fileName: string; lineOffsets: number[] } | null>
      saveJson: (data: any, defaultName: string) => Promise<boolean>
      selectCodeFolder: (patterns: Array<{ pattern: string; enabled: boolean }>) => Promise<{ folderPath: string; results: Array<{ filePath: string; content: string; fileName: string; line: number; functionName: string; matchedPattern: string; matchedText: string; keywords?: string[] }> } | null>
      writeFile: (filePath: string, content: string) => Promise<boolean>
      loadConfig: () => Promise<any>
      saveConfig: (config: any) => Promise<boolean>
      exportConfig: (config: any) => Promise<ExportResult>
      importConfig: () => Promise<ImportResult>
      getConfigProjects: () => Promise<{ success: boolean; projects: string[]; error?: string }>
      aiChat: (params: { apiUrl: string; apiKey: string; modelName: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> }) =>
        Promise<{ success: boolean; content?: string; error?: string }>
      aiTestConnection: (params: { apiUrl: string; apiKey: string; modelName: string }) =>
        Promise<{ success: boolean; error?: string }>
      listProjects: () => Promise<{ success: boolean; projects: string[]; error?: string }>
      createProject: (name: string) => Promise<{ success: boolean; name?: string; error?: string }>
      deleteProject: (name: string) => Promise<{ success: boolean; error?: string }>
      renameProject: (oldName: string, newName: string) => Promise<{ success: boolean; name?: string; error?: string }>
      loadProjectData: (name: string) => Promise<{ success: boolean; moduleLogs: any[]; moduleMappings: any[]; error?: string }>
      saveProjectData: (name: string, data: { moduleLogs?: any[]; moduleMappings?: any[] }) => Promise<{ success: boolean; error?: string }>,
      on: (channel: string, callback: (...args: any[]) => void) => () => void
    }
  }
}
