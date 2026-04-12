/**
 * 中间件统一管理模块
 * 集中导出所有中间件，便于统一管理和维护
 */

export { authenticate, requireRole } from './auth';
export { errorHandler } from './errorHandler';
export { validateBody as validate, validateBody } from './validate';

// 重新导出扩展的 Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'user' | 'admin' | string;
      };
    }
  }
}
