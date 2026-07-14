# 配置文件目录（项目层级）

配置按「项目」分目录存放，每个项目一个子文件夹：

```
config/
├── 示例项目/
│   ├── code-search/       # 模块日志（代码日志）JSON 文件，每个文件一个模块
│   └── module-mapping/    # 模块负责人映射 JSON（mappings.json）
├── 项目A/
│   ├── code-search/
│   └── module-mapping/
└── 项目B/
    ├── code-search/
    └── module-mapping/
```

## 使用说明

1. 在工具栏「当前项目」下拉旁点击「＋」可新建项目，或在「导入配置」弹窗中输入项目名称按项目导入。
2. 应用启动时会读取 config 下的项目列表；切换项目时加载对应目录的模块数据。
3. 在「数据管理」面板中编辑模块负责人表 / 模块日志表，修改会自动保存回对应项目目录。
4. code-search 支持放多个 JSON 文件（每个文件为一个模块日志，内容是代码日志结果数组）。
5. module-mapping 下的 JSON 会被合并读取；保存时统一写入 mappings.json。

## 文件格式示例

code-search/<模块名>.json：
[
  {
    "codeFile": { "fileName": "path/to/file.cpp" },
    "line": 123,
    "functionName": "functionName",
    "matchedPattern": "LOGE错误",
    "matchedText": "matched text"
  }
]

module-mapping/mappings.json：
{
  "version": "2.0",
  "mappings": [
    { "codePath": "network", "moduleName": "网络模块", "contactName": "张三" }
  ]
}
