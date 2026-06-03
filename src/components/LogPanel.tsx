import { useState, useEffect, useRef } from 'react';
import { logger, LogEntry } from '../utils/logger';
import './LogPanel.css';
interface LogPanelProps {
 isOpen: boolean;
 onClose: () => void;
}
const LogPanel: React.FC<LogPanelProps> = ({ isOpen, onClose }) => {
 const [logs, setLogs] = useState<LogEntry[]>([]);
 const [filter, setFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'debug' | 'perf'>('all');
 const [categoryFilter, setCategoryFilter] = useState<string>('all');
 const [searchText, setSearchText] = useState('');
 const [autoScroll, setAutoScroll] = useState(true);
 const scrollRef = useRef<HTMLDivElement>(null);
 useEffect(() => {
 if (isOpen) {
 setLogs(logger.getLogs());
 }
 }, [isOpen]);
 useEffect(() => {
 const unsubscribe = logger.subscribe((log) => {
 if (isOpen) {
 setLogs(prev => [log, ...prev]);
 }
 });
 return unsubscribe;
 }, [isOpen]);
 useEffect(() => {
 if (autoScroll && scrollRef.current && logs.length > 0) {
 scrollRef.current.scrollTop = 0;
 }
 }, [logs, autoScroll]);
 const categories = ['all', ...new Set(logs.map(log => log.category))];
 const filteredLogs = logs.filter(log => {
 if (filter !== 'all' && log.level !== filter)
 return false;
 if (categoryFilter !== 'all' && log.category !== categoryFilter)
 return false;
 if (searchText && !log.message.toLowerCase().includes(searchText.toLowerCase()) &&
 !log.category.toLowerCase().includes(searchText.toLowerCase())) {
 return false;
 }
 return true;
 });
 const handleExport = () => {
 const content = logger.exportLogsFormatted();
 const blob = new Blob([content], { type: 'text/plain' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `log-analyzer-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`;
 a.click();
 URL.revokeObjectURL(url);
 };
 const handleClear = () => {
 logger.clearLogs();
 setLogs([]);
 };
 const getLevelColor = (level: LogEntry['level']) => {
 switch (level) {
 case 'error': return '#ff6b6b';
 case 'warning': return '#ffa502';
 case 'info': return '#4ecdc4';
 case 'debug': return '#95a5a6';
 case 'perf': return '#a29bfe';
 default: return '#ecf0f1';
 }
 };
 const stats = {
 total: logs.length,
 errors: logs.filter(l => l.level === 'error').length,
 warnings: logs.filter(l => l.level === 'warning').length,
 perf: logs.filter(l => l.level === 'perf').length,
 avgDuration: logs.filter(l => l.duration).reduce((sum, l) => sum + (l.duration || 0), 0) / Math.max(logs.filter(l => l.duration).length, 1),
 maxMemory: Math.max(...logs.map(l => l.memory || 0))
 };
 if (!isOpen)
 return null;
 return (<div className="log-panel-overlay" onClick={onClose}>
 <div className="log-panel" onClick={e => e.stopPropagation()}>
 <div className="log-panel-header">
 <h2>运行日志</h2>
 <div className="log-stats">
 <span className="stat-item">总计: {stats.total}</span>
 <span className="stat-item error">错误: {stats.errors}</span>
 <span className="stat-item warning">警告: {stats.warnings}</span>
 <span className="stat-item perf">性能: {stats.perf}</span>
 <span className="stat-item">平均耗时: {stats.avgDuration.toFixed(2)}ms</span>
 <span className="stat-item">最大内存: {stats.maxMemory}MB</span>
 </div>
 <div className="log-panel-actions">
 <input type="text" className="log-search-input" placeholder="搜索日志..." value={searchText} onChange={e => setSearchText(e.target.value)}/>
 <select className="log-filter-select" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
 <option value="all">全部级别</option>
 <option value="info">信息</option>
 <option value="warning">警告</option>
 <option value="error">错误</option>
 <option value="debug">调试</option>
 <option value="perf">性能</option>
 </select>
 <select className="log-filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
 {categories.map(cat => (<option key={cat} value={cat}>{cat === 'all' ? '全部分类' : cat}</option>))}
 </select>
 <label className="auto-scroll-label">
 <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)}/>
 自动滚动
 </label>
 <button className="log-panel-btn" onClick={handleExport}>导出</button>
 <button className="log-panel-btn" onClick={handleClear}>清空</button>
 <button className="log-panel-btn close-btn" onClick={onClose}>关闭</button>
 </div>
 </div>
 <div className="log-panel-content" ref={scrollRef}>
 {filteredLogs.length === 0 ? (<div className="log-empty">暂无日志</div>) : (filteredLogs.map((log, index) => (<div key={index} className="log-entry" style={{ borderLeftColor: getLevelColor(log.level) }}>
 <div className="log-header">
 <span className="log-timestamp">{log.timestamp.toLocaleTimeString()}</span>
 <span className="log-level" style={{ color: getLevelColor(log.level) }}>
 [{log.level.toUpperCase()}]
 </span>
 <span className="log-category">[{log.category}]</span>
 {log.duration !== undefined && (<span className="log-duration">{log.duration.toFixed(2)}ms</span>)}
 {log.memory !== undefined && log.memory > 0 && (<span className="log-memory">{log.memory}MB</span>)}
 </div>
 <div className="log-message">{log.message}</div>
 {log.details && (<div className="log-details">{log.details}</div>)}
 </div>)))}
 </div>
 </div>
 </div>);
};
export default LogPanel;
