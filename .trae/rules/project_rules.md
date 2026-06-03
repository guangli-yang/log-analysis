---
alwaysApply: false
description: 存在代码修改时
---
# Project Rules

## 编译验证规则
- **每次完成代码修改后，必须运行 `npm run build:vite` 进行编译验证**
- 确保 TypeScript 编译通过，无类型错误
- 确保 Vite 构建成功，无打包错误
- 只有编译通过后才能认为任务完成

## 项目技术栈
- React 18 + TypeScript
- Electron 28
- Vite 构建工具
- Dexie (IndexedDB)

## 常用命令
- `npm run dev` - 启动开发模式
- `npm run build:vite` - 前端编译验证
- `npm run build` - 完整构建（含 Electron）
