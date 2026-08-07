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
  keywords?: string[]
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

export interface MatchedLogLine {
  lineNumber: number
  lineText: string
  /** 命中的代码文本（来自模块日志） */
  codeText?: string
  /** 命中的代码文件路径（来自模块日志） */
  codePath?: string
  /** 命中的代码行号（来自模块日志） */
  codeLine?: number
  /** 命中的父函数名（来自模块日志，用于跨模块消歧） */
  functionName?: string
}

export interface MatchResult {
  codeResult: CodeSearchResult
  moduleLog: ModuleLog
  matchedLines: MatchedLogLine[]
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
  keywords?: string[]
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
  codeSearchPatterns?: CodeSearchPattern[]
  moduleLogs?: ModuleLog[]
}

export interface ModuleMapping {
  codePath: string
  moduleName: string
  contactName: string
  /** 联系方式（可选）：邮箱、电话等 */
  contactInfo?: string
}

export interface ModuleMappingConfig {
  version: string
  mappings: ModuleMapping[]
}

export interface ProjectData {
  moduleLogs: ModuleLog[]
  moduleMappings: ModuleMapping[]
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

// ========== 文件夹批量快速分析 ==========

/** 文件夹中扫描到的单个文件元信息 */
export interface FolderFileItem {
  fileName: string
  filePath: string
  size: number
  supported: boolean
  unsupportedReason?: string
}

/** select-log-folder IPC 返回值 */
export interface LogFolderResult {
  folderPath: string
  files: FolderFileItem[]
}

/** 批量分析中单文件的处理结果 */
export interface FolderAnalysisFileResult {
  fileName: string
  filePath: string
  supported: boolean
  success: boolean
  /** 匹配摘要（支持格式 + 分析成功时填充） */
  matchSummary: MatchSummary | null
  /** 生成的结果文件绝对路径 */
  resultFilePath: string
  /** 失败/跳过原因 */
  reason?: string
}

/** 批量分析进度中单文件状态 */
export type PerFileStatus = 'waiting' | 'analyzing' | 'done' | 'skipped'

/** 批量分析面板模式 */
export type LogMatchMode = 'single' | 'batch'

// ========== 按人分组展示 ==========

/** 人员分组中一个 (文件·函数) 项 */
export interface PersonItem {
  fileName: string          // "video_pcie.c"
  functionName: string      // "video_pcie_cancel_process"；为空时显示「未识别函数」
  matchCount: number        // 该文件·函数下的总匹配行数
  matchedLines: MatchedLogLine[]  // 展平后的所有匹配行（已按行号去重）
}

/** 按负责人分组的匹配结果 */
export interface PersonGroup {
  contactName: string       // "张亮"；无映射时 = "未分配负责人"
  contactInfo?: string      // 联系方式（来自 ModuleMapping）
  totalMatches: number      // 该人总错误行数
  itemCount: number         // 文件·函数项数
  items: PersonItem[]       // 按 matchCount 降序
}

// ========== 耗时分析 ==========

/** 用户配置的耗时分析节点 */
export interface TimingNode {
  id: string
  keyword: string
  description: string
  enabled: boolean
}

/** 单节点时间记录 */
export interface TimingEntry {
  nodeIndex: number
  nodeKeyword: string
  lineNumber: number
  timestamp: string          // 原始 "0:35:50.509"
  timestampMs: number        // 毫秒值
  elapsedFromPrevMs?: number // 距前一节点耗时（首节点无此字段）
}

/** 单轮提取结果 */
export interface TimingCycle {
  cycleIndex: number
  nodes: TimingEntry[]
  totalElapsedMs: number     // 最后一个节点 - 第一个节点的总耗时
  isComplete: boolean        // 是否包含所有配置的节点
  missingNodes?: string[]    // 缺少的节点关键词列表
}
