export interface LogFile {
  filePath: string
  content: string
  fileName: string
  lineOffsets?: number[]
}

export interface ErrorKeyword {
  keyword: string
  description: string
  enabled: boolean
}

export interface JobKeyword {
  keyword: string
  description: string
  enabled: boolean
}

export interface IgnoreKeyword {
  keyword: string
  description: string
  enabled: boolean
}

export interface HighlightConfig {
  backgroundColor: string
  textColor: string
  borderColor: string
}

export interface CoreDumpKeyword {
  keyword: string
  description: string
  enabled: boolean
}

export interface SearchOptions {
  caseSensitive: boolean
  wholeWord: boolean
  useRegex: boolean
}

export interface SearchHistory {
  id: string
  query: string
  options: SearchOptions
  timestamp: number
  count: number
}

export interface SearchTag {
  id: string
  name: string
  query: string
  options: SearchOptions
  createdAt: number
}

export interface SearchHighlight {
  query: string
  options: SearchOptions
  color: string
}

export const SEARCH_HIGHLIGHT_COLORS = [
  'rgba(255, 235, 59, 0.35)',
  'rgba(255, 152, 0, 0.35)',
  'rgba(233, 30, 99, 0.3)',
  'rgba(0, 188, 212, 0.35)',
  'rgba(156, 39, 176, 0.3)',
  'rgba(139, 195, 74, 0.35)',
  'rgba(3, 169, 244, 0.35)',
  'rgba(244, 67, 54, 0.3)',
  'rgba(0, 150, 136, 0.35)',
  'rgba(255, 193, 7, 0.35)'
]

export interface SearchResult {
  line: number
  start: number
  end: number
  text: string
}

export interface CodeSearchPattern {
  id: string
  name: string
  pattern: string
  description: string
  enabled: boolean
}

export interface CodeFile {
  fileName: string
}

export interface CodeSearchResult {
  codeFile: CodeFile
  line: number
  functionName: string
  matchedPattern: string
  matchedText: string
}

export interface LogCodeMatch {
  logLine: number
  logText: string
  errorKeyword: string
  codeFile: string
  codeLine: number
  codeFunction: string
  codeText: string
}

export interface ModuleLog {
  id: string
  name: string
  filePath: string
  content: string
  lineCount: number
  importedAt: number
}

export interface MatchResult {
  codeResult: CodeSearchResult
  moduleLog: ModuleLog
  matchedLines: Array<{
    lineNumber: number
    lineText: string
  }>
}

export interface MatchSummary {
  totalMatches: number
  moduleCount: number
  patternCount: number
  results: MatchResult[]
  contactInfo: Array<{ moduleName: string; contactName: string }>
}

export interface CodeSearchResultItem {
  fileName: string
  line: number
  functionName: string
  matchedPattern: string
  matchedText: string
}

export interface AppConfig {
  errorKeywords: ErrorKeyword[]
  jobKeywords: JobKeyword[]
  ignoreKeywords: IgnoreKeyword[]
  coreDumpKeywords: CoreDumpKeyword[]
  highlightConfig: HighlightConfig
  searchTags: SearchTag[]
  aiConfig?: AIConfig
  codeSearchResults?: CodeSearchResult[]
  moduleLogs?: ModuleLog[]
}

export interface ModuleMapping {
  codePath: string
  moduleName: string
  contactName: string
}

export interface ModuleMappingConfig {
  version: string
  mappings: ModuleMapping[]
}

export type Theme = 'dark' | 'light'

export interface ExportResult {
  success: boolean
  reason: 'cancelled' | 'no_path' | 'write_error' | 'saved'
  path?: string
  error?: string
}

export interface ImportResult {
  success: boolean
  reason: 'cancelled' | 'no_file' | 'invalid_json' | 'read_error' | 'loaded'
  config?: AppConfig
  path?: string
  error?: string
}

export interface AIConfig {
  apiUrl: string
  apiKey: string
  modelName: string
  enabled: boolean
  contextLines: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
