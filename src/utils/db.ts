import Dexie, { Table } from 'dexie';

export interface ProjectInfo {
  id?: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleMapping {
  id?: number;
  projectName: string;
  codePath: string;
  moduleName: string;
  contactName: string;
  updatedAt?: string;
}

export interface SearchResult {
  id?: number;
  projectName: string;
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
  projects!: Table<ProjectInfo, number>;
  moduleMappings!: Table<ModuleMapping, number>;
  searchResults!: Table<SearchResult, number>;
  keywords!: Table<Keyword, number>;
  syncHistory!: Table<SyncRecord, number>;

  constructor() {
    super('LogAnalyzerDB');

    this.version(1).stores({
      projects: '++id, name',
      moduleMappings: '++id, projectName, codePath, moduleName, contactName',
      searchResults: '++id, projectName, functionName, matchedPattern',
      keywords: '++id, pattern, level',
      syncHistory: '++id, action, timestamp, success'
    });
  }
}

export const db = new LogAnalyzerDB();

export async function clearAllData(): Promise<void> {
  await db.projects.clear();
  await db.moduleMappings.clear();
  await db.searchResults.clear();
  await db.keywords.clear();
}

export async function clearProjectData(projectName: string): Promise<void> {
  await db.moduleMappings.where('projectName').equals(projectName).delete();
  await db.searchResults.where('projectName').equals(projectName).delete();
}

export async function importProjectData(projectName: string, fileData: SyncFileFormat): Promise<{ success: boolean; message: string; counts: { mappings: number; results: number } }> {
  try {
    let counts = { mappings: 0, results: 0 };

    if (fileData.data.moduleMappings?.length > 0) {
      const mappingsWithProject = fileData.data.moduleMappings.map(m => ({
        ...m,
        projectName,
        updatedAt: new Date().toISOString()
      }));
      await db.moduleMappings.bulkAdd(mappingsWithProject);
      counts.mappings = fileData.data.moduleMappings.length;
    }

    if (fileData.data.searchResults?.length > 0) {
      const resultsWithProject = fileData.data.searchResults.map(r => ({
        ...r,
        projectName
      }));
      await db.searchResults.bulkAdd(resultsWithProject);
      counts.results = fileData.data.searchResults.length;
    }

    return { success: true, message: '导入配置成功', counts };
  } catch (error) {
    throw error;
  }
}

export async function exportData(projectName: string): Promise<SyncFileFormat> {
  const moduleMappings = await db.moduleMappings.where('projectName').equals(projectName).toArray();
  const searchResults = await db.searchResults.where('projectName').equals(projectName).toArray();
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

export async function getProjects(): Promise<ProjectInfo[]> {
  return await db.projects.toArray();
}

export async function addProject(name: string): Promise<number> {
  return await db.projects.add({
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function deleteProject(name: string): Promise<void> {
  await db.moduleMappings.where('projectName').equals(name).delete();
  await db.searchResults.where('projectName').equals(name).delete();
  await db.projects.where('name').equals(name).delete();
}

export async function renameProject(oldName: string, newName: string): Promise<void> {
  const mappings = await db.moduleMappings.where('projectName').equals(oldName).toArray();
  for (const m of mappings) {
    await db.moduleMappings.update(m.id!, { projectName: newName, updatedAt: new Date().toISOString() });
  }
  const results = await db.searchResults.where('projectName').equals(oldName).toArray();
  for (const r of results) {
    await db.searchResults.update(r.id!, { projectName: newName });
  }
  await db.projects.where('name').equals(oldName).modify({ name: newName, updatedAt: new Date().toISOString() });
}

export async function getModuleMappings(projectName?: string): Promise<ModuleMapping[]> {
  if (projectName) {
    return await db.moduleMappings.where('projectName').equals(projectName).toArray();
  }
  return await db.moduleMappings.toArray();
}

export async function getSearchResults(projectName?: string, limit = 100, offset = 0): Promise<SearchResult[]> {
  if (projectName) {
    return await db.searchResults.where('projectName').equals(projectName).offset(offset).limit(limit).toArray();
  }
  return await db.searchResults.offset(offset).limit(limit).toArray();
}

export async function getProjectCounts(projectName: string): Promise<{ mappings: number; results: number }> {
  const [mappings, results] = await Promise.all([
    db.moduleMappings.where('projectName').equals(projectName).count(),
    db.searchResults.where('projectName').equals(projectName).count()
  ]);
  return { mappings, results };
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
  const existing = await db.projects.count();
  if (existing > 0) return;

  // 创建默认项目
  const defaultProject = '默认项目';
  await db.projects.add({
    name: defaultProject,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const sampleMappings: ModuleMapping[] = [
    { projectName: defaultProject, codePath: 'project\\1', moduleName: '打印模块', contactName: '张三', updatedAt: new Date().toISOString() },
    { projectName: defaultProject, codePath: 'project\\2', moduleName: '编码模块', contactName: '王五', updatedAt: new Date().toISOString() },
    { projectName: defaultProject, codePath: 'project\\3', moduleName: '解码模块', contactName: '赵六', updatedAt: new Date().toISOString() },
    { projectName: defaultProject, codePath: 'project\\4', moduleName: '网络模块', contactName: '李四', updatedAt: new Date().toISOString() },
  ];

  const sampleResults: SearchResult[] = [
    { projectName: defaultProject, codeFile: { fileName: 'C:\\project\\2\\network.c' }, line: 88, functionName: 'sendData', matchedPattern: 'LOGE错误', matchedText: 'Network send error' },
    { projectName: defaultProject, codeFile: { fileName: 'C:\\project\\1\\audio.cpp' }, line: 200, functionName: 'playAudio', matchedPattern: 'LOGE错误', matchedText: 'Audio buffer underrun' },
    { projectName: defaultProject, codeFile: { fileName: 'C:\\project\\3\\decoder.c' }, line: 45, functionName: 'decodeFrame', matchedPattern: 'LOGE错误', matchedText: 'Decode failed' },
  ];

  const sampleKeywords: Keyword[] = [
    { pattern: 'LOGE错误', level: 'error', tags: ['日志', '错误'] },
    { pattern: 'WARN警告', level: 'warning', tags: ['日志', '警告'] },
  ];

  await db.moduleMappings.bulkAdd(sampleMappings);
  await db.searchResults.bulkAdd(sampleResults);
  await db.keywords.bulkAdd(sampleKeywords);
}
