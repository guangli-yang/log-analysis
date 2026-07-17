# 模块负责人表（Module Owners）

> 本表由 `test_data/log.txt` 反写生成，用于问题追踪与归属。每个模块对应一组模拟源码
> （位于 `test_data/sim_src/`）与代码检索结果（`test_data/sim_src/module_logs/`）。

| 模块标识 | 模块名称 | 负责人 | 负责领域 | 典型日志格式 | 源码文件 |
|----------|----------|--------|----------|--------------|----------|
| IPSLIB | 任务调度 (Job/IPSLIB) | 张伟 | 任务管线、作业生命周期与状态机 | A: [INFO][IPSLIB][1192][jobRun]... | job_manager.cpp |
| SCAN_MFP | 扫描解析 (SCAN_MFP) | 李娜 | 扫描解析线程、命令回调与状态机 | D: scan_parser_thread - [INFO][SCAN_MFP] ... | scan_mfp.cpp |
| PRINT | 打印事件 (PRINT) | 王芳 | 打印事件派发与中继读取 | B: print_info_event_outside_process - [INFO]L335 :... | print_event.cpp |
| VIDEO | 视频流水线 (VIDEO) | 刘强 | 视频取消、页列表管理与带宽分配 | B: video_free - [INFO]L148 :[VIDEO] ... | video_pipeline.cpp |
| SCAN_APP | 扫描应用 IPC (SCAN_APP) | 陈静 | 扫描应用 IPC 通信与指令处理 | D: ScanMgrThread - [INFO][SCAN_APP] ... | scan_app_ipc.cpp |
| IPM | 图像处理 (IPM) | 赵磊 | 图像流水线 step、帧资源与校准 | F: edge_crop_write - [INFO]<#IPM>[JobID:0] ... | scan_pu.cpp |
| UI | UI 事件框架 (CViewModelBase) | 孙宇 | UI 事件分发框架与窗口状态 | C: CViewModelBase.cpp L137 DispatchEvent():... | CViewModelBase.cpp |
| PCIE | PCIE 数据收发 (PCIE) | 周敏 | PCIE 数据收发与 USB 封装 | E: recv_pcie_data_cb - [DEBUG] ... | pcie_data.cpp |
| EDGE | 边界/异常测试 (EDGE) | 测试组 | 覆盖边界条件、异常与极端场景 | A/B/C/D/E/F/G 混合 + 异常 | edge_cases.cpp |

## 说明
- **归属原则**：日志中的模块标签（如 `[IPSLIB]`、`[SCAN_MFP]`、`[SCAN_APP]`）与源码文件一一对应。
- **无标签模块**：`print_event / video_pipeline / pcie_data / scan_pu / CViewModelBase` 通过函数名与文件路径（Format B/C）识别，未带方括号模块标签。
- **IPM 跨文件**：`edge_crop_write`、`image_processing_manager_scan_thread` 等既出现在 `<#IPM>` 流水线上下文，也关联扫描应用，统一归 IPM。
- **EDGE**：边界/异常测试模块，由测试组维护，用于持续暴露匹配引擎的潜在问题。
