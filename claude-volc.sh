#!/bin/bash
# Claude Code 启动脚本 - 火山引擎版本

export ANTHROPIC_AUTH_TOKEN="cf7872d7-e578-44bb-91b5-4700a88deea0"
export ANTHROPIC_BASE_URL="https://ark.cn-beijing.volces.com/api/coding"
export ANTHROPIC_MODEL="ark-code-latest"

cd /root/.openclaw/workspace/RepaceClaw

echo "启动 Claude Code (火山引擎)..."
echo "API: https://ark.cn-beijing.volces.com/api/coding"
echo "Model: ark-code-latest"
echo ""

claude "$@"
