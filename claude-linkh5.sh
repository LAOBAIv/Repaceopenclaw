#!/bin/bash
# Claude Code 启动脚本 - LinkH5 版本

export ANTHROPIC_API_KEY="cp_a8422184a7d8e665a3509a5edbd27e0b"
export ANTHROPIC_BASE_URL="https://e.linkh5.cn/v1"
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"

cd /root/.openclaw/workspace/RepaceClaw

echo "启动 Claude Code (LinkH5)..."
echo "API: https://e.linkh5.cn/v1"
echo "Model: claude-3-5-sonnet-20241022"
echo ""

claude "$@"
