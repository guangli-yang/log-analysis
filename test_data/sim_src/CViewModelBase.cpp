// =============================================================================
// CViewModelBase.cpp  —— 反写自 test_data/log.txt（6 处日志调用）
// 用途: 作为匹配引擎验证的“源码真值”。每个日志宏调用的 line 参数对应日志声明的行号。
// =============================================================================
#include "log_macros.h"

void DispatchEvent() {
    log_emit_c("DEBUG", "/home/liuxingjin/Rockchip/lp7265v2r1xc_release/panel_hw_ssd2xx/appsrc/ui/panel/main/framework/CViewModelBase.cpp", 137, "DispatchEvent", "START, ui_proc_ev ev_id = 0x03000006(EVT_ID_UI_POWERMGR_AUTO_BACK), ctrl_id = 0x00000000(UI_CTRL_ID_ALL), state_id = 0x00000000(WINDOW_ID_INVALID), item_id = 0x00000000(UI_ITEM_ID_INVALID)")  // 反写行号 137
    log_emit_c("DEBUG", "/home/liuxingjin/Rockchip/lp7265v2r1xc_release/panel_hw_ssd2xx/appsrc/ui/panel/main/framework/CViewModelBase.cpp", 176, "DispatchEvent", "pedk_serv_mgr process start")  // 反写行号 176
    log_emit_c("DEBUG", "/home/liuxingjin/Rockchip/lp7265v2r1xc_release/panel_hw_ssd2xx/appsrc/ui/panel/main/framework/CViewModelBase.cpp", 182, "DispatchEvent", "pedk_serv_mgr process result = 1(EVT_RES_CONTINUE)")  // 反写行号 182
    log_emit_c("DEBUG", "/home/liuxingjin/Rockchip/lp7265v2r1xc_release/panel_hw_ssd2xx/appsrc/ui/panel/main/framework/CViewModelBase.cpp", 192, "DispatchEvent", "fw process")  // 反写行号 192
    log_emit_c("DEBUG", "/home/liuxingjin/Rockchip/lp7265v2r1xc_release/panel_hw_ssd2xx/appsrc/ui/panel/main/framework/CViewModelBase.cpp", 207, "DispatchEvent", "ui_proc_ev top_state = 0x00010001(eWINDOW_ID_MAIN), END")  // 反写行号 207
    log_emit_c("DEBUG", "/home/liuxingjin/Rockchip/lp7265v2r1xc_release/panel_hw_ssd2xx/appsrc/ui/panel/main/framework/CViewModelBase.cpp", 137, "DispatchEvent", "START, ui_proc_ev ev_id = 0x03000001(EVT_ID_UI_INFO_CTRL_START), ctrl_id = 0x00000001(UI_CTRL_ID_MAIN), state_id = 0x00000000(WINDOW_ID_INVALID), item_id = 0x00000000(UI_ITEM_ID_INVALID)")  // 反写行号 137
}
