#!/bin/bash
# Claude Code 启动脚本 - 火山引擎版本

# 请替换为你的火山方舟 API Key
export ANTHROPIC_API_KEY="${VOLC_API_KEY:-YOUR_VOLC_API_KEY}"
export ANTHROPIC_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"

# 检查 API Key
if [ "$ANTHROPIC_API_KEY" = "YOUR_VOLC_API_KEY" ] || [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "错误: 请设置 VOLC_API_KEY 环境变量"
    echo "示例: export VOLC_API_KEY='your-volc-api-key'"
    exit 1
fi

cd /root/.openclaw/workspace/RepaceClaw

echo "启动 Claude Code (火山引擎)..."
echo "API: https://ark.cn-beijing.volces.com/api/v3"
echo ""

claude "$@"
