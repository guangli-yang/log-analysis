export interface LogFile {
  filePath: string
  content: string
  fileName: string
}

export interface ErrorKeyword {
  keyword: string
  description: string
}

export interface SearchOptions {
  caseSensitive: boolean
  wholeWord: boolean
  useRegex: boolean
}

export interface SearchResult {
  line: number
  start: number
  end: number
  text: string
}

export type Theme = 'dark' | 'light'
