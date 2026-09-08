import type { NextFunction, Request, Response } from "express";

export const ADMIN_STEP_UP_MAX_AGE_MS = 5 * 60 * 1000;

export function requireRecentAdminStepUp(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const assurance = req.session.adminStepUp;
  const isRecent =
    assurance?.userId === userId &&
    Number.isFinite(assurance.verifiedAt) &&
    Date.now() - assurance.verifiedAt >= 0 &&
    Date.now() - assurance.verifiedAt <= ADMIN_STEP_UP_MAX_AGE_MS;

  if (!isRecent) {
    return res.status(403).json({
      error: "Recent administrator verification required",
      code: "STEP_UP_REQUIRED",
      validForSeconds: ADMIN_STEP_UP_MAX_AGE_MS / 1000,
    });
  }

  next();
}