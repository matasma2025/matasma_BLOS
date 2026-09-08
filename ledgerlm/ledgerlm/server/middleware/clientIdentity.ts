import type { NextFunction, Request, Response } from "express";

/**
 * Client identity headers are never authentication inputs. Remove them before
 * route handlers run so future code cannot accidentally trust a spoofed value.
 */
export function discardClientIdentityHeaders(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  delete req.headers["x-user-id"];
  next();
}