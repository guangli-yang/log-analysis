@echo off
chcp 65001 >nul
title 日志分析工具

echo.
echo ========================================
echo   日志分析工具 v1.0.0
echo ========================================
echo.

REM 检查Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js
    echo.
    echo 请先安装 Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 检查npm
where npm >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 npm
    echo.
    echo 请先安装 Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [1/3] 检查依赖...
cd /d "%~dp0"

REM 检查node_modules
if not exist node_modules (
    echo [2/3] 安装依赖...
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

echo [3/3] 构建应用...
call npm run build:vite
if errorlevel 1 (
    echo [错误] 构建失败
    pause
    exit /b 1
)

call npm run build:electron
if errorlevel 1 (
    echo [错误] Electron构建失败
    pause
    exit /b 1
)

echo [4/4] 启动应用...
echo.
npx electron .
