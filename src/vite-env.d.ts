/// <reference types="vite/client" />

import { ExportResult, ImportResult } from './types'

interface CodeSearchResultItem {
  fileName: string
  line: number
  functionName: string
  matchedPattern: string
  matchedText: string
  keywords: string[]
}

interface ElectronAPI {
  selectFile: () => Promise<{ filePath: string; content: string; fileName: string } | null>
  selectMultipleFiles: () => Promise<Array<{ filePath: string; content: string; fileName: string }>>
  selectJsonFolder: () => Promise<Array<{ filePath: string; content: string; fileName: string }>>
  selectImportConfig: () => Promise<Array<{ filePath: string; content: string; fileName: string }>>
  selectFolder: () => Promise<{ folderPath: string; files: Array<{ filePath: string; content: string; fileName: string }> } | null>
  readFile: (filePath: string) => Promise<{ filePath: string; content: string; fileName: string } | null>
  saveJson: (data: any, defaultName: string) => Promise<boolean>
  selectCodeFolder: (patterns: Array<{ pattern: string; enabled: boolean }>) => Promise<{ folderPath: string; results: CodeSearchResultItem[] } | null>
  writeFile: (filePath: string, content: string) => Promise<boolean>
  loadConfig: () => Promise<any>
  saveConfig: (config: any) => Promise<boolean>
  exportConfig: (config: any) => Promise<ExportResult>
  importConfig: () => Promise<ImportResult>
  getConfigProjects: () => Promise<{ success: boolean; projects: string[]; error?: string }>
  aiChat: (params: { apiUrl: string; apiKey: string; modelName: string; messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> }) =>
    Promise<{ success: boolean; content?: string; error?: string }>
  aiTestConnection: (params: { apiUrl: string; apiKey: string; modelName: string }) =>
    Promise<{ success: boolean; error?: string }>
  listProjects: () => Promise<{ success: boolean; projects: string[]; error?: string }>
  createProject: (name: string) => Promise<{ success: boolean; name?: string; error?: string }>
  deleteProject: (name: string) => Promise<{ success: boolean; error?: string }>
  renameProject: (oldName: string, newName: string) => Promise<{ success: boolean; name?: string; error?: string }>
  loadProjectData: (name: string) => Promise<{ success: boolean; moduleLogs: ProjectModuleLog[]; moduleMappings: ProjectModuleMapping[]; error?: string }>
  saveProjectData: (name: string, data: { moduleLogs?: ProjectModuleLog[]; moduleMappings?: ProjectModuleMapping[] }) => Promise<{ success: boolean; error?: string }>
}

interface ProjectModuleLog {
  id: string
  name: string
  filePath: string
  content: string
  lineCount: number
  importedAt: number
}

interface ProjectModuleMapping {
  codePath: string
  moduleName: string
  contactName: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}