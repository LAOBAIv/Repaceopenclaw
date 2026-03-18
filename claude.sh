#!/bin/bash
# Claude Code 启动脚本 - 使用自定义 API 配置

export ANTHROPIC_API_KEY="cp_a8422184a7d8e665a3509a5edbd27e0b"
export CLAUDE_CODE_BASE_URL="https://e.linkh5.cn"
export CLAUDE_CODE_MODEL="claude-opus-4-6"

cd /root/.openclaw/workspace/RepaceClaw

# 检查 claude 是否安装
if ! command -v claude &> /dev/null; then
    echo "Claude Code 未安装，正在安装..."
    npm install -g @anthropic-ai/claude-code
fi

echo "启动 Claude Code..."
echo "API: https://e.linkh5.cn"
echo "Model: claude-opus-4-6"
echo ""

# 运行 Claude Code
claude "$@"
