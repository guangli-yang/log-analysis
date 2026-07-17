// ts_log.ts —— TS 风格日志实现（与 synthetic_log.txt 的 Format B/E 一致）
export function logInfo(line: number, func: string, msg: string): void {
  console.log(`[2026-07-15 10:23:17.372] [10:20:27.064] ${func.padEnd(48)} - [INFO]L${line} :${msg}`)
}
export function logDebug(line: number, func: string, msg: string): void {
  console.log(`[2026-07-15 10:23:17.372] [10:20:27.064] ${func.padEnd(48)} - [DEBUG]L${line} :${msg}`)
}
export function logError(line: number, func: string, msg: string): void {
  console.log(`[2026-07-15 10:23:17.372] [10:20:27.064] ${func.padEnd(48)} - [ERROR] ${msg}`)
}
