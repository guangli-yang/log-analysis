// =============================================================================
// job_manager.cpp  —— 反写自 test_data/log.txt（3 处日志调用）
// 用途: 作为匹配引擎验证的“源码真值”。每个日志宏调用的 line 参数对应日志声明的行号。
// =============================================================================
#include "log_macros.h"

void jobRun() {
    log_emit_a("INFO", "IPSLIB", 1192, "jobRun", "job->namePipeline[SNIFFER]")  // 反写行号 1192
    log_emit_a("INFO", "IPSLIB", 1201, "jobRun", "Update job id[284] ")  // 反写行号 1201
    log_emit_a("INFO", "IPSLIB", 1215, "jobRun", "Job Run status [RUN] ")  // 反写行号 1215
}
