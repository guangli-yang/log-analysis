@echo off
echo ========================================
echo   日志分析工具 - 打包
echo ========================================
echo.
echo 正在打包应用程序...
echo.

REM 清理旧的构建文件
if exist release rmdir /s /q release
if exist dist rmdir /s /q dist

REM 构建项目
echo [1/3] 构建项目...
call npm run build
if errorlevel 1 (
    echo 构建失败！
    pause
    exit /b 1
)

REM 打包为exe
echo [2/3] 打包为exe...
npx electron-builder --win --x64 --publish never

if errorlevel 1 (
    echo 打包失败！
    pause
    exit /b 1
)

echo [3/3] 打包完成！
echo.
echo 生成的文件位于 release\ 目录：
echo   - Log Analyzer Setup 1.0.0.exe (安装包)
echo   - Log Analyzer 1.0.0.exe (便携版)
echo.
pause
