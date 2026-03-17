#!/bin/bash

# RepaceClaw 后端服务启动脚本

cd /root/.openclaw/workspace/RepaceClaw/backend

# 检查是否已在运行
if pgrep -f "node dist/index.js" > /dev/null; then
    echo "Service already running"
    exit 0
fi

# 启动服务
nohup node dist/index.js > /tmp/backend.log 2>&1 &

# 等待服务启动
sleep 3

# 检查是否成功
if curl -s http://localhost:3001/health | grep -q "ok"; then
    echo "✅ Service started successfully on port 3001"
    echo "   - API: http://localhost:3001/api"
    echo "   - WebSocket: ws://localhost:3001/ws"
else
    echo "❌ Failed to start service"
    echo "Check logs: tail -f /tmp/backend.log"
    exit 1
fi
