// =============================================================================
// pcie_data.cpp  —— 反写自 test_data/log.txt（5 处日志调用）
// 用途: 作为匹配引擎验证的“源码真值”。每个日志宏调用的 line 参数对应日志声明的行号。
// =============================================================================
#include "log_macros.h"

void recv_pcie_data_cb() {
    log_emit_e("DEBUG", "recv_pcie_data_cb", "Successfully sent data to USB panel, size: 0")  // 反写行号 0
    log_emit_e("DEBUG", "recv_pcie_data_cb", "Successfully sent data to USB panel, size: 0")  // 反写行号 0
}

void usbd_pack_success() {
    log_emit_e("INFO", "usbd_pack_success", "usbd_pack_success endpoint=0  com=0x83")  // 反写行号 0
    log_emit_e("INFO", "usbd_pack_success", "usbd_pack_success endpoint=0  com=0x82")  // 反写行号 0
}

void mfp_3588_data_proc() {
    log_emit_e("DEBUG", "mfp_3588_data_proc", "Received 3588 data: header=0x02000004, type=4, value=0, res_type=2, data_len=80")  // 反写行号 0
}
