/// <reference types="vite/client" />

interface ElectronAPI {
  selectFile: () => Promise<{ filePath: string; content: string; fileName: string } | null>
  selectFolder: () => Promise<{ folderPath: string; files: Array<{ filePath: string; content: string; fileName: string }> } | null>
  readFile: (filePath: string) => Promise<{ filePath: string; content: string; fileName: string } | null>
  saveJson: (data: any, defaultName: string) => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
