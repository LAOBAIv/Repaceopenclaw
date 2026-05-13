#!/bin/bash
# Claude Code SSH 隧道版本 - 用于调用三方 API

# 配置 API 信息
export ANTHROPIC_API_KEY="cp_a8422184a7d8e665a3509a5edbd27e0b"
export ANTHROPIC_BASE_URL="https://e.linkh5.cn"
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"

# 可选：通过 SSH 隧道转发（如果需要）
# export ANTHROPIC_BASE_URL="http://localhost:8080"

cd /root/.openclaw/workspace/RepaceClaw

echo "启动 Claude Code (SSH/API 模式)..."
echo "API: $ANTHROPIC_BASE_URL"
echo "Model: $ANTHROPIC_MODEL"
echo ""

# 检查 API 连通性
echo "检查 API 连通性..."
if curl -s -o /dev/null -w "%{http_code}" "$ANTHROPIC_BASE_URL/v1/models" -H "Authorization: Bearer $ANTHROPIC_API_KEY" | grep -q "200\|401\|403"; then
    echo "API 可访问"
else
    echo "警告: API 可能无法访问，尝试使用..."
fi

claude "$@"
