// =============================================================================
// video_pipeline.cpp  —— 反写自 test_data/log.txt（6 处日志调用）
// 用途: 作为匹配引擎验证的“源码真值”。每个日志宏调用的 line 参数对应日志声明的行号。
// =============================================================================
#include "log_macros.h"

void video_pcie_cancel_process() {
    log_emit_b("ERROR", 649, "video_pcie_cancel_process", "[VIDEO] CANCEL")  // 反写行号 649
}

void video_driver_cancel_process() {
    log_emit_b("INFO", 777, "video_driver_cancel_process", "[VIDEO] video cancel request")  // 反写行号 777
}

void video_del_all_page_from_list() {
    log_emit_b("INFO", 78, "video_del_all_page_from_list", "[VIDEO] video page list empty video_pending_list")  // 反写行号 78
    log_emit_b("INFO", 78, "video_del_all_page_from_list", "[VIDEO] video page list empty video_printing_list")  // 反写行号 78
}

void video_free() {
    log_emit_b("INFO", 148, "video_free", "[VIDEO] VDIEO_LASER_CHDEV_FREE OK ret[0]")  // 反写行号 148
}

void video_pcie_band_alloc_suspend() {
    log_emit_b("INFO", 423, "video_pcie_band_alloc_suspend", "[VIDEO] OK")  // 反写行号 423
}
