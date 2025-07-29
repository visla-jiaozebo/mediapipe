#!/bin/bash

# 高性能美颜系统启动脚本

echo "🚀 启动高性能美颜系统..."
echo ""

# 检查Python版本
if command -v python3 &> /dev/null; then
    PYTHON_CMD=python3
elif command -v python &> /dev/null; then
    PYTHON_CMD=python
else
    echo "❌ 错误: 未找到Python解释器"
    echo "请安装Python 3.x 或者使用其他Web服务器"
    exit 1
fi

# 显示访问链接
echo "📁 项目文件已准备就绪："
echo "   • webgl-beauty.html     - GPU版本（推荐）⭐"
echo "   • index.html           - CPU版本"  
echo "   • comparison.html      - 算法对比"
echo ""

# 启动本地服务器
echo "🌐 启动本地Web服务器..."
echo "   端口: 8000"
echo "   地址: http://localhost:8000"
echo ""

echo "� 快速访问链接："
echo "   • GPU美颜: http://localhost:8000/webgl-beauty.html ⭐"
echo "   • CPU美颜: http://localhost:8000/index.html"
echo "   • 算法对比: http://localhost:8000/comparison.html"
echo ""

echo "💡 提示: 使用 Ctrl+C 停止服务器"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 启动Python HTTP服务器
$PYTHON_CMD -m http.server 8000
else
    echo "❌ 未找到Python，请安装Python后重试"
    echo "💡 或者使用Node.js: npx http-server -p 8000"
    exit 1
fi
