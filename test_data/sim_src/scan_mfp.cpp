// =============================================================================
// scan_mfp.cpp  —— 反写自 test_data/log.txt（7 处日志调用）
// 用途: 作为匹配引擎验证的“源码真值”。每个日志宏调用的 line 参数对应日志声明的行号。
// =============================================================================
#include "log_macros.h"

void scan_parser_thread() {
    log_emit_d("INFO", "SCAN_MFP", "scan_parser_thread", "SCAN_PARSER_STATE_JOB")  // 反写行号 0
    log_emit_d("INFO", "SCAN_MFP", "scan_parser_thread", "SCAN_PARSER_STATE_JOB")  // 反写行号 0
}

void scan_parser_host_message_process() {
    log_emit_d("DEBUG", "SCAN_MFP", "scan_parser_host_message_process", "no data")  // 反写行号 0
    log_emit_d("DEBUG", "SCAN_MFP", "scan_parser_host_message_process", "no data")  // 反写行号 0
}

void mode_answer_0x4D_callback_func() {
    log_emit_d("INFO", "SCAN_MFP", "mode_answer_0x4D_callback_func", "PAGE_ON signal  [0==>1] ")  // 反写行号 0
}

void debug_printf_recv_cmd() {
    log_emit_d("INFO", "SCAN_MFP", "debug_printf_recv_cmd", "[808.975] SCAN_ENG ADF=>CTL [9c-57-03-74-7f-]")  // 反写行号 0
}

void mode_answer_0x57_callback_func() {
    log_emit_d("INFO", "SCAN_MFP", "mode_answer_0x57_callback_func", "0x9c 0x57 0x03 0x74 0x7f ")  // 反写行号 0
}
