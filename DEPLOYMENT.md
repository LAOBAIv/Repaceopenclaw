# RepaceClaw 部署文档

## 目录
- [项目概述](#项目概述)
- [技术栈](#技术栈)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [开发环境部署](#开发环境部署)
- [生产环境部署](#生产环境部署)
- [Docker 部署](#docker-部署)
- [环境变量配置](#环境变量配置)
- [API 接口说明](#api-接口说明)
- [常见问题](#常见问题)

---

## 项目概述

RepaceClaw 是一个多智能体协作平台，支持：
- 智能体管理与配置
- 项目与任务看板
- 多轮对话与工作流编排
- WebSocket 实时通信
- 多渠道接入（飞书、企业微信、钉钉等）

---

## 技术栈

### 前端
| 技术 | 版本 | 说明 |
|------|------|------|
| React | 18.x | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Vite | 5.x | 构建工具 |
| Tailwind CSS | 3.x | 样式框架 |
| Zustand | 4.x | 状态管理 |
| Radix UI | latest | 无障碍组件库 |
| TipTap | 3.x | 富文本编辑器 |

### 后端
| 技术 | 版本 | 说明 |
|------|------|------|
| Express | 4.x | Web 框架 |
| TypeScript | 5.x | 类型安全 |
| sql.js | 1.x | 纯 JS SQLite（无需编译） |
| WebSocket (ws) | 8.x | 实时通信 |
| JWT | 9.x | 身份认证 |
| Zod | 3.x | 数据校验 |

---

## 环境要求

### 必需
- **Node.js**: >= 18.x (推荐 20.x LTS)
- **npm**: >= 9.x 或 **pnpm**: >= 8.x
- **操作系统**: Linux / macOS / Windows

### 推荐
- **内存**: >= 2GB
- **磁盘**: >= 1GB（用于数据库和日志）

---

## 快速开始

```bash
# 1. 克隆项目
git clone <repository-url>
cd RepaceClaw

# 2. 安装后端依赖
cd backend
npm install

# 3. 安装前端依赖
cd ../frontend
npm install

# 4. 构建后端
cd ../backend
npm run build

# 5. 构建前端
cd ../frontend
npm run build

# 6. 启动生产服务
cd ..
./start-production.sh
```

访问地址：
- 前端界面：http://localhost:3001
- API 接口：http://localhost:3001/api
- WebSocket：ws://localhost:3001/ws

---

## 开发环境部署

### 方式一：前后端分离启动（推荐开发时使用）

```bash
# 终端 1：启动后端开发服务器（热重载）
cd backend
npm run dev
# 后端运行在 http://localhost:3001

# 终端 2：启动前端开发服务器
cd frontend
npm run dev
# 前端运行在 http://localhost:5173
```

开发模式下，前端 Vite 服务器会自动代理 API 和 WebSocket 请求到后端：
- `/api/*` → `http://localhost:3001/api/*`
- `/ws` → `ws://localhost:3001/ws`

### 方式二：仅启动后端（前端已构建）

```bash
cd backend
npm run build
npm start
# 后端同时提供 API 和静态文件服务
# 访问 http://localhost:3001
```

---

## 生产环境部署

### 1. 构建应用

```bash
# 构建后端
cd backend
npm install --production=false  # 安装所有依赖（包括 devDependencies）
npm run build                   # TypeScript 编译到 dist/

# 构建前端
cd ../frontend
npm install
npm run build                   # 输出到 dist/
```

### 2. 部署静态文件

构建完成后，将前端 `dist/` 目录复制到后端：

```bash
# 前端构建产物已在 frontend/dist/
# 后端会自动从 ../frontend/dist 读取静态文件
# 或手动复制到 backend/dist/public/
```

### 3. 启动服务

```bash
# 方式一：使用启动脚本
./start-production.sh

# 方式二：直接启动后端
cd backend
NODE_ENV=production npm start

# 方式三：使用 PM2（推荐）
pm2 start backend/dist/index.js --name repaceclaw
pm2 save
pm2 startup
```

### 4. 反向代理配置（Nginx）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件和 API
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 专用
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

---

## Docker 部署

### Dockerfile

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# 安装依赖
RUN cd backend && npm install
RUN cd frontend && npm install

# 复制源代码
COPY backend ./backend
COPY frontend ./frontend

# 构建
RUN cd backend && npm run build
RUN cd frontend && npm run build

# 运行阶段
FROM node:20-alpine

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./
COPY --from=builder /app/frontend/dist ./public

# 数据目录
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  repaceclaw:
    build: .
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data  # 持久化数据库
    environment:
      - NODE_ENV=production
      - PORT=3001
      - CORS_ORIGIN=*
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 构建和运行

```bash
# 构建镜像
docker build -t repaceclaw:latest .

# 使用 docker-compose
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

## 环境变量配置

### 后端环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | 3001 | 服务端口 |
| `NODE_ENV` | development | 运行环境（development/production） |
| `CORS_ORIGIN` | * | CORS 允许的源 |
| `JWT_SECRET` | - | JWT 签名密钥（生产环境必须设置） |

### 配置方式

```bash
# 方式一：环境变量
export PORT=3001
export NODE_ENV=production
export CORS_ORIGIN=https://your-domain.com
export JWT_SECRET=your-super-secret-key

# 方式二：.env 文件（需安装 dotenv）
cat > backend/.env << EOF
PORT=3001
NODE_ENV=production
CORS_ORIGIN=*
JWT_SECRET=your-super-secret-key
EOF
```

---

## API 接口说明

### 基础信息
- 基础路径：`/api`
- 认证方式：JWT Bearer Token
- 响应格式：JSON

### 主要接口

| 模块 | 路径 | 说明 |
|------|------|------|
| 认证 | `/api/auth` | 用户登录、注册、令牌刷新 |
| 智能体 | `/api/agents` | CRUD、配置、技能绑定 |
| 项目 | `/api/projects` | 项目管理、工作流配置 |
| 任务 | `/api/tasks` | 任务 CRUD、状态变更 |
| 对话 | `/api/conversations` | 会话管理、消息发送 |
| Token 渠道 | `/api/token-channels` | LLM API Key 管理 |
| Bot 渠道 | `/api/bot-channels` | 飞书/企微/钉钉配置 |
| 技能 | `/api/skills` | 技能列表、绑定 |
| 插件 | `/api/plugins` | 插件管理 |
| 搜索 | `/api/search` | 全局搜索 |
| 导入导出 | `/api/export`, `/api/import` | 数据备份恢复 |

### OpenAI 兼容接口

平台提供 OpenAI 格式兼容接口，可直接接入现有 AI 应用：

```
POST /v1/chat/completions
Authorization: Bearer <your-api-key>
Content-Type: application/json

{
  "model": "<agent-id>",
  "messages": [{"role": "user", "content": "你好"}],
  "stream": true
}
```

---

## 数据库说明

### 存储位置
- 开发环境：`backend/data/platform.db`
- Docker：容器内 `/app/data/platform.db`

### 数据表

| 表名 | 说明 |
|------|------|
| `agents` | 智能体配置 |
| `projects` | 项目信息 |
| `tasks` | 任务列表 |
| `conversations` | 会话 |
| `messages` | 消息记录 |
| `users` | 用户账户 |
| `token_channels` | LLM API 配置 |
| `bot_channels` | Bot 渠道配置 |
| `skills` | 技能定义 |
| `plugins` | 插件定义 |

### 备份

```bash
# 备份数据库
cp backend/data/platform.db backup/platform_$(date +%Y%m%d).db

# 恢复
cp backup/platform_20260319.db backend/data/platform.db
```

---

## 常见问题

### Q1: 端口被占用怎么办？

```bash
# 查看端口占用
lsof -i :3001

# 修改端口
PORT=3002 npm start
```

### Q2: 前端构建失败？

```bash
# 清除缓存重新安装
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Q3: 数据库损坏怎么恢复？

```bash
# 检查数据库完整性
sqlite3 backend/data/platform.db "PRAGMA integrity_check;"

# 从备份恢复
cp backup/platform.db backend/data/platform.db
```

### Q4: WebSocket 连接失败？

1. 检查 Nginx 配置是否正确代理 WebSocket
2. 确认防火墙允许 WebSocket 连接
3. 检查前端 WebSocket 连接地址是否正确

### Q5: 智能体无法调用 LLM？

1. 检查 Token Channel 是否正确配置 API Key
2. 确认 Base URL 是否正确（国内需要代理）
3. 查看后端日志排查错误

---

## 监控与日志

### 健康检查

```bash
# HTTP 健康检查
curl http://localhost:3001/health

# 返回示例
{"status": "ok", "timestamp": "2026-03-19T12:00:00.000Z"}
```

### 日志查看

```bash
# 直接运行时的日志
# 输出到标准输出

# 使用启动脚本的日志
tail -f /tmp/backend.log

# PM2 日志
pm2 logs repaceclaw

# Docker 日志
docker-compose logs -f
```

---

## 更新升级

```bash
# 1. 拉取最新代码
git pull

# 2. 更新依赖
cd backend && npm install
cd ../frontend && npm install

# 3. 备份数据库
cp backend/data/platform.db backup/

# 4. 重新构建
cd backend && npm run build
cd ../frontend && npm run build

# 5. 重启服务
pm2 restart repaceclaw
# 或
docker-compose restart
```

---

## 联系支持

如遇问题，请提交 Issue 或联系开发团队。