// =============================================================================
// print_event.cpp  —— 反写自 test_data/log.txt（2 处日志调用）
// 用途: 作为匹配引擎验证的“源码真值”。每个日志宏调用的 line 参数对应日志声明的行号。
// =============================================================================
#include "log_macros.h"

void print_info_event_outside_process() {
    log_emit_b("INFO", 335, "print_info_event_outside_process", "Receive event head [285409282] !!!")  // 反写行号 335
}

void print_relay_send_page_to_relay_read() {
    log_emit_b("INFO", 796, "print_relay_send_page_to_relay_read", "send page 72 to read")  // 反写行号 796
}
