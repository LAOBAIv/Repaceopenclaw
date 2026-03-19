#!/bin/bash
# LinkH5 API 诊断脚本

API_KEY="cp_a8422184a7d8e665a3509a5edbd27e0b"
BASE_URL="https://e.linkh5.cn"

echo "=== LinkH5 API 诊断 ==="
echo "API URL: $BASE_URL"
echo "API Key: ${API_KEY:0:10}..."
echo ""

# 测试 1: 检查 API 连通性
echo "测试 1: 检查 API 连通性..."
curl -s -o /dev/null -w "HTTP 状态码: %{http_code}\n" "$BASE_URL/v1/models" || echo "无法连接"
echo ""

# 测试 2: 使用 api-key header
echo "测试 2: 使用 api-key header..."
curl -s -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "api-key: $API_KEY" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}' | head -100
echo ""

# 测试 3: 使用 x-api-key header
echo "测试 3: 使用 x-api-key header..."
curl -s -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}' | head -100
echo ""

# 测试 4: 使用 Authorization Bearer
echo "测试 4: 使用 Authorization Bearer..."
curl -s -X POST "$BASE_URL/v1/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}' | head -100
echo ""

# 测试 5: 使用 chat/completions 端点
echo "测试 5: 使用 chat/completions 端点..."
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "api-key: $API_KEY" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}' | head -100
echo ""

echo "=== 诊断完成 ==="
echo ""
echo "建议:"
echo "1. 如果所有测试都失败，可能是 API 服务暂时不可用"
echo "2. 联系 LinkH5 提供商确认 API 状态"
echo "3. 检查 API Key 是否正确且未过期"
echo "4. 确认模型名称是否正确"
