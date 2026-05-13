#!/bin/bash

# RepaceClaw 生产环境启动脚本

cd "$(dirname "$0")"

echo "Starting RepaceClaw Platform..."
echo "================================"

# 检查后端是否已在运行
if pgrep -f "node dist/index.js" > /dev/null; then
    echo "Backend is already running"
else
    echo "Starting Backend..."
    cd backend
    npm start &
    cd ..
    sleep 2
fi

echo ""
echo "================================"
echo "RepaceClaw Platform Status:"
echo "- Backend API: http://localhost:3001"
echo "- WebSocket: ws://localhost:3001/ws"
echo "- Frontend: http://localhost:3001 (served by backend)"
echo "================================"
echo ""
echo "Press Ctrl+C to stop"
wait
