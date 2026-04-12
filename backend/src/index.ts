/**
 * RepaceClaw 后端服务入口
 * 
 * 优化后的架构：
 * 1. 路由统一管理 - 所有路由在 routes/index.ts 中集中注册
 * 2. 中间件统一配置 - 错误处理、鉴权等中间件统一配置
 * 3. 统一响应格式 - 使用 response.ts 中的工具函数
 * 4. 类型安全 - 使用 types/index.ts 中的类型定义
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';

import { initDb, getDb } from './db/client';
import { registerRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { setupWebSocket } from './ws/wsHandler';

// 环境变量配置
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

/**
 * 启动应用主函数
 */
async function main(): Promise<void> {
  // 1. 初始化数据库
  await initDb();
  console.log('[DB] Database initialized successfully');

  // 2. 创建 Express 应用
  const app = express();

  // 3. 全局中间件配置
  setupGlobalMiddleware(app);

  // 4. 注册健康检查路由（在 API 路由之前）
  setupHealthCheck(app);

  // 5. 注册 API 路由
  registerRoutes(app);
  console.log('[Router] All routes registered');

  // 6. 静态文件服务（生产环境）
  setupStaticFiles(app);

  // 7. 404 处理（API 路由未匹配时）
  app.use(notFoundHandler);

  // 8. 全局错误处理（必须放在最后）
  app.use(errorHandler);

  // 9. 创建 HTTP 服务器并附加 WebSocket
  const server = http.createServer(app);
  setupWebSocket(server);

  // 10. 启动服务器
  server.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`[Server] RepaceClaw Backend Server`);
    console.log(`[Server] Environment: ${NODE_ENV}`);
    console.log(`[Server] HTTP: http://localhost:${PORT}`);
    console.log(`[Server] WebSocket: ws://localhost:${PORT}/ws`);
    console.log('='.repeat(60));
  });
}

/**
 * 配置全局中间件
 */
function setupGlobalMiddleware(app: express.Application): void {
  // CORS 跨域支持
  app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Body 解析
  app.use(express.json({ 
    limit: '10mb',
    // 严格模式：只接受对象和数组
    strict: true,
  }));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
  }));

  // 请求日志（开发环境）
  if (NODE_ENV === 'development') {
    app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${req.method} ${req.path}`);
      next();
    });
  }
}

/**
 * 配置健康检查端点
 */
function setupHealthCheck(app: express.Application): void {
  // 基础健康检查
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'repaceclaw-backend',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // 详细健康检查（可扩展为检查数据库、外部服务等）
  app.get('/health/detail', async (req, res) => {
    const checks = {
      database: 'unknown',
      timestamp: new Date().toISOString(),
    };

    // 数据库连接检查
    try {
      const db = getDb();
      // 简单查询验证连接
      db.exec('SELECT 1');
      checks.database = 'ok';
    } catch (error) {
      checks.database = 'error';
    }

    const allOk = Object.values(checks).every(
      (v) => v === 'ok' || v === 'unknown' || typeof v === 'string'
    );

    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degraded',
      checks,
    });
  });
}

/**
 * 配置静态文件服务
 */
function setupStaticFiles(app: express.Application): void {
  // 始终提供前端构建文件（开发和生产环境都需要）
  const staticPath = path.join(__dirname, '../../frontend/dist');
  if (require('fs').existsSync(staticPath)) {
    app.use(express.static(staticPath));

    // SPA 路由回退：所有非 API 请求返回 index.html
    app.get('*', (req, res, next) => {
      // API 请求不处理
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/v1') ||
        req.path.startsWith('/ws') ||
        req.path.startsWith('/health')
      ) {
        return next();
      }
      res.sendFile(path.join(staticPath, 'index.html'));
    });

    console.log('[Static] Serving frontend from:', staticPath);
  } else {
    console.log('[Static] Frontend dist not found at:', staticPath);
  }
}

// 启动应用
main().catch((err) => {
  console.error('[Fatal] Server startup failed:', err);
  process.exit(1);
});
