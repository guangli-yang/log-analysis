// =============================================================================
// edge_cases_ts.ts  —— 反写自 test_data/log.txt（2 处日志调用）
// 用途: 作为匹配引擎验证的“源码真值”。每个日志宏调用的 line 参数对应日志声明的行号。
// =============================================================================
import { logInfo, logDebug, logError } from './ts_log'

export function sendData(): void {
  logInfo(0, "sendData", "dispatch event sent [0x12]")  // 反写行号 0
}

export function fetchConfig(): void {
  logDebug(909, "fetchConfig", "config loaded [ok]")  // 反写行号 909
}
