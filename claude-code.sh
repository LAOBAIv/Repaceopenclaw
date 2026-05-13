#!/bin/bash
# Claude Code 包装脚本 - 用于 root 环境
# 使用方法: ./claude-code.sh [命令]

# 设置 API Key（请替换为你的实际 Key）
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-YOUR_API_KEY_HERE}"

# 检查 API Key
if [ "$ANTHROPIC_API_KEY" = "YOUR_API_KEY_HERE" ] || [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "错误: 请设置 ANTHROPIC_API_KEY 环境变量"
    echo "示例: export ANTHROPIC_API_KEY='sk-ant-...'"
    exit 1
fi

# 进入项目目录
cd /root/.openclaw/workspace/RepaceClaw

# 运行 Claude Code
# 使用 --allow-dangerously-skip-permissions 跳过权限检查（仅在受信任环境使用）
claude "$@"
