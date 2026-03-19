/**
 * 统一路由注册和配置
 * 
 * 优化点：
 * 1. 统一路由前缀管理
 * 2. 支持路由分组和中间件链
 * 3. 统一响应格式
 * 4. 路由文档自动生成支持
 */

import { Express, Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware';

// 路由配置接口
interface RouteConfig {
  path: string;
  router: Router;
  prefix?: string;
  middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
  requireAuth?: boolean;
  roles?: string[];
}

// 路由组配置
interface RouteGroupConfig {
  prefix: string;
  routes: RouteConfig[];
  commonMiddleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
  requireAuth?: boolean;
  roles?: string[];
}

/**
 * 创建路由配置
 */
export function createRoute(
  path: string,
  router: Router,
  options: Omit<RouteConfig, 'path' | 'router'> = {}
): RouteConfig {
  return {
    path,
    router,
    ...options,
  };
}

/**
 * 应用中间件链到路由
 */
function applyMiddleware(
  app: Express,
  path: string,
  router: Router,
  config: RouteConfig
): void {
  const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

  // 添加通用中间件
  if (config.middleware) {
    middlewares.push(...config.middleware);
  }

  // 添加鉴权中间件
  if (config.requireAuth) {
    middlewares.push(authenticate);
  }

  // 添加角色权限中间件
  if (config.roles && config.roles.length > 0) {
    middlewares.push(requireRole(config.roles as any));
  }

  // 注册路由
  const fullPath = config.prefix ? `${config.prefix}${path}` : path;
  
  if (middlewares.length > 0) {
    app.use(fullPath, ...middlewares, router);
  } else {
    app.use(fullPath, router);
  }
}

/**
 * 注册单个路由
 */
export function registerRoute(app: Express, config: RouteConfig): void {
  applyMiddleware(app, config.path, config.router, config);
}

/**
 * 注册路由组
 */
export function registerRouteGroup(app: Express, group: RouteGroupConfig): void {
  group.routes.forEach((route) => {
    const mergedConfig: RouteConfig = {
      ...route,
      prefix: group.prefix,
      middleware: [
        ...(group.commonMiddleware || []),
        ...(route.middleware || []),
      ],
      requireAuth: route.requireAuth ?? group.requireAuth,
      roles: route.roles || group.roles,
    };

    applyMiddleware(app, route.path, route.router, mergedConfig);
  });
}

/**
 * 生成路由信息（用于文档生成）
 */
export function generateRouteDocs(routes: RouteConfig[]): object {
  return routes.map((route) => ({
    path: route.prefix ? `${route.prefix}${route.path}` : route.path,
    requireAuth: route.requireAuth || false,
    roles: route.roles || [],
  }));
}
