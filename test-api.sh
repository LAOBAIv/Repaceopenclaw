#!/bin/bash

# 测试豆包 API 是否正常工作

echo "=== Testing Doubao API ==="

# 测试 1: 检查智能体列表
echo "1. Checking agents..."
curl -s http://118.196.72.0:3001/api/agents | grep -q "豆包" && echo "✅ Agents OK" || echo "❌ Agents Failed"

# 测试 2: 检查 token channels
echo "2. Checking token channels..."
curl -s http://118.196.72.0:3001/api/token-channels | grep -q "doubao" && echo "✅ Token Channels OK" || echo "❌ Token Channels Failed"

# 测试 3: 检查 OpenAI 兼容接口
echo "3. Checking OpenAI compatible API..."
curl -s http://118.196.72.0:3001/v1/models | grep -q "models" && echo "✅ OpenAI API OK" || echo "❌ OpenAI API Failed"

# 测试 4: 检查健康状态
echo "4. Checking health..."
curl -s http://118.196.72.0:3001/health | grep -q "ok" && echo "✅ Health OK" || echo "❌ Health Failed"

echo ""
echo "=== All tests completed ==="
