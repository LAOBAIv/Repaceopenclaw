# Claude Code SSH/API 配置指南

## 方法1: 直接使用 API（当前配置）

```bash
# 使用火山引擎（推荐，稳定）
./claude-volc.sh

# 或使用 LinkH5（需确认 API 状态）
./claude-linkh5.sh
```

## 方法2: SSH 隧道转发（安全方式）

### 步骤1: 建立 SSH 隧道
在本地电脑执行：
```bash
# 将远程 API 端口转发到本地
ssh -N -L 8080:e.linkh5.cn:443 user@your-server

# 或者在后台运行
ssh -fN -L 8080:e.linkh5.cn:443 user@your-server
```

### 步骤2: 配置 Claude Code 使用本地端口
```bash
export ANTHROPIC_BASE_URL="http://localhost:8080"
./claude-ssh.sh
```

## 方法3: 使用 HTTPS 代理

```bash
# 设置代理
export HTTPS_PROXY="socks5://127.0.0.1:1080"

# 或使用 HTTP 代理
export HTTPS_PROXY="http://proxy.example.com:8080"

# 启动 Claude Code
./claude-ssh.sh
```

## 方法4: 配置文件方式

创建 `~/.claude/config.json`：
```json
{
  "apiKey": "your-api-key",
  "baseUrl": "https://e.linkh5.cn",
  "model": "claude-3-5-sonnet-20241022",
  "proxy": {
    "type": "socks5",
    "host": "127.0.0.1",
    "port": 1080
  }
}
```

## 方法5: 使用环境变量文件

创建 `.env` 文件：
```bash
ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_BASE_URL=https://e.linkh5.cn
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
HTTPS_PROXY=socks5://127.0.0.1:1080
```

然后加载：
```bash
set -a
source .env
set +a
./claude-ssh.sh
```

## 测试 API 连通性

```bash
# 测试火山引擎
curl -s https://ark.cn-beijing.volces.com/api/coding/v1/models \
  -H "Authorization: Bearer cf7872d7-e578-44bb-91b5-4700a88deea0"

# 测试 LinkH5
curl -s https://e.linkh5.cn/v1/models \
  -H "Authorization: Bearer cp_a8422184a7d8e665a3509a5edbd27e0b"
```

## 故障排查

### 问题1: API 返回 500 错误
- 检查 API Key 是否正确
- 确认 API 端点是否可用
- 查看 API 提供商状态页面

### 问题2: 连接超时
- 检查网络连接
- 尝试使用代理
- 确认防火墙设置

### 问题3: 认证失败
- 确认 Authorization header 格式
- 检查 API Key 权限
- 验证 base URL 是否正确

## 推荐配置

当前最稳定的配置：
```bash
# 火山引擎
export ANTHROPIC_AUTH_TOKEN="cf7872d7-e578-44bb-91b5-4700a88deea0"
export ANTHROPIC_BASE_URL="https://ark.cn-beijing.volces.com/api/coding"
export ANTHROPIC_MODEL="ark-code-latest"
```
