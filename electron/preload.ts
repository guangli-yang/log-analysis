import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  saveJson: (data: any, defaultName: string) => ipcRenderer.invoke('save-json', data, defaultName)
})

declare global {
  interface Window {
    electronAPI: {
      selectFile: () => Promise<{ filePath: string; content: string; fileName: string } | null>
      selectFolder: () => Promise<{ folderPath: string; files: Array<{ filePath: string; content: string; fileName: string }> } | null>
      readFile: (filePath: string) => Promise<{ filePath: string; content: string; fileName: string } | null>
      saveJson: (data: any, defaultName: string) => Promise<boolean>
    }
  }
}
