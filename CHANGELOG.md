# 版本更新说明

## v1.3.1 — 匹配引擎重构 · ctags 函数名智能提取 · 快捷键修复

> 发布日期：2026-07-17

---

## 一、快速分析匹配引擎重构

### 1.1 从"启发式猜测"到"模式匹配"

v1.2 的匹配引擎使用 3 级置信度 + 3 阶段回退 + 评分排优 + 跨模块消歧的复杂管线，代码约 350 行。由于日志格式无法预测，各阶段之间通过置信度标记层层传递，维护和理解成本较高。

v1.3 将所有日志格式归为 3 种确定性结构模式：

| 模式 | 格式特征 | 匹配规则 |
|------|----------|----------|
| **A** | `funcName - [LEVEL]...` | 仅 funcName 精确匹配 |
| **B** | `[ts][LEVEL] filePath L### funcName():` | fileName(基本名) + funcName 匹配 |
| **C** | `funcName- filePath L### [MOD][LEVEL]` | 同 B，fileName + funcName 匹配 |

**前提条件**：日志等级必须 ≥ ERROR（ERROR / ERR / FATAL / CRITICAL / ASSERT / PANIC），WARNING / INFO / DEBUG 等一律忽略。

**不满足任何模式的行直接忽略**，无内容兜底。

### 1.2 变更统计

| 维度 | v1.2 | v1.3 |
|------|------|------|
| 代码量 | ~350 行 | **~170 行**（-51%） |
| 匹配阶段 | 3 阶段 + 回退逻辑 | **单次 find()** |
| 置信度 | high / low / none | **移除** |
| 评分模型 | bestByScore 加权 | **移除** |
| 内容兜底 | ≥2 关键词全词 | **移除** |
| 行号参与匹配 | Stage A 优先行号 | **不参与匹配决策** |

### 1.3 接口兼容性

`LogMatchPanel.tsx` 仅依赖 `matchModuleAgainstLog()`，签名和返回值结构未变，无需任何改动。

---

## 二、代码检索函数名提取 — ctags 集成

### 2.1 问题背景

v1.2 使用复杂正则解析 C/C++ 函数签名（`extractFuncDef`，约 30 行正则），存在以下结构性缺陷：

- **指针返回类型无空格**：`char* func()` 无法识别
- **嵌套括号参数**：`void f(void(*cb)(int))` 参数截断
- **构造函数初始化列表**：`Foo(x):m_x(x){}` 无法识别
- 返回类型修饰词（`static`、`inline`、`const`、模板等）组合繁多，正则难以穷举

导致大量 CodeSearchResult 的 `functionName` 字段为空，快速分析匹配率下降。

### 2.2 解决方案

集成 **Universal Ctags v6.1.0**（编译器前端级源码解析器），替代正则扫描：

```
检索开始 → ctags -R 扫描全目录（3-8 秒，一次性）
         → Map<文件路径, Map<行号, 函数名>>
         → processFile 中 O(1) 查表 ← 替代 500 行正则扫描
```

### 2.3 技术细节

- **二进制**：`resources/ctags/ctags.exe`（Windows x64，4.5MB）
- **调用方式**：Node.js `execFile`，输出解析为结构化索引
- **降级策略**：ctags 二进制不存在 / 执行超时（60s）/ 输出溢出（50MB 上限）→ 自动回退原有正则方案
- **打包**：`package.json` 新增 `extraResources`，electron-builder 自动打入安装包
- **跨平台**：保留 Linux / macOS 二进制占位路径，当前仅打包 Windows 版本

### 2.4 效果验证

在 `test_data/sim_src/` 测试集上：

| 文件 | 函数总数 | ctags 命中 | 覆盖率 |
|------|:--:|:--:|:--:|
| `video_pipeline.cpp` | 5 | 5 | 100% |
| `scan_pu.cpp` | 5 | 5 | 100% |
| `job_manager.cpp` | 3 | 3 | 100% |
| `pcie_data.cpp` | 4 | 4 | 100% |
| `scan_mfp.cpp` | 5 | 5 | 100% |

全部与 `_expected.json` 吻合。

---

## 三、Ctrl+F / Ctrl+G 快捷键修复

### 3.1 问题

中文 Windows 下 IME（输入法）激活时，`keydown` 事件的 `e.key` 变为 `'Process'`，原有 `e.key === 'f'` 判定失效；同时冒泡阶段 `e.preventDefault()` 可能被 Chromium 默认行为抢先。

### 3.2 修复

**双层方案（主进程 + 渲染进程）**：

| 层级 | 文件 | 方案 |
|------|------|------|
| 主进程 | `electron/main.ts` | `before-input-event` + `input.code === 'KeyF'/'KeyG'`（物理键码）抢先 preventDefault，IPC 转发 |
| 渲染进程 | `src/App.tsx` | `keydown` 改用 `e.code` + 捕获阶段 (`addEventListener(..., true)`) 兜底 |
| preload | `electron/preload.ts` | 新增 `on(channel, cb)` 订阅主进程消息 |
| 类型 | `src/vite-env.d.ts` | `ElectronAPI` 补 `on` 声明 |

---

## 四、其他改进

- 新增 `ThinkingOverlay` 组件：快速分析匹配中显示"思考中"遮罩，改善等待体验
- 新增 `src/utils/mergeData.ts`：模块日志 / 负责人表深度合并工具
- `DataManagementPanel`：编辑交互与样式优化
- `CodeSearchPanel`：AI 在线检索模式支持

---

## 五、修改文件统计

| 类型 | 数量 | 关键文件 |
|------|:--:|------|
| 新增 | 6 | `src/utils/logMatch.ts`, `src/utils/mergeData.ts`, `src/components/ThinkingOverlay.*` |
| 新增（资源） | 1 | `resources/ctags/ctags.exe` |
| 修改 | 10 | `electron/main.ts`, `package.json`, `src/App.tsx`, `src/types.ts`, 组件等 |
| **合计** | **17 files** | |

### 关键代码改动

- `src/utils/logMatch.ts` (+170 行)：全新匹配引擎，3 模式正则
- `electron/main.ts` (+103 行)：`buildGlobalFuncMap` + `processFile` ctags 改造
- `electron/main.ts` (+37 行)：快捷键输入事件层拦截
- `src/App.tsx` (+175 行)：快捷键修复 + 在线代码检索 + ThinkingOverlay
- `package.json` (+6 行)：`extraResources` ctags 打包配置

> 发布日期：2026-07-14

---

## 一、核心概念：模块日志文件与模块负责人表

本版本引入了两个核心数据类型，支撑"快速分析"功能。

### 1.1 模块日志文件（Code Logs）

**是什么**

模块日志文件是**从源代码中检索出的日志打印语句集合**。每条记录包含：
- 代码文件路径（如 `C:\project\2\network.c`）
- 行号（如第 88 行）
- 函数名（如 `sendData`）
- 匹配到的模式（如 `LOGE错误`）
- 提取出的静态文本（如 `OPEN  falie`，去除了 `%s`、`%d` 等格式占位符）

**怎么来的**

1. 打开应用 → 工具栏"代码检索" → 选择要扫描的源代码文件夹
2. 系统根据配置的正则模式（如 `LOGE\s*\(\s*"[^"]*"`）逐文件扫描匹配行
3. 对每条匹配行，自动提取引号内的静态字符串，去除格式占位符和转义符
4. 搜索结果展示后，通过"导出 → 导入配置"保存到当前项目中

**怎么导入**

1. 单击工具栏"导入配置"按钮
2. 在弹窗中输入**项目名称**（如 `MyProject`），新项目自动创建
3. 选择导入模式：
   - **合并导入**：保留已有模块日志，追加新数据
   - **覆盖导入**：清空当前项目的模块日志，用新数据替换
4. 单击"导入模块日志配置"按钮

**怎么使用**

1. 打开一个日志文件（需包含 `L<行号>:  <内容>` 格式的行）
2. 单击工具栏"快速分析"
3. 勾选要参与匹配的模块日志
4. 单击"开始匹配"——系统自动：
   - 按源代码行号匹配日志行
   - 对每条匹配日志行，用关键词分词验证内容一致性
   - 展示匹配结果，附带模块负责人信息

**存储位置**

```
config/
└── MyProject/                  ← 项目目录
    └── code-search/
        ├── network.json        ← 模块日志文件（JSON 数组，每个文件一个模块）
        └── audio.json
```

---

### 1.2 模块负责人表（Module Mappings）

**是什么**

模块负责人表是**代码路径 → 模块名称 → 负责人**的映射关系表，用于快速分析时自动关联责任人。每条记录包含：
- **代码路径**：匹配时的代码文件路径（如 `project\2`）
- **模块名称**：可读的模块名（如 `网络模块`）
- **负责人**：模块负责人姓名（如 `张三`）

**怎么来的**

1. 手工创建：数据管理面板 → 模块负责人表 → "新增"按钮逐条填写
2. 批量导入：准备一个 JSON 文件，格式如下：

```json
{
  "version": "2.0",
  "mappings": [
    { "codePath": "project\\1", "moduleName": "音频模块", "contactName": "张三" },
    { "codePath": "project\\2", "moduleName": "网络模块", "contactName": "李四" }
  ]
}
```

**怎么导入**

1. 单击工具栏"导入配置"
2. 输入项目名称，选择导入模式
3. 单击"导入模块负责人配置"按钮

**存储位置**

```
config/
└── MyProject/
    └── module-mapping/
        └── mappings.json       ← 模块负责人表（单文件）
```

---

## 二、新增功能

### 2.1 项目级配置管理

- 顶部工具栏新增 🗂️ **项目下拉选择器**，全局切换当前项目
- 单击 ＋ 按钮可**新建项目**，自动在 `config/` 下创建项目目录结构
- 每个项目独立管理自己的模块日志和模块负责人表
- 关键词、AI 配置等保持全局共享
- 当前项目自动保存到本地，启动时恢复

### 2.2 数据管理面板（DataManagementPanel）

- 工具栏新增"数据管理"按钮，打开**模态管理面板**
- 两个标签页：
  - **模块负责人表**：内联编辑代码路径/模块名称/负责人，支持新增、删除、一键清空
  - **模块日志表**：按文件分组，默认折叠，点击可展开查看并编辑逐条明细
- 分组内编辑条目：代码文件、行号、函数名、匹配模式、匹配文本
- 支持搜索（文件名 + 条目内容全字段匹配），搜索时自动展开匹配分组
- 2000+ 条目场景已做折叠 + Memo + useMemo 性能优化，切换标签页毫秒级

### 2.3 欢迎页/空状态引导

- 未打开日志文件时显示完整引导卡片
- 虚线拖放区：支持拖拽 .log / .txt / .json 文件直接打开
- 操作按钮：打开文件、导入配置
- 最近打开文件列表（前 5 条），单击直接打开
- 使用提示

### 2.4 面部退出动画

6 个面板全部加入平滑退出过渡：
- 数据管理 / 快速分析 / 分析工具：弹出 → 收缩（scaleOut）
- 历史面板：左侧滑入 → 左侧滑出
- 导入配置：淡入 → 淡出 + 收缩

### 2.5 快速分析匹配逻辑修复

- 修复 `LOGE("OPEN %s falie\n")` 提取后静态字符串**双空格**导致与日志内容匹配失败的问题
- **keywords 关键词字段**补全 IPC 全链路传输（主进程 → preload → renderer → 导出文件）
- 旧数据回退路径改为**动态提取关键词分词匹配**，无需重新导入即可生效
- 覆盖 `%s`、`%d`、`%x`、`%f`、`\n`、`\t`、`\{...}` 等所有格式占位符场景

### 2.6 关键词设置全面可编辑

- 所有关键字标签页（错误/作业/忽略/核心转储）的**关键词和描述均改为内联 input**，点击即改
- 代码检索标签页（模式名称/正则表达式/描述）同步支持内联编辑
- 代码检索标签移至核心转储关键词左侧
- 编辑后点击"应用"写入全局配置

---

## 三、破坏性变更

- **独立同步面板已移除**：`sync-panel.html` / `sync-panel-main.tsx` 及相关 Vite 配置已删除，功能统一合并到主应用的数据管理面板
- **Dexie 独立数据库已移除**：数据存储由双数据库切换为 `config/<项目>/` 文件存储
- **导入流程变更**：导入配置时需先填写项目名称，再选择覆盖/合并模式

---

## 四、配置迁移指南

### 从旧版本（v1.1.x）迁移

1. **模块日志/负责人表**：
   - 旧版本数据存储在 Dexie 独立数据库中，需**导出 JSON 后重新导入**
   - 导出：旧版本数据管理窗口 → 分别导出"模块映射表"和"代码日志"
   - 导入：新版本 → 工具栏"导入配置" → 输入项目名 → 选择"导入模块日志配置"和"导入模块负责人配置"

2. **全局设置**（关键字/代码检索模式/AI 配置）：
   - 自动兼容，无需迁移

### 文件结构对比

```
旧版本：                          →    新版本：
                                        config/
                                          ├── MyProject/
                                          │   ├── code-search/
                                          │   │   └── module.json
                                          │   └── module-mapping/
                                          │       └── mappings.json
                                          └── AnotherProject/
                                              ├── code-search/
                                              └── module-mapping/
```

---

## 五、技术细节

### 修改文件统计

| 类型 | 数量 |
|------|------|
| 新增文件 | 5（DataManagementPanel.tsx/css, resources 示例配置） |
| 删除文件 | 5（sync-panel 相关） |
| 修改文件 | 20 |
| **合计** | **30 files, +2326 / -1476** |

### 关键代码改动

- `electron/main.ts` (+361 行)：全量项目 IPC 接口 + `extractPrintStaticString` 修复
- `src/App.tsx` (+299 行)：项目状态中心化 + 自动保存 + 欢迎页
- `src/components/DataManagementPanel.tsx` (+454 行)：全新数据管理面板
- `src/components/LogMatchPanel.tsx`：匹配逻辑 keywords 回退路径
- `src/components/KeywordSettingsDialog.tsx`：全部标签页内联编辑
