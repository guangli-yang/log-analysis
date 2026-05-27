@echo off
chcp 65001 >nul
title Log Analyzer - 一键编译

echo ========================================
echo    Log Analyzer 一键编译脚本
echo ========================================
echo.

:: 检查 Node.js 是否安装
echo [1/4] 检查 Node.js 环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18.x 或更高版本
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 显示 Node.js 版本
for /f "delims=" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js 版本: %NODE_VERSION%

:: 检查 npm 是否安装
for /f "delims=" %%i in ('npm -v') do set NPM_VERSION=%%i
echo [OK] npm 版本: %NPM_VERSION%
echo.

:: 安装依赖
echo [2/4] 安装项目依赖...
echo 此步骤可能需要几分钟，请耐心等待...
echo.
call npm install
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败，请检查网络连接
    pause
    exit /b 1
)
echo [OK] 依赖安装完成
echo.

:: 构建项目
echo [3/4] 编译项目...
echo.
call npm run dist
if %errorlevel% neq 0 (
    echo [错误] 编译失败，请检查错误信息
    pause
    exit /b 1
)
echo [OK] 编译完成
echo.

:: 显示结果
echo [4/4] 编译结果
echo ========================================
echo.
if exist "release-v0.2.1\Log Analyzer 0.2.0.exe" (
    echo [OK] 便携版: release-v0.2.1\Log Analyzer 0.2.0.exe
) else (
    echo [警告] 便携版未找到
)

if exist "release-v0.2.1\Log Analyzer Setup 0.2.0.exe" (
    echo [OK] 安装版: release-v0.2.1\Log Analyzer Setup 0.2.0.exe
) else (
    echo [警告] 安装版未找到
)

echo.
echo ========================================
echo 编译成功！按任意键退出...
pause >nul
