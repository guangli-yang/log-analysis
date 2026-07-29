import {
  ModuleLog,
  ModuleMapping,
  CodeSearchResult,
  MatchResult,
  MatchSummary,
  MatchedLogLine,
  PersonGroup,
  PersonItem,
  FolderAnalysisFileResult,
  PerFileStatus
} from '../types'
import { matchModuleAgainstLog, isConcernLevel } from './logMatch'

// ═══════════════════════════════════════════════════
//  负责人解析（与 LogMatchPanel 共享，避免重复逻辑）
// ═══════════════════════════════════════════════════

const normalizePath = (p: string) => p.replace(/\\/g, '/')

export function isPathSegmentMatch(codePath: string, mappingPath: string): boolean {
  const normalizedCodePath = normalizePath(codePath)
  const normalizedMappingPath = normalizePath(mappingPath)

  const index = normalizedCodePath.indexOf(normalizedMappingPath)
  if (index === -1) return false

  const before = index === 0 ? '/' : normalizedCodePath[index - 1]
  const afterIndex = index + normalizedMappingPath.length
  const after = afterIndex >= normalizedCodePath.length ? '/' : normalizedCodePath[afterIndex]

  return (before === '/' || before === '\\') && (after === '/' || after === '\\' || afterIndex >= normalizedCodePath.length)
}

/**
 * 从匹配结果中构建 MatchSummary（负责人在内）。
 * 供单文件模式与批量分析模式共用。
 */
export function buildMatchSummary(
  selectedModules: ModuleLog[],
  mainLogLines: string[],
  moduleMappings: ModuleMapping[]
): MatchSummary | null {
  const matchResults: MatchResult[] = []
  const matchedCodePaths = new Set<string>()

  selectedModules.forEach(moduleLog => {
    const moduleMatches = matchModuleAgainstLog(moduleLog, mainLogLines)
    moduleMatches.forEach(({ candidate, lines }) => {
      if (lines.length === 0) return

      const codePath = candidate.codeFile?.fileName || moduleLog.name
      const dummyCodeResult: CodeSearchResult = {
        codeFile: { fileName: codePath },
        line: candidate.line,
        functionName: candidate.functionName || '',
        matchedPattern: candidate.matchedPattern || '精确匹配',
        matchedText: candidate.matchedText || `共 ${lines.length} 处匹配`,
        keywords: candidate.keywords
      }
      matchResults.push({
        codeResult: dummyCodeResult,
        moduleLog,
        matchedLines: lines
      })
      if (candidate.codeFile?.fileName) {
        matchedCodePaths.add(candidate.codeFile.fileName)
      }
    })
  })

  if (matchResults.length === 0) return null

  const mappingContactInfo: Array<{ moduleName: string; contactName: string }> = []
  const seenContactInfo = new Set<string>()
  matchedCodePaths.forEach(codePath => {
    const matchedMappings = moduleMappings.filter(m => isPathSegmentMatch(codePath, m.codePath))
    matchedMappings.forEach(mapping => {
      const key = `${mapping.contactName}-${mapping.moduleName}`
      if (!seenContactInfo.has(key)) {
        seenContactInfo.add(key)
        mappingContactInfo.push({
          moduleName: mapping.moduleName,
          contactName: mapping.contactName
        })
      }
    })
  })

  return {
    totalMatches: matchResults.reduce((sum, r) => sum + r.matchedLines.length, 0),
    moduleCount: selectedModules.length,
    patternCount: 1,
    results: matchResults,
    contactInfo: mappingContactInfo
  }
}

// ═══════════════════════════════════════════════════
//  按人分组转换
// ═══════════════════════════════════════════════════

/**
 * 将 MatchSummary 转为按负责人分组的 PersonGroup[]。
 * 不再关心模块名，只关心：人 → 文件·函数 → 日志行。
 */
export function buildPersonGroups(
  summary: MatchSummary,
  moduleMappings: ModuleMapping[]
): PersonGroup[] {
  // 预建 codePath → (contactName, contactInfo) 映射
  function resolveMapping(codePath: string): { contactName: string; contactInfo?: string } {
    const normalized = normalizePath(codePath)
    for (const m of moduleMappings) {
      if (isPathSegmentMatch(normalized, normalizePath(m.codePath))) {
        return { contactName: m.contactName, contactInfo: m.contactInfo }
      }
    }
    return { contactName: '未分配负责人' }
  }

  // 按 (contactName, fileName, functionName) 三级分组
  const bucket = new Map<string, Map<string, Map<string, MatchedLogLine[]>>>()
  // 追踪每个联系人的联系方式（取第一个非空值）
  const contactInfoByPerson = new Map<string, string | undefined>()

  for (const result of summary.results) {
    const codePath = result.codeResult.codeFile?.fileName || ''
    const { contactName, contactInfo } = resolveMapping(codePath)
    const fileName = codePath.split(/[/\\]/).pop() || codePath || '（未知文件）'
    const funcName = result.codeResult.functionName || '（未识别函数）'

    // 记录联系方式（优先保留非空值）
    if (!contactInfoByPerson.has(contactName) || !contactInfoByPerson.get(contactName)) {
      contactInfoByPerson.set(contactName, contactInfo)
    }

    let byFile = bucket.get(contactName)
    if (!byFile) { byFile = new Map(); bucket.set(contactName, byFile) }

    let byFunc = byFile.get(fileName)
    if (!byFunc) { byFunc = new Map(); byFile.set(fileName, byFunc) }

    const existing = byFunc.get(funcName)
    if (existing) {
      existing.push(...result.matchedLines)
    } else {
      byFunc.set(funcName, [...result.matchedLines])
    }
  }

  // 构建 PersonGroup[]
  const groups: PersonGroup[] = []

  bucket.forEach((byFile, contactName) => {
    const items: PersonItem[] = []

    byFile.forEach((byFunc, fileName) => {
      byFunc.forEach((lines, functionName) => {
        // 按 lineNumber 去重
        const seen = new Set<number>()
        const deduped: MatchedLogLine[] = []
        lines.sort((a, b) => a.lineNumber - b.lineNumber)
        for (const l of lines) {
          if (!seen.has(l.lineNumber)) {
            seen.add(l.lineNumber)
            deduped.push(l)
          }
        }
        items.push({
          fileName,
          functionName,
          matchCount: deduped.length,
          matchedLines: deduped
        })
      })
    })

    // 同一人内按 matchCount 降序
    items.sort((a, b) => b.matchCount - a.matchCount)

    const totalMatches = items.reduce((s, i) => s + i.matchCount, 0)

    groups.push({
      contactName,
      contactInfo: contactInfoByPerson.get(contactName),
      totalMatches,
      itemCount: items.length,
      items
    })
  })

  // 按 totalMatches 降序，"未分配负责人" 排最后
  groups.sort((a, b) => {
    if (a.contactName === '未分配负责人') return 1
    if (b.contactName === '未分配负责人') return -1
    return b.totalMatches - a.totalMatches
  })

  return groups
}

/** 生成按人分组的纯文本（供 UI 复制和结果文件共用） */
export function buildPersonText(groups: PersonGroup[]): string {
  const lines: string[] = []

  lines.push('📋 快速分析结果')
  lines.push('')
  lines.push(`🕐 分析时间：${new Date().toLocaleString()}`)
  lines.push('')
  lines.push('👥 负责人概览：')
  for (const g of groups) {
    lines.push(`  👤 ${g.contactName} — ${g.totalMatches} 处错误（${g.itemCount} 个文件·函数）`)
  }
  lines.push('')
  lines.push('═══════════════════════════════════════')

  for (const g of groups) {
    lines.push('')
    lines.push(`👤 ${g.contactName}`)
    lines.push('')
    for (const item of g.items) {
      lines.push(`  ▸ ${item.fileName} · ${item.functionName}（${item.matchCount}处）`)
      for (const l of item.matchedLines) {
        const trimmed = l.lineText.trim()
        lines.push(`    行 ${l.lineNumber}: ${trimmed}`)
      }
      lines.push('')
    }
  }

  lines.push('═══════════════════════════════════════')
  lines.push('由 Log Analyzer 生成')

  return lines.join('\n')
}

// ═══════════════════════════════════════════════════
//  纯文本结果报告生成
// ═══════════════════════════════════════════════════

export function generateResultFileContent(
  folderPath: string,
  fileName: string,
  fileIndex: number,
  totalFiles: number,
  matchSummary: MatchSummary,
  moduleMappings: ModuleMapping[]
): string {
  const lines: string[] = []

  const personGroups = buildPersonGroups(matchSummary, moduleMappings)

  // ─ 批次全局总结 ─
  lines.push('═══════════════════════════════════════')
  lines.push('📋 文件夹批量快速分析 — 批次全局总结')
  lines.push('═══════════════════════════════════════')
  lines.push('')
  lines.push(`📂 文件夹：${folderPath}`)
  lines.push(`🕐 分析时间：${new Date().toLocaleString()}`)
  lines.push(`📊 文件：${fileIndex}/${totalFiles}（当前仅写入本文件的数据）`)
  lines.push('')
  lines.push('👥 负责人概览：')
  if (personGroups.length > 0) {
    for (const g of personGroups) {
      lines.push(`  👤 ${g.contactName} — ${g.totalMatches} 处错误（${g.itemCount} 个文件·函数）`)
    }
  } else {
    lines.push('  （无可匹配的负责人信息）')
  }
  lines.push('')
  lines.push('📊 本文件统计摘要：')
  lines.push(`  • 匹配总数：${matchSummary.totalMatches}`)
  lines.push('')

  // ─ 文件详细匹配 ─
  lines.push('═══════════════════════════════════════')
  lines.push(`📄 文件：${fileName}`)
  lines.push('═══════════════════════════════════════')

  // 复用 buildPersonText 的个人详情部分
  lines.push('')
  for (const g of personGroups) {
    lines.push(`👤 ${g.contactName}`)
    lines.push('')
    for (const item of g.items) {
      lines.push(`  ▸ ${item.fileName} · ${item.functionName}（${item.matchCount}处）`)
      for (const l of item.matchedLines) {
        lines.push(`    行 ${l.lineNumber}: ${l.lineText.trim()}`)
      }
      lines.push('')
    }
  }

  lines.push('═══════════════════════════════════════')
  lines.push('由 Log Analyzer 生成')

  return lines.join('\n')
}

/** 不支持格式文件的跳过说明 */
export function generateUnsupportedFileContent(folderPath: string, fileName: string): string {
  const lines: string[] = []
  lines.push('═══════════════════════════════════════')
  lines.push('📋 文件夹批量快速分析 — 批次全局总结')
  lines.push('═══════════════════════════════════════')
  lines.push('')
  lines.push(`📂 文件夹：${folderPath}`)
  lines.push(`🕐 分析时间：${new Date().toLocaleString()}`)
  lines.push('')
  lines.push(`📄 文件：${fileName}`)
  lines.push('⛔ 该文件格式不支持，跳过分析')
  lines.push('💡 支持格式：.log / .txt / .out / .err')
  lines.push('')
  lines.push('═══════════════════════════════════════')
  lines.push('由 Log Analyzer 生成')
  return lines.join('\n')
}

// ═══════════════════════════════════════════════════
//  批量分析核心（渲染进程串行执行）
// ═══════════════════════════════════════════════════

export interface BatchAnalysisOptions {
  folderPath: string
  files: Array<{ fileName: string; filePath: string; supported: boolean }>
  moduleLogs: ModuleLog[]
  moduleMappings: ModuleMapping[]
  onProgress: (
    fileIndex: number,
    total: number,
    perFileStatus: PerFileStatus,
    currentFile: string,
    cumulativeMatchCount: number,
    cumulativeModuleCount: number
  ) => void
  onFileDone: (result: FolderAnalysisFileResult) => void
  cancelledRef: { current: boolean }
}

/**
 * 串行执行批量分析。
 * 对每个支持的文件：
 *   1. 通过 IPC read-file 读取内容
 *   2. 调用 buildMatchSummary 得到匹配结果
 *   3. 生成纯文本报告并通过 IPC write-file 保存
 *   4. 返回 FolderAnalysisFileResult
 * 对不支持的文件：直接生成跳过文件并返回结果。
 */
export async function runBatchAnalysis(options: BatchAnalysisOptions): Promise<FolderAnalysisFileResult[]> {
  const { folderPath, files, moduleLogs, moduleMappings, onProgress, onFileDone, cancelledRef } = options
  const results: FolderAnalysisFileResult[] = []
  let cumulativeMatchCount = 0
  let cumulativeModuleSet = new Set<string>()
  const total = files.length

  for (let i = 0; i < total; i++) {
    if (cancelledRef.current) break

    const file = files[i]
    const resultFilePath = file.filePath + '_分析结果.txt'

    if (!file.supported) {
      onProgress(i + 1, total, 'skipped', file.fileName, cumulativeMatchCount, cumulativeModuleSet.size)

      // 为不支持格式生成结果文件
      const content = generateUnsupportedFileContent(folderPath, file.fileName)
      try {
        await window.electronAPI.writeFile(resultFilePath, content)
      } catch (e) {
        console.error(`Failed to write unsupported file result:`, e)
      }

      const skipResult: FolderAnalysisFileResult = {
        fileName: file.fileName,
        filePath: file.filePath,
        supported: false,
        success: false,
        matchSummary: null,
        resultFilePath,
        reason: '不支持的文件格式'
      }
      results.push(skipResult)
      onFileDone(skipResult)
      continue
    }

    // 分析中
    onProgress(i + 1, total, 'analyzing', file.fileName, cumulativeMatchCount, cumulativeModuleSet.size)

    try {
      const fileData = await window.electronAPI.readFile(file.filePath)
      if (!fileData) {
        const failResult: FolderAnalysisFileResult = {
          fileName: file.fileName,
          filePath: file.filePath,
          supported: true,
          success: false,
          matchSummary: null,
          resultFilePath,
          reason: '读取文件失败'
        }
        results.push(failResult)
        onFileDone(failResult)
        onProgress(i + 1, total, 'done', file.fileName, cumulativeMatchCount, cumulativeModuleSet.size)
        continue
      }

      const mainLogLines = fileData.content.split('\n')
      const summary = buildMatchSummary(moduleLogs, mainLogLines, moduleMappings)

      if (summary) {
        cumulativeMatchCount += summary.totalMatches
        summary.results.forEach(r => cumulativeModuleSet.add(r.moduleLog.name))
      }

      // 生成结果文件内容
      const resultContent = summary
        ? generateResultFileContent(folderPath, file.fileName, i + 1, total, summary, moduleMappings)
        : generateEmptyResultContent(folderPath, file.fileName, i + 1, total)

      await window.electronAPI.writeFile(resultFilePath, resultContent)

      const fileResult: FolderAnalysisFileResult = {
        fileName: file.fileName,
        filePath: file.filePath,
        supported: true,
        success: true,
        matchSummary: summary,
        resultFilePath
      }
      results.push(fileResult)
      onFileDone(fileResult)
    } catch (e) {
      console.error(`Analysis failed for ${file.fileName}:`, e)
      const errorResult: FolderAnalysisFileResult = {
        fileName: file.fileName,
        filePath: file.filePath,
        supported: true,
        success: false,
        matchSummary: null,
        resultFilePath,
        reason: `分析异常：${e instanceof Error ? e.message : String(e)}`
      }
      results.push(errorResult)
      onFileDone(errorResult)
    }

    onProgress(i + 1, total, 'done', file.fileName, cumulativeMatchCount, cumulativeModuleSet.size)
  }

  return results
}

/** 无匹配时的结果内容 */
function generateEmptyResultContent(folderPath: string, fileName: string, fileIndex: number, totalFiles: number): string {
  const lines: string[] = []
  lines.push('═══════════════════════════════════════')
  lines.push('📋 文件夹批量快速分析 — 批次全局总结')
  lines.push('═══════════════════════════════════════')
  lines.push('')
  lines.push(`📂 文件夹：${folderPath}`)
  lines.push(`🕐 分析时间：${new Date().toLocaleString()}`)
  lines.push(`📊 文件：${fileIndex}/${totalFiles}`)
  lines.push('')
  lines.push(`📄 文件：${fileName}`)
  lines.push('ℹ️ 未找到匹配的模块日志')
  lines.push('')
  lines.push('═══════════════════════════════════════')
  lines.push('由 Log Analyzer 生成')
  return lines.join('\n')
}

// 重新导出 isConcernLevel（供外部使用）
export { isConcernLevel }
