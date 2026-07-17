// =============================================================================
// 反写 (reverse-write) 测试数据生成器
// -----------------------------------------------------------------------------
// 输入:  test_data/log.txt  （真实日志，作为反写规则来源）
// 输出:  test_data/sim_src/      —— 模拟源码（含完整日志宏逻辑）
//        test_data/sim_src/synthetic_log.txt  —— 由源码“运行”产出的合成日志
//        test_data/sim_src/module_logs/*.json —— 代码检索结果（ground truth）
//        test_data/module_owners.md           —— 模块负责人表
//        test_data/sim_src/validate.mjs       —— 端到端验证脚本
//
// 设计原则:
//  1. 每条日志 = 源码中一次日志宏调用，宏参数中的 line 直接对应日志声明的源码行号
//     （反写自 log.txt），func/module 与日志完全一致。
//  2. 覆盖 7 种真实日志子格式 + 大量边界/异常场景（见 edge_cases）。
//  3. 合成日志 + 模块检索结果 构成可直接喂给匹配引擎验证的闭环。
// =============================================================================

import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = __dirname
const MODULE_LOGS = join(OUT, 'module_logs')
mkdirSync(MODULE_LOGS, { recursive: true })

// ---------------------------------------------------------------------------
// 日志格式常量（与 log.txt 完全一致）
// ---------------------------------------------------------------------------
const WALL = '[2026-07-15 10:23:17.372]'
const UP = '[10:20:27.064]'
const UP_C = '[   0:21:12.350]'
const pad = (s) => (s + ' '.repeat(48)).slice(0, 48)

// 依据格式生成一条日志文本（与 log_macros.h 中的 C 实现严格一致）
function renderLine(s) {
  switch (s.fmt) {
    case 'A': // [LEVEL][MODULE][line][func]msg
      return `${WALL} ${UP} ${pad(s.func)} - [${s.level}][${s.module}][${s.line}][${s.func}]${s.msg}`
    case 'B': // [LEVEL]L<line> :msg
      return `${WALL} ${UP} ${pad(s.func)} - [${s.level}]L${s.line} :${s.msg}`
    case 'C': // [DEBUG] <filepath> L<line> func():msg  （无函数列）
      return `${WALL} ${UP_C}[${s.level}] ${s.path} L${s.line} ${s.func}():${s.msg}`
    case 'D': // [LEVEL][MODULE] msg  （无行号）
      return `${WALL} ${UP} ${pad(s.func)} - [${s.level}][${s.module}] ${s.msg}`
    case 'E': // [LEVEL] msg  （无模块、无行号）
      return `${WALL} ${UP} ${pad(s.func)} - [${s.level}] ${s.msg}`
    case 'F': // [LEVEL]<#IPM>[JobID:0] msg
      return `${WALL} ${UP} ${pad(s.func)} - [${s.level}]<#IPM>[JobID:0] ${s.msg}`
    case 'G': // [LEVEL][timestamp] msg
      return `${WALL} ${UP} ${pad(s.func)} - [${s.level}][2026-07-15 10:01:46.893] ${s.msg}`
    default:
      throw new Error('unknown fmt ' + s.fmt)
  }
}

// ---------------------------------------------------------------------------
// 模块元数据（用于负责人表）
// ---------------------------------------------------------------------------
const MODULES = {
  IPSLIB:      { name: '任务调度 (Job/IPSLIB)',       owner: '张伟', domain: '任务管线、作业生命周期与状态机' },
  SCAN_MFP:    { name: '扫描解析 (SCAN_MFP)',        owner: '李娜', domain: '扫描解析线程、命令回调与状态机' },
  PRINT:       { name: '打印事件 (PRINT)',           owner: '王芳', domain: '打印事件派发与中继读取' },
  VIDEO:       { name: '视频流水线 (VIDEO)',         owner: '刘强', domain: '视频取消、页列表管理与带宽分配' },
  SCAN_APP:    { name: '扫描应用 IPC (SCAN_APP)',    owner: '陈静', domain: '扫描应用 IPC 通信与指令处理' },
  IPM:         { name: '图像处理 (IPM)',             owner: '赵磊', domain: '图像流水线 step、帧资源与校准' },
  UI:          { name: 'UI 事件框架 (CViewModelBase)', owner: '孙宇', domain: 'UI 事件分发框架与窗口状态' },
  PCIE:        { name: 'PCIE 数据收发 (PCIE)',       owner: '周敏', domain: 'PCIE 数据收发与 USB 封装' },
  EDGE:        { name: '边界/异常测试 (EDGE)',       owner: '测试组', domain: '覆盖边界条件、异常与极端场景' },
}

// ---------------------------------------------------------------------------
// 站点定义：每条 = 源码中一次日志宏调用，并对应一条日志 + 一个检索候选
//   fmt: 日志子格式; line: 反写行号(无行号填0); func/module/level/msg: 日志内容
//   keywords: 提供给检索结果的候选关键词; owner: 模块; expect: 'match'|'issue'
// ---------------------------------------------------------------------------
const SITES = [
  // ===== job_manager.cpp (Format A / IPSLIB) =====
  { id: 'j1', file: 'job_manager.cpp', fmt: 'A', level: 'INFO', module: 'IPSLIB', line: 1192, func: 'jobRun', msg: 'job->namePipeline[SNIFFER]', keywords: ['namepipeline'], owner: 'IPSLIB' },
  { id: 'j2', file: 'job_manager.cpp', fmt: 'A', level: 'INFO', module: 'IPSLIB', line: 1201, func: 'jobRun', msg: 'Update job id[284] ', keywords: ['update', 'job', 'id'], owner: 'IPSLIB' },
  { id: 'j3', file: 'job_manager.cpp', fmt: 'A', level: 'INFO', module: 'IPSLIB', line: 1215, func: 'jobRun', msg: 'Job Run status [RUN] ', keywords: ['job', 'run', 'status'], owner: 'IPSLIB' },

  // ===== scan_mfp.cpp (Format D / SCAN_MFP, 无行号) =====
  { id: 's1', file: 'scan_mfp.cpp', fmt: 'D', level: 'INFO', module: 'SCAN_MFP', line: 0, func: 'scan_parser_thread', msg: 'SCAN_PARSER_STATE_JOB', keywords: ['scan_parser_state_job'], owner: 'SCAN_MFP' },
  { id: 's2', file: 'scan_mfp.cpp', fmt: 'D', level: 'DEBUG', module: 'SCAN_MFP', line: 0, func: 'scan_parser_host_message_process', msg: 'no data', keywords: ['no', 'data'], owner: 'SCAN_MFP' },
  { id: 's3', file: 'scan_mfp.cpp', fmt: 'D', level: 'INFO', module: 'SCAN_MFP', line: 0, func: 'scan_parser_thread', msg: 'SCAN_PARSER_STATE_JOB', keywords: ['scan_parser_state_job'], owner: 'SCAN_MFP' },
  { id: 's4', file: 'scan_mfp.cpp', fmt: 'D', level: 'INFO', module: 'SCAN_MFP', line: 0, func: 'mode_answer_0x4D_callback_func', msg: 'PAGE_ON signal  [0==>1] ', keywords: ['page_on', 'signal'], owner: 'SCAN_MFP' },
  { id: 's5', file: 'scan_mfp.cpp', fmt: 'D', level: 'INFO', module: 'SCAN_MFP', line: 0, func: 'debug_printf_recv_cmd', msg: '[808.975] SCAN_ENG ADF=>CTL [9c-57-03-74-7f-]', keywords: ['scan_eng', 'adf'], owner: 'SCAN_MFP' },
  { id: 's6', file: 'scan_mfp.cpp', fmt: 'D', level: 'INFO', module: 'SCAN_MFP', line: 0, func: 'mode_answer_0x57_callback_func', msg: '0x9c 0x57 0x03 0x74 0x7f ', keywords: ['0x9c', '0x57'], owner: 'SCAN_MFP' },
  { id: 's7', file: 'scan_mfp.cpp', fmt: 'D', level: 'DEBUG', module: 'SCAN_MFP', line: 0, func: 'scan_parser_host_message_process', msg: 'no data', keywords: ['no', 'data'], owner: 'SCAN_MFP' },

  // ===== print_event.cpp (Format B) =====
  { id: 'p1', file: 'print_event.cpp', fmt: 'B', level: 'INFO', module: '', line: 335, func: 'print_info_event_outside_process', msg: 'Receive event head [285409282] !!!', keywords: ['receive', 'event', 'head'], owner: 'PRINT' },
  { id: 'p2', file: 'print_event.cpp', fmt: 'B', level: 'INFO', module: '', line: 796, func: 'print_relay_send_page_to_relay_read', msg: 'send page 72 to read', keywords: ['send', 'page', 'read'], owner: 'PRINT' },

  // ===== pcie_data.cpp (Format E, 无行号) =====
  { id: 'c1', file: 'pcie_data.cpp', fmt: 'E', level: 'DEBUG', module: '', line: 0, func: 'recv_pcie_data_cb', msg: 'Successfully sent data to USB panel, size: 0', keywords: ['successfully', 'sent', 'data', 'usb', 'panel'], owner: 'PCIE' },
  { id: 'c2', file: 'pcie_data.cpp', fmt: 'E', level: 'INFO', module: '', line: 0, func: 'usbd_pack_success', msg: 'usbd_pack_success endpoint=0  com=0x83', keywords: ['usbd_pack_success', 'endpoint'], owner: 'PCIE' },
  { id: 'c3', file: 'pcie_data.cpp', fmt: 'E', level: 'INFO', module: '', line: 0, func: 'usbd_pack_success', msg: 'usbd_pack_success endpoint=0  com=0x82', keywords: ['usbd_pack_success', 'endpoint'], owner: 'PCIE' },
  { id: 'c4', file: 'pcie_data.cpp', fmt: 'E', level: 'DEBUG', module: '', line: 0, func: 'mfp_3588_data_proc', msg: 'Received 3588 data: header=0x02000004, type=4, value=0, res_type=2, data_len=80', keywords: ['received', '3588', 'data'], owner: 'PCIE' },
  { id: 'c5', file: 'pcie_data.cpp', fmt: 'E', level: 'DEBUG', module: '', line: 0, func: 'recv_pcie_data_cb', msg: 'Successfully sent data to USB panel, size: 0', keywords: ['successfully', 'sent', 'data', 'usb', 'panel'], owner: 'PCIE' },

  // ===== video_pipeline.cpp (Format B / VIDEO) =====
  { id: 'v1', file: 'video_pipeline.cpp', fmt: 'B', level: 'ERROR', module: '', line: 649, func: 'video_pcie_cancel_process', msg: '[VIDEO] CANCEL', keywords: ['cancel'], owner: 'VIDEO' },
  { id: 'v2', file: 'video_pipeline.cpp', fmt: 'B', level: 'INFO', module: '', line: 777, func: 'video_driver_cancel_process', msg: '[VIDEO] video cancel request', keywords: ['video', 'cancel', 'request'], owner: 'VIDEO' },
  { id: 'v3', file: 'video_pipeline.cpp', fmt: 'B', level: 'INFO', module: '', line: 78, func: 'video_del_all_page_from_list', msg: '[VIDEO] video page list empty video_pending_list', keywords: ['video', 'page', 'list', 'empty'], owner: 'VIDEO' },
  { id: 'v4', file: 'video_pipeline.cpp', fmt: 'B', level: 'INFO', module: '', line: 78, func: 'video_del_all_page_from_list', msg: '[VIDEO] video page list empty video_printing_list', keywords: ['video', 'page', 'list', 'empty'], owner: 'VIDEO' },
  { id: 'v5', file: 'video_pipeline.cpp', fmt: 'B', level: 'INFO', module: '', line: 148, func: 'video_free', msg: '[VIDEO] VDIEO_LASER_CHDEV_FREE OK ret[0]', keywords: ['laser', 'chdev', 'free'], owner: 'VIDEO' },
  { id: 'v6', file: 'video_pipeline.cpp', fmt: 'B', level: 'INFO', module: '', line: 423, func: 'video_pcie_band_alloc_suspend', msg: '[VIDEO] OK', keywords: ['ok'], owner: 'VIDEO' },

  // ===== CViewModelBase.cpp (Format C / UI) =====
  { id: 'm1', file: 'CViewModelBase.cpp', fmt: 'C', level: 'DEBUG', module: '', line: 137, func: 'DispatchEvent', path: '/home/liuxingjin/Rockchip/lp7265v2r1xc_release/panel_hw_ssd2xx/appsrc/ui/panel/main/framework/CViewModelBase.cpp', msg: 'START, ui_proc_ev ev_id = 0x03000006(EVT_ID_UI_POWERMGR_AUTO_BACK), ctrl_id = 0x00000000(UI_CTRL_ID_ALL), state_id = 0x00000000(WINDOW_ID_INVALID), item_id = 0x00000000(UI_ITEM_ID_INVALID)', keywords: ['dispatchevent', 'ui_proc_ev'], owner: 'UI' },
  { id: 'm2', file: 'CViewModelBase.cpp', fmt: 'C', level: 'DEBUG', module: '', line: 176, func: 'DispatchEvent', path: '/home/liuxingjin/Rockchip/lp7265v2r1xc_release/panel_hw_ssd2xx/appsrc/ui/panel/main/framework/CViewModelBase.cpp', msg: 'pedk_serv_mgr process start', keywords: ['pedk_serv_mgr', 'process', 'start'], owner: 'UI' },
  { id: 'm3', file: 'CViewModelBase.cpp', fmt: 'C', level: 'DEBUG', module: '', line: 182, func: 'DispatchEvent', path: '/home/liuxingjin/Rockchip/lp7265v2r1xc_release/panel_hw_ssd2xx/appsrc/ui/panel/main/framework/CViewModelBase.cpp', msg: 'pedk_serv_mgr process result = 1(EVT_RES_CONTINUE)', keywords: ['pedk_serv_mgr', 'result'], owner: 'UI' },
  { id: 'm4', file: 'CViewModelBase.cpp', fmt: 'C', level: 'DEBUG', module: '', line: 192, func: 'DispatchEvent', path: '/home/liuxingjin/Rockchip/lp7265v2r1xc_release/panel_hw_ssd2xx/appsrc/ui/panel/main/framework/CViewModelBase.cpp', msg: 'fw process', keywords: ['fw', 'process'], owner: 'UI' },
  { id: 'm5', file: 'CViewModelBase.cpp', fmt: 'C', level: 'DEBUG', module: '', line: 207, func: 'DispatchEvent', path: '/home/liuxingjin/Rockchip/lp7265v2r1xc_release/panel_hw_ssd2xx/appsrc/ui/panel/main/framework/CViewModelBase.cpp', msg: 'ui_proc_ev top_state = 0x00010001(eWINDOW_ID_MAIN), END', keywords: ['ui_proc_ev', 'top_state'], owner: 'UI' },
  { id: 'm6', file: 'CViewModelBase.cpp', fmt: 'C', level: 'DEBUG', module: '', line: 137, func: 'DispatchEvent', path: '/home/liuxingjin/Rockchip/lp7265v2r1xc_release/panel_hw_ssd2xx/appsrc/ui/panel/main/framework/CViewModelBase.cpp', msg: 'START, ui_proc_ev ev_id = 0x03000001(EVT_ID_UI_INFO_CTRL_START), ctrl_id = 0x00000001(UI_CTRL_ID_MAIN), state_id = 0x00000000(WINDOW_ID_INVALID), item_id = 0x00000000(UI_ITEM_ID_INVALID)', keywords: ['dispatchevent', 'ui_proc_ev'], owner: 'UI' },

  // ===== scan_pu.cpp (Format E/F/G / IPM) =====
  { id: 'u1', file: 'scan_pu.cpp', fmt: 'E', level: 'DEBUG', module: '', line: 0, func: 'WrapperOutputToStep', msg: 'scan_pu_wrapper WrapperOutputToStep', keywords: ['scan_pu_wrapper', 'wrapperoutputtostep'], owner: 'IPM' },
  { id: 'u2', file: 'scan_pu.cpp', fmt: 'E', level: 'DEBUG', module: '', line: 0, func: 'sendNext', msg: 'unit:scan_pu send msg done at time:20260715_100146_891', keywords: ['unit:scan_pu', 'send', 'msg', 'done'], owner: 'IPM' },
  { id: 'u3', file: 'scan_pu.cpp', fmt: 'F', level: 'INFO', module: '', line: 0, func: 'edge_crop_write', msg: 'step(edge_crop) is dealing with page -> imgin  : FRONT w 2496 h 3520 s 7488 d 24 f 201', keywords: ['step(edge_crop)', 'imgin', 'front'], owner: 'IPM' },
  { id: 'u4', file: 'scan_pu.cpp', fmt: 'F', level: 'INFO', module: '', line: 0, func: 'edge_crop_write', msg: 'step(edge_crop) is dealing with page -> imgout : FRONT w 2480 h 3520 s 7440 d 24 f 201', keywords: ['step(edge_crop)', 'imgout', 'front'], owner: 'IPM' },
  { id: 'u5', file: 'scan_pu.cpp', fmt: 'G', level: 'DEBUG', module: '', line: 0, func: 'releaseFrameResource', msg: 'scan_pu: FrameResources released, active count: 0', keywords: ['scan_pu:', 'frameresources', 'released'], owner: 'IPM' },
  { id: 'u6', file: 'scan_pu.cpp', fmt: 'F', level: 'INFO', module: '', line: 0, func: 'pipe_core_run_this_step', msg: 'EOI from scan_pu_step', keywords: ['eoi', 'scan_pu_step'], owner: 'IPM' },

  // ===== scan_app_ipc.cpp (Format D / SCAN_APP) =====
  { id: 'a1', file: 'scan_app_ipc.cpp', fmt: 'D', level: 'INFO', module: 'SCAN_APP', line: 0, func: 'ipc_receive_handler', msg: 'bio_get_buffer.len :256 msg_type 112 ', keywords: ['bio_get_buffer.len', 'msg_type', '112'], owner: 'SCAN_APP' },
  { id: 'a2', file: 'scan_app_ipc.cpp', fmt: 'D', level: 'INFO', module: 'SCAN_APP', line: 0, func: 'ipc_receive_handler', msg: 'bio_get_buffer.len :256 msg_type 115 ', keywords: ['bio_get_buffer.len', 'msg_type', '115'], owner: 'SCAN_APP' },
  { id: 'a3', file: 'scan_app_ipc.cpp', fmt: 'D', level: 'INFO', module: 'SCAN_APP', line: 0, func: 'ScanMgrThread', msg: 'msg from pcie: 112 256', keywords: ['msg', 'from', 'pcie', '112'], owner: 'SCAN_APP' },
  { id: 'a4', file: 'scan_app_ipc.cpp', fmt: 'D', level: 'INFO', module: 'SCAN_APP', line: 0, func: 'ScanMgrCommandProcess', msg: 'recv copy calc data 112', keywords: ['recv', 'copy', 'calc', 'data', '112'], owner: 'SCAN_APP' },
  { id: 'a5', file: 'scan_app_ipc.cpp', fmt: 'F', level: 'INFO', module: '', line: 0, func: 'image_processing_manager_scan_thread', msg: 'ipm recv Y cali data', keywords: ['ipm', 'recv', 'cali', 'data'], owner: 'IPM' },
  { id: 'a6', file: 'scan_app_ipc.cpp', fmt: 'D', level: 'INFO', module: 'SCAN_APP', line: 0, func: 'ScanMgrThread', msg: 'msg from pcie: 115 256', keywords: ['msg', 'from', 'pcie', '115'], owner: 'SCAN_APP' },
  { id: 'a7', file: 'scan_app_ipc.cpp', fmt: 'D', level: 'INFO', module: 'SCAN_APP', line: 0, func: 'ScanMgrCommandProcess', msg: 'recv copy calc data 115', keywords: ['recv', 'copy', 'calc', 'data', '115'], owner: 'SCAN_APP' },
  { id: 'a8', file: 'scan_app_ipc.cpp', fmt: 'F', level: 'INFO', module: '', line: 0, func: 'image_processing_manager_scan_thread', msg: 'ipm recv K cali data', keywords: ['ipm', 'recv', 'cali', 'data'], owner: 'IPM' },

  // ===== edge_cases.cpp (边界/异常场景，刻意暴露潜在问题) =====
  { id: 'e1', file: 'edge_cases.cpp', fmt: 'B', level: 'INFO', module: '', line: 777, func: 'retryScheduler', msg: 'retry count [3] remaining', keywords: ['retry', 'count', 'remaining'], owner: 'EDGE', expect: 'issue', note: '消息含空格前缀的 [3]，会优先于 L777 被误判为行号，导致该行无法命中 line=777 候选' },
  { id: 'e2', file: 'edge_cases.cpp', fmt: 'B', level: 'INFO', module: '', line: 1234567, func: 'bigLineLogger', msg: 'seven digit line number', keywords: ['seven', 'digit', 'line'], owner: 'EDGE', expect: 'match', note: '7 位行号被正则 \\d{1,6} 丢弃，但被关键字兜底命中（隐患：行号信息丢失，多行共享关键字时会误并）' },
  { id: 'e3', file: 'edge_cases.cpp', fmt: 'B', level: 'INFO', module: '', line: 555, func: 'unicodeLogger', msg: '处理完成 状态正常 重试', keywords: ['处理完成', '状态正常'], owner: 'EDGE', expect: 'match', note: 'Unicode 关键字匹配' },
  { id: 'e4', file: 'edge_cases.cpp', fmt: 'B', level: 'INFO', module: '', line: 666, func: 'longLineLogger', msg: 'X'.repeat(2000) + ' marker_end', keywords: ['marker_end'], owner: 'EDGE', expect: 'match', note: '超长行（2000+ 字符）' },
  { id: 'e5', file: 'edge_cases.cpp', fmt: 'E', level: 'ERROR', module: '', line: 0, func: 'LOGE', msg: 'critical failure reported', keywords: ['critical', 'failure'], owner: 'EDGE', expect: 'match', note: '函数名 LOGE 应被排除为 funcName（仅关键字匹配）' },
  { id: 'e6', file: 'edge_cases.cpp', fmt: 'D', level: 'TRACE', module: 'EDGE', line: 0, func: 'traceFunc', msg: 'trace point alpha', keywords: ['trace', 'point', 'alpha'], owner: 'EDGE', expect: 'match', note: 'TRACE 级别' },
  { id: 'e7', file: 'edge_cases.cpp', fmt: 'B', level: 'FATAL', module: '', line: 888, func: 'fatalHandler', msg: 'system halt [0xffff]', keywords: ['system', 'halt'], owner: 'EDGE', expect: 'match', note: 'FATAL 级别 + 十六进制' },
  { id: 'e8', file: 'edge_cases.cpp', fmt: 'C', level: 'DEBUG', module: '', line: 137, func: 'DispatchEvent', path: '/proj/ui/PanelView.cpp', msg: 'panel view dispatch START', keywords: ['dispatchevent', 'panel', 'view'], owner: 'UI', expect: 'match', note: '跨文件同行号 137（CViewModelBase vs PanelView），按文件名消歧' },
  { id: 'e9', file: 'edge_cases.cpp', fmt: 'E', level: 'WARN', module: '', line: 0, func: 'warnFunc', msg: 'low memory warning [5]', keywords: ['low', 'memory', 'warning'], owner: 'EDGE', expect: 'issue', note: '无行号日志消息含空格前缀 [5]，被误判为行号 5，阻断 Stage B 关键字匹配' },

  // ===== edge_cases_ts.ts (TS 风格日志) =====
  { id: 't1', file: 'edge_cases_ts.ts', fmt: 'E', level: 'INFO', module: '', line: 0, func: 'sendData', msg: 'dispatch event sent [0x12]', keywords: ['dispatch', 'event', 'sent'], owner: 'EDGE', expect: 'match', note: 'TS 风格日志' },
  { id: 't2', file: 'edge_cases_ts.ts', fmt: 'B', level: 'DEBUG', module: '', line: 909, func: 'fetchConfig', msg: 'config loaded [ok]', keywords: ['config', 'loaded'], owner: 'EDGE', expect: 'match', note: 'TS L 行号' },
]

// ---------------------------------------------------------------------------
// 1) 生成合成日志（顺序与站点一致），并记录 site.id -> 行号
// ---------------------------------------------------------------------------
const synLines = []
const lineOf = {}
// 额外放入几条“噪声”行，验证解析鲁棒性（无候选应命中）
synLines.push('') // 空行
synLines.push(`${WALL} ${UP} 仅仅一个时间戳，无标签无函数 `)
synLines.push('') // 空行
for (const s of SITES) {
  synLines.push(renderLine(s))
  lineOf[s.id] = synLines.length // 1-based 行号
}
writeFileSync(join(OUT, 'synthetic_log.txt'), synLines.join('\n') + '\n', 'utf8')

// ---------------------------------------------------------------------------
// 2) 生成模拟源码（按文件分组，每个 func 一个函数，内部多次调用日志宏）
// ---------------------------------------------------------------------------
const LOG_MACROS_H = `// =============================================================================
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
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\\n");
}
// Format B: [LEVEL]L<line> :msg
static inline void log_emit_b(const char* level, int line, const char* func, const char* fmt, ...) {
    printf("[2026-07-15 10:23:17.372] [10:20:27.064] %-48s - [%s]L%d :", func, level, line);
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\\n");
}
// Format C: [DEBUG] <filepath> L<line> func():msg
static inline void log_emit_c(const char* level, const char* filepath, int line, const char* func, const char* fmt, ...) {
    printf("[2026-07-15 10:23:17.372] [   0:21:12.350][%s] %s L%d %s():", level, filepath, line, func);
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\\n");
}
// Format D: [LEVEL][MODULE] msg  （无行号）
static inline void log_emit_d(const char* level, const char* module, const char* func, const char* fmt, ...) {
    printf("[2026-07-15 10:23:17.372] [10:20:27.064] %-48s - [%s][%s] ", func, level, module);
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\\n");
}
// Format E: [LEVEL] msg  （无模块、无行号）
static inline void log_emit_e(const char* level, const char* func, const char* fmt, ...) {
    printf("[2026-07-15 10:23:17.372] [10:20:27.064] %-48s - [%s] ", func, level);
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\\n");
}
// Format F: [LEVEL]<#IPM>[JobID:0] msg
static inline void log_emit_f(const char* level, const char* func, const char* fmt, ...) {
    printf("[2026-07-15 10:23:17.372] [10:20:27.064] %-48s - [%s]<#IPM>[JobID:0] ", func, level);
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\\n");
}
// Format G: [LEVEL][timestamp] msg
static inline void log_emit_g(const char* level, const char* func, const char* fmt, ...) {
    printf("[2026-07-15 10:23:17.372] [10:20:27.064] %-48s - [%s][2026-07-15 10:01:46.893] ", func, level);
    va_list ap; va_start(ap, fmt); vprintf(fmt, ap); va_end(ap); printf("\\n");
}
`
writeFileSync(join(OUT, 'log_macros.h'), LOG_MACROS_H, 'utf8')

// 按文件分组
const byFile = {}
for (const s of SITES) (byFile[s.file] ||= []).push(s)

for (const [file, sites] of Object.entries(byFile)) {
  const isTS = file.endsWith('.ts')
  const lines = []
  lines.push(`// =============================================================================`)
  lines.push(`// ${file}  —— 反写自 test_data/log.txt（${sites.length} 处日志调用）`)
  lines.push(`// 用途: 作为匹配引擎验证的“源码真值”。每个日志宏调用的 line 参数对应日志声明的行号。`)
  lines.push(`// =============================================================================`)
  lines.push(isTS ? `import { logInfo, logDebug, logError } from './ts_log'` : `#include "log_macros.h"`)
  lines.push('')

  // 按 func 分组，一个函数内多次调用
  const byFunc = {}
  for (const s of sites) (byFunc[s.func] ||= []).push(s)

  for (const [func, calls] of Object.entries(byFunc)) {
    if (isTS) {
      lines.push(`export function ${func}(): void {`)
      for (const s of calls) {
        const lvl = s.level === 'DEBUG' ? 'logDebug' : (s.level === 'ERROR' ? 'logError' : 'logInfo')
        lines.push(`  ${lvl}(${s.line}, "${func}", "${s.msg.replace(/"/g, '\\"')}")  // 反写行号 ${s.line}`)
      }
      lines.push(`}`)
    } else {
      lines.push(`void ${func}() {`)
      for (const s of calls) {
        lines.push(`    ${emitCall(s)}  // 反写行号 ${s.line}`)
      }
      lines.push(`}`)
    }
    lines.push('')
  }
  writeFileSync(join(OUT, file), lines.join('\n'), 'utf8')
}

function emitCall(s) {
  const m = JSON.stringify(s.msg)
  switch (s.fmt) {
    case 'A': return `log_emit_a("${s.level}", "${s.module}", ${s.line}, "${s.func}", ${m})`
    case 'B': return `log_emit_b("${s.level}", ${s.line}, "${s.func}", ${m})`
    case 'C': return `log_emit_c("${s.level}", "${s.path}", ${s.line}, "${s.func}", ${m})`
    case 'D': return `log_emit_d("${s.level}", "${s.module}", "${s.func}", ${m})`
    case 'E': return `log_emit_e("${s.level}", "${s.func}", ${m})`
    case 'F': return `log_emit_f("${s.level}", "${s.func}", ${m})`
    case 'G': return `log_emit_g("${s.level}", "${s.func}", ${m})`
  }
}

// TS 辅助日志模块
const TS_LOG = `// ts_log.ts —— TS 风格日志实现（与 synthetic_log.txt 的 Format B/E 一致）
export function logInfo(line: number, func: string, msg: string): void {
  console.log(\`[2026-07-15 10:23:17.372] [10:20:27.064] \${func.padEnd(48)} - [INFO]L\${line} :\${msg}\`)
}
export function logDebug(line: number, func: string, msg: string): void {
  console.log(\`[2026-07-15 10:23:17.372] [10:20:27.064] \${func.padEnd(48)} - [DEBUG]L\${line} :\${msg}\`)
}
export function logError(line: number, func: string, msg: string): void {
  console.log(\`[2026-07-15 10:23:17.372] [10:20:27.064] \${func.padEnd(48)} - [ERROR] \${msg}\`)
}
`
writeFileSync(join(OUT, 'ts_log.ts'), TS_LOG, 'utf8')

// ---------------------------------------------------------------------------
// 3) 生成模块检索结果 JSON（ground truth）：每个文件一个 codeSearchResults
//    去重键 = 代码位置 `${fileName}#${line}#${func}`：
//      同一代码位置（如 scan_parser_thread 两次、usbd_pack_success 两次、DispatchEvent@137
//      两次、ipc_receive_handler 112/115）合并为「一个候选」，对应真实代码检索产物；
//      该候选的关键词取所有成员消息的【交集】，确保其命中该位置产生的【每一行】日志。
//    同时构建期望表 expectedById（候选 id -> 该代码位置对应的所有日志行号）。
// ---------------------------------------------------------------------------
const fileNameOf = (s) => (s.fmt === 'C' ? s.path.split('/').pop() : s.file)
const locKey = (s) => `${fileNameOf(s)}#${s.line}#${s.func}`
const intersect = (arrs) => {
  if (arrs.length === 0) return []
  let set = new Set(arrs[0])
  for (let i = 1; i < arrs.length; i++) {
    const s2 = new Set(arrs[i])
    set = new Set([...set].filter((x) => s2.has(x)))
  }
  return [...set]
}
const expectedById = {}
const metaById = {}

for (const [file, sites] of Object.entries(byFile)) {
  const merged = new Map()
  for (const s of sites) {
    const key = locKey(s)
    if (!merged.has(key)) {
      merged.set(key, { sites: [s], id: s.id })
      metaById[s.id] = { expect: s.expect || 'match', note: s.note || '', file: s.file, func: s.func, line: s.line }
    } else {
      merged.get(key).sites.push(s)
    }
  }
  const results = []
  for (const { sites: grp, id } of merged.values()) {
    const first = grp[0]
    const candidate = {
      id,
      codeFile: { fileName: fileNameOf(first) },
      line: first.line,
      functionName: first.func,
      matchedText: grp.map((g) => g.msg).join(' | '),
      keywords: intersect(grp.map((g) => g.keywords)),
      level: first.level,
    }
    results.push(candidate)
    expectedById[id] = grp.map((g) => lineOf[g.id])
  }
  writeFileSync(join(MODULE_LOGS, file.replace(/\.(cpp|ts)$/, '.json')),
    JSON.stringify({ file, codeSearchResults: results }, null, 2), 'utf8')
}

// ---------------------------------------------------------------------------
// 4) 生成模块负责人表
// ---------------------------------------------------------------------------
let md = `# 模块负责人表（Module Owners）

> 本表由 \`test_data/log.txt\` 反写生成，用于问题追踪与归属。每个模块对应一组模拟源码
> （位于 \`test_data/sim_src/\`）与代码检索结果（\`test_data/sim_src/module_logs/\`）。

| 模块标识 | 模块名称 | 负责人 | 负责领域 | 典型日志格式 | 源码文件 |
|----------|----------|--------|----------|--------------|----------|
`
for (const [key, m] of Object.entries(MODULES)) {
  const sampleFmt = {
    IPSLIB: 'A: [INFO][IPSLIB][1192][jobRun]...',
    SCAN_MFP: 'D: scan_parser_thread - [INFO][SCAN_MFP] ...',
    PRINT: 'B: print_info_event_outside_process - [INFO]L335 :...',
    VIDEO: 'B: video_free - [INFO]L148 :[VIDEO] ...',
    SCAN_APP: 'D: ScanMgrThread - [INFO][SCAN_APP] ...',
    IPM: 'F: edge_crop_write - [INFO]<#IPM>[JobID:0] ...',
    UI: 'C: CViewModelBase.cpp L137 DispatchEvent():...',
    PCIE: 'E: recv_pcie_data_cb - [DEBUG] ...',
    EDGE: 'A/B/C/D/E/F/G 混合 + 异常',
  }[key]
  const srcFile = Object.keys(byFile).find((f) => (byFile[f][0]?.owner === key)) || 'edge_cases.cpp'
  md += `| ${key} | ${m.name} | ${m.owner} | ${m.domain} | ${sampleFmt} | ${srcFile} |\n`
}
md += `
## 说明
- **归属原则**：日志中的模块标签（如 \`[IPSLIB]\`、\`[SCAN_MFP]\`、\`[SCAN_APP]\`）与源码文件一一对应。
- **无标签模块**：\`print_event / video_pipeline / pcie_data / scan_pu / CViewModelBase\` 通过函数名与文件路径（Format B/C）识别，未带方括号模块标签。
- **IPM 跨文件**：\`edge_crop_write\`、\`image_processing_manager_scan_thread\` 等既出现在 \`<#IPM>\` 流水线上下文，也关联扫描应用，统一归 IPM。
- **EDGE**：边界/异常测试模块，由测试组维护，用于持续暴露匹配引擎的潜在问题。
`
writeFileSync(join(__dirname, '..', 'module_owners.md'), md, 'utf8')

// ---------------------------------------------------------------------------
// 5) 写出验证脚本所需的期望表（按候选 id 主键）
// ---------------------------------------------------------------------------
writeFileSync(join(OUT, '_sites.json'), JSON.stringify({ sites: SITES, lineOf }, null, 2), 'utf8')
writeFileSync(join(OUT, '_expected.json'), JSON.stringify({ expectedById, metaById }, null, 2), 'utf8')

console.log(`生成完成: ${SITES.length} 个站点, ${Object.keys(byFile).length} 个源码文件, 合成日志 ${synLines.length} 行`)
