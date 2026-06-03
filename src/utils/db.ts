import Dexie, { Table } from 'dexie';

export interface ModuleMapping {
  codePath: string;
  moduleName: string;
  contactName: string;
  updatedAt?: string;
}

export interface SearchResult {
  id?: number;
  codeFile: { fileName: string };
  line: number;
  functionName: string;
  matchedPattern: string;
  matchedText: string;
  exportedAt?: string;
}

export interface Keyword {
  id?: number;
  pattern: string;
  level: string;
  tags: string[];
}

export interface SyncRecord {
  id?: number;
  action: 'export' | 'import';
  timestamp: string;
  deviceName: string;
  recordCount: number;
  success: boolean;
  fileName?: string;
}

export interface SyncFileFormat {
  version: string;
  exportedAt: string;
  deviceId: string;
  deviceName: string;
  data: {
    moduleMappings: ModuleMapping[];
    searchResults: SearchResult[];
    keywords: Keyword[];
  };
  checksum: string;
}

class LogAnalyzerDB extends Dexie {
  moduleMappings!: Table<ModuleMapping, string>;
  searchResults!: Table<SearchResult, number>;
  keywords!: Table<Keyword, number>;
  syncHistory!: Table<SyncRecord, number>;

  constructor() {
    super('LogAnalyzerDB');

    this.version(1).stores({
      moduleMappings: 'codePath, moduleName, contactName, updatedAt',
      searchResults: '++id, functionName, matchedPattern, exportedAt',
      keywords: '++id, pattern, level',
      syncHistory: '++id, action, timestamp, success'
    });
  }
}

export const db = new LogAnalyzerDB();

export async function clearAllData(): Promise<void> {
  await db.moduleMappings.clear();
  await db.searchResults.clear();
  await db.keywords.clear();
}

export async function importData(fileData: SyncFileFormat): Promise<{ success: boolean; message: string; counts: { mappings: number; results: number; keywords: number } }> {
  try {
    await clearAllData();

    let counts = { mappings: 0, results: 0, keywords: 0 };

    if (fileData.data.moduleMappings?.length > 0) {
      await db.moduleMappings.bulkAdd(fileData.data.moduleMappings);
      counts.mappings = fileData.data.moduleMappings.length;
    }

    if (fileData.data.searchResults?.length > 0) {
      const resultsWithoutId = fileData.data.searchResults.map(r => {
        const { id, ...rest } = r;
        return rest;
      });
      await db.searchResults.bulkAdd(resultsWithoutId);
      counts.results = fileData.data.searchResults.length;
    }

    if (fileData.data.keywords?.length > 0) {
      await db.keywords.bulkAdd(fileData.data.keywords);
      counts.keywords = fileData.data.keywords.length;
    }

    await db.syncHistory.add({
      action: 'import',
      timestamp: new Date().toISOString(),
      deviceName: fileData.deviceName || 'Unknown',
      recordCount: counts.mappings + counts.results + counts.keywords,
      success: true,
      fileName: `imported from ${fileData.exportedAt}`
    });

    return { success: true, message: '导入配置成功', counts };
  } catch (error) {
    await db.syncHistory.add({
      action: 'import',
      timestamp: new Date().toISOString(),
      deviceName: 'Unknown',
      recordCount: 0,
      success: false
    });
    throw error;
  }
}

export async function exportData(): Promise<SyncFileFormat> {
  const moduleMappings = await db.moduleMappings.toArray();
  const searchResults = await db.searchResults.toArray();
  const keywords = await db.keywords.toArray();

  const deviceId = `browser_${Date.now()}`;
  const deviceName = navigator.userAgent.split(' ').slice(-2).join(' ');

  const data: SyncFileFormat = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    deviceId,
    deviceName,
    data: {
      moduleMappings,
      searchResults,
      keywords
    },
    checksum: ''
  };

  data.checksum = generateChecksum(data);

  await db.syncHistory.add({
    action: 'export',
    timestamp: new Date().toISOString(),
    deviceName,
    recordCount: moduleMappings.length + searchResults.length + keywords.length,
    success: true
  });

  return data;
}

function generateChecksum(data: SyncFileFormat): string {
  const str = JSON.stringify({ version: data.version, exportedAt: data.exportedAt, data: data.data });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hash:${Math.abs(hash).toString(16)}`;
}

export async function getSyncHistory(): Promise<SyncRecord[]> {
  return await db.syncHistory.orderBy('timestamp').reverse().limit(10).toArray();
}

export async function getModuleMappings(): Promise<ModuleMapping[]> {
  return await db.moduleMappings.toArray();
}

export async function getSearchResults(limit = 100, offset = 0): Promise<SearchResult[]> {
  return await db.searchResults.offset(offset).limit(limit).toArray();
}

export async function getKeywords(): Promise<Keyword[]> {
  return await db.keywords.toArray();
}

export async function getTotalCounts(): Promise<{ mappings: number; results: number; keywords: number }> {
  const [mappings, results, keywords] = await Promise.all([
    db.moduleMappings.count(),
    db.searchResults.count(),
    db.keywords.count()
  ]);
  return { mappings, results, keywords };
}

export async function addSampleData(): Promise<void> {
  const existing = await db.moduleMappings.count();
  if (existing > 0) return;

  const sampleMappings: ModuleMapping[] = [
    { codePath: 'project\\1', moduleName: '打印模块', contactName: '张三', updatedAt: new Date().toISOString() },
    { codePath: 'project\\2', moduleName: '编码模块', contactName: '王五', updatedAt: new Date().toISOString() },
    { codePath: 'project\\3', moduleName: '解码模块', contactName: '赵六', updatedAt: new Date().toISOString() },
    { codePath: 'project\\4', moduleName: '网络模块', contactName: '李四', updatedAt: new Date().toISOString() },
  ];

  const sampleResults: SearchResult[] = [
    { codeFile: { fileName: 'C:\\project\\2\\network.c' }, line: 88, functionName: 'sendData', matchedPattern: 'LOGE错误', matchedText: 'Network send error' },
    { codeFile: { fileName: 'C:\\project\\1\\audio.cpp' }, line: 200, functionName: 'playAudio', matchedPattern: 'LOGE错误', matchedText: 'Audio buffer underrun' },
    { codeFile: { fileName: 'C:\\project\\3\\decoder.c' }, line: 45, functionName: 'decodeFrame', matchedPattern: 'LOGE错误', matchedText: 'Decode failed' },
  ];

  const sampleKeywords: Keyword[] = [
    { pattern: 'LOGE错误', level: 'error', tags: ['日志', '错误'] },
    { pattern: 'WARN警告', level: 'warning', tags: ['日志', '警告'] },
  ];

  await db.moduleMappings.bulkAdd(sampleMappings);
  await db.searchResults.bulkAdd(sampleResults);
  await db.keywords.bulkAdd(sampleKeywords);
}
