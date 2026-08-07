import { ModuleLog, ModuleMapping } from '../types'

// 将模块日志 content（可能是纯数组 / {codeSearchResults} / {data:{searchResults}}）解析为条目数组
function safeParseArray(content?: string): any[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.codeSearchResults)) return parsed.codeSearchResults
    if (parsed && parsed.data && Array.isArray(parsed.data.searchResults)) return parsed.data.searchResults
    return []
  } catch {
    return []
  }
}

// 条目去重键：文件 + 行号 + 匹配文本
function entryKey(e: any): string {
  const file = e?.codeFile?.fileName || e?.fileName || ''
  const line = e?.line ?? ''
  const text = e?.matchedText || ''
  return `${file}#${line}#${text}`
}

// 深度合并两条目：导入值覆盖同键的非空字段，codeFile 对象递归合并
function mergeEntry(existing: any, incoming: any): any {
  const out: any = { ...existing }
  for (const k of Object.keys(incoming)) {
    if (k === 'codeFile') {
      out.codeFile = { ...(existing.codeFile || {}), ...(incoming.codeFile || {}) }
      continue
    }
    const v = incoming[k]
    if (v !== undefined && v !== null && v !== '') {
      out[k] = v
    }
  }
  return out
}

/**
 * 深度合并模块日志数组：
 * - 按 id（回退 name）匹配同一模块；
 * - 同一模块的 content 条目按“文件#行#文本”去重合并，导入值覆盖现有值；
 * - 不存在的模块直接追加。
 */
export function deepMergeModuleLogs(existing: ModuleLog[], incoming: ModuleLog[]): ModuleLog[] {
  const map = new Map<string, ModuleLog>()
  for (const m of existing) map.set(m.id || m.name, m)

  for (const inc of incoming) {
    const key = inc.id || inc.name
    const prev = map.get(key)
    if (prev) {
      const prevArr = safeParseArray(prev.content)
      const incArr = safeParseArray(inc.content)
      const byKey = new Map<string, any>()
      for (const e of prevArr) byKey.set(entryKey(e), e)
      for (const e of incArr) {
        const k = entryKey(e)
        const ex = byKey.get(k)
        byKey.set(k, ex ? mergeEntry(ex, e) : e)
      }
      const merged = Array.from(byKey.values())
      map.set(key, {
        ...prev,
        content: JSON.stringify(merged, null, 2),
        lineCount: merged.length,
        importedAt: Date.now()
      })
    } else {
      map.set(key, { ...inc, importedAt: inc.importedAt || Date.now() })
    }
  }
  return Array.from(map.values())
}

/**
 * 深度合并模块负责人表：
 * - 按 codePath（回退 moduleName）匹配；
 * - 同一路径用导入值覆盖非空字段；不存在的追加。
 */
export function deepMergeModuleMappings(existing: ModuleMapping[], incoming: ModuleMapping[]): ModuleMapping[] {
  const map = new Map<string, ModuleMapping>()
  for (const m of existing) map.set(m.codePath || m.moduleName, m)

  for (const inc of incoming) {
    const key = inc.codePath || inc.moduleName
    const prev = map.get(key)
    if (prev) {
      map.set(key, {
        codePath: inc.codePath || prev.codePath,
        moduleName: inc.moduleName || prev.moduleName,
        contactName: inc.contactName || prev.contactName,
        contactInfo: inc.contactInfo || prev.contactInfo
      })
    } else {
      map.set(key, inc)
    }
  }
  return Array.from(map.values())
}
