// =============================================================================
// log_macros.h  —— 反写自 test_data/log.txt 的日志宏定义
// 说明: line 参数即日志中声明的源码行号（与日志逐行对应），func 为函数名，
//       module 为模块标签。Format C 额外携带源码文件路径。
// 该头文件为“模拟实现”，可被编译器解析，其 printf 输出与 synthetic_log.txt 逐行一致。
// =============================================================================
#pragma once
#include <cstdio>
#include <cstdarg>

// Format A: [LEVEL][MODULE][line][func]msg
static inline void log_emit_a(const char* level, const char* module, int line, const char* func, const char* fmt, ...) {
    printf("[2026-07-15 10:23:17.372] [10:20:27.064] %-48s - [%s][%s][%d][%s] ", func, level, module, line, func);
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\n");
}
// Format B: [LEVEL]L<line> :msg
static inline void log_emit_b(const char* level, int line, const char* func, const char* fmt, ...) {
    printf("[2026-07-15 10:23:17.372] [10:20:27.064] %-48s - [%s]L%d :", func, level, line);
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\n");
}
// Format C: [DEBUG] <filepath> L<line> func():msg
static inline void log_emit_c(const char* level, const char* filepath, int line, const char* func, const char* fmt, ...) {
    printf("[2026-07-15 10:23:17.372] [   0:21:12.350][%s] %s L%d %s():", level, filepath, line, func);
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\n");
}
// Format D: [LEVEL][MODULE] msg  （无行号）
static inline void log_emit_d(const char* level, const char* module, const char* func, const char* fmt, ...) {
    printf("[2026-07-15 10:23:17.372] [10:20:27.064] %-48s - [%s][%s] ", func, level, module);
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\n");
}
// Format E: [LEVEL] msg  （无模块、无行号）
static inline void log_emit_e(const char* level, const char* func, const char* fmt, ...) {
    printf("[2026-07-15 10:23:17.372] [10:20:27.064] %-48s - [%s] ", func, level);
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\n");
}
// Format F: [LEVEL]<#IPM>[JobID:0] msg
static inline void log_emit_f(const char* level, const char* func, const char* fmt, ...) {
    printf("[2026-07-15 10:23:17.372] [10:20:27.064] %-48s - [%s]<#IPM>[JobID:0] ", func, level);
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\n");
}
// Format G: [LEVEL][timestamp] msg
static inline void log_emit_g(const char* level, const char* func, const char* fmt, ...) {
    printf("[2026-07-15 10:23:17.372] [10:20:27.064] %-48s - [%s][2026-07-15 10:01:46.893] ", func, level);
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\n");
}
