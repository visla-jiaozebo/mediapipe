@echo off
echo 🌟 启动人脸美颜Demo服务器...

REM 检查Python是否可用
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ 使用Python启动服务器
    echo 🌐 请在浏览器中访问: http://localhost:8000
    echo ⏹️  按Ctrl+C停止服务器
    echo.
    python -m http.server 8000
) else (
    echo ❌ 未找到Python，请安装Python后重试
    echo 💡 或者使用Node.js: npx http-server -p 8000
    pause
)
