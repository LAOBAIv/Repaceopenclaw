/**
 * Async Handler 包装工具
 * 自动捕获异步路由中的错误，传递给 Express 错误处理中间件
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * 包装异步路由处理器，自动捕获 Promise 错误
 * @param handler 异步请求处理函数
 */
export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export default asyncHandler;
