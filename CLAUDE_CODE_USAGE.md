# Claude Code 使用指南

## 快速启动

### 火山引擎版本（推荐）
```bash
./claude-volc.sh
```

### 标准版本（如有官方 API Key）
```bash
export ANTHROPIC_API_KEY="your-api-key"
./claude-code.sh
```

## 配置说明

### 火山引擎配置（已配置）
- **API Key**: `cf7872d7-e578-44bb-91b5-4700a88deea0`
- **Base URL**: `https://ark.cn-beijing.volces.com/api/coding`
- **Model**: `ark-code-latest`

### 环境变量
```bash
export ANTHROPIC_AUTH_TOKEN="cf7872d7-e578-44bb-91b5-4700a88deea0"
export ANTHROPIC_BASE_URL="https://ark.cn-beijing.volces.com/api/coding"
export ANTHROPIC_MODEL="ark-code-latest"
```

## 使用示例

### 1. 交互式对话
```bash
./claude-volc.sh
```

### 2. 单次命令
```bash
./claude-volc.sh --print "解释这段代码"
```

### 3. 分析文件
```bash
./claude-volc.sh --print "分析 frontend/src/pages/ProjectWorkspace.tsx"
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助 |
| `/clear` | 清空对话 |
| `/exit` | 退出 |

## 注意事项

1. **网络要求** - 需要访问火山引擎 API
2. **费用** - 按 token 计费，注意用量
3. **模型** - `ark-code-latest` 自动调度最优模型
