// =============================================================================
// scan_app_ipc.cpp  —— 反写自 test_data/log.txt（8 处日志调用）
// 用途: 作为匹配引擎验证的“源码真值”。每个日志宏调用的 line 参数对应日志声明的行号。
// =============================================================================
#include "log_macros.h"

void ipc_receive_handler() {
    log_emit_d("INFO", "SCAN_APP", "ipc_receive_handler", "bio_get_buffer.len :256 msg_type 112 ")  // 反写行号 0
    log_emit_d("INFO", "SCAN_APP", "ipc_receive_handler", "bio_get_buffer.len :256 msg_type 115 ")  // 反写行号 0
}

void ScanMgrThread() {
    log_emit_d("INFO", "SCAN_APP", "ScanMgrThread", "msg from pcie: 112 256")  // 反写行号 0
    log_emit_d("INFO", "SCAN_APP", "ScanMgrThread", "msg from pcie: 115 256")  // 反写行号 0
}

void ScanMgrCommandProcess() {
    log_emit_d("INFO", "SCAN_APP", "ScanMgrCommandProcess", "recv copy calc data 112")  // 反写行号 0
    log_emit_d("INFO", "SCAN_APP", "ScanMgrCommandProcess", "recv copy calc data 115")  // 反写行号 0
}

void image_processing_manager_scan_thread() {
    log_emit_f("INFO", "image_processing_manager_scan_thread", "ipm recv Y cali data")  // 反写行号 0
    log_emit_f("INFO", "image_processing_manager_scan_thread", "ipm recv K cali data")  // 反写行号 0
}
