/**
 * Express Request 类型扩展
 *
 * 为 req.user 提供类型安全，消除全局 req.user 模式。
 */
import { UserRole } from '../services/UserService';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
      requestId?: string;
      userId?: string;
    }
  }
}
