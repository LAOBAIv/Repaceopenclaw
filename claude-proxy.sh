#!/bin/bash
# Claude Code SSH 代理配置脚本

# 方法1: 直接使用 HTTPS 代理
export HTTPS_PROXY="socks5://127.0.0.1:1080"

# 方法2: 使用 SSH 隧道转发 API 请求
# 先建立 SSH 隧道: ssh -N -L 8080:api.example.com:443 user@jump-server
# 然后设置: export ANTHROPIC_BASE_URL="http://localhost:8080"

# 方法3: 使用环境变量注入 API Key
export CLAUDE_CODE_API_KEY="${API_KEY:-your-api-key}"

# 启动 Claude Code
cd /root/.openclaw/workspace/RepaceClaw
./claude-ssh.sh "$@"
