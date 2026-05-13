import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

/**
 * Middleware factory: validates req.body against a Zod schema.
 * On failure, responds 400 with flattened error details.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Middleware factory: validates req.query against a Zod schema.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({ error: result.error.flatten() });
    }
    next();
  };
}
