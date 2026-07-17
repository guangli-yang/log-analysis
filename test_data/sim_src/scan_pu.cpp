// =============================================================================
// scan_pu.cpp  —— 反写自 test_data/log.txt（6 处日志调用）
// 用途: 作为匹配引擎验证的“源码真值”。每个日志宏调用的 line 参数对应日志声明的行号。
// =============================================================================
#include "log_macros.h"

void WrapperOutputToStep() {
    log_emit_e("DEBUG", "WrapperOutputToStep", "scan_pu_wrapper WrapperOutputToStep")  // 反写行号 0
}

void sendNext() {
    log_emit_e("DEBUG", "sendNext", "unit:scan_pu send msg done at time:20260715_100146_891")  // 反写行号 0
}

void edge_crop_write() {
    log_emit_f("INFO", "edge_crop_write", "step(edge_crop) is dealing with page -> imgin  : FRONT w 2496 h 3520 s 7488 d 24 f 201")  // 反写行号 0
    log_emit_f("INFO", "edge_crop_write", "step(edge_crop) is dealing with page -> imgout : FRONT w 2480 h 3520 s 7440 d 24 f 201")  // 反写行号 0
}

void releaseFrameResource() {
    log_emit_g("DEBUG", "releaseFrameResource", "scan_pu: FrameResources released, active count: 0")  // 反写行号 0
}

void pipe_core_run_this_step() {
    log_emit_f("INFO", "pipe_core_run_this_step", "EOI from scan_pu_step")  // 反写行号 0
}
