import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncFn = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Wraps an async route handler so thrown errors / rejected promises
 * are forwarded to Express's error middleware instead of crashing
 * the process or requiring a try/catch in every controller.
 */
export function asyncHandler(fn: AsyncFn): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
