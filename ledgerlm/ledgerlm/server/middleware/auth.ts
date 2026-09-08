import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import type { User } from '@shared/schema';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
    clientBinding?: string;
    clientNetworkBinding?: string;
    browserBinding?: string;
    clientBindingVersion?: number;
    authenticatedAt?: number;
    adminStepUp?: {
      userId: string;
      verifiedAt: number;
      method: 'otp' | 'sso';
    };
    pendingAdminStepUp?: {
      challengeId: string;
      userId: string;
      createdAt: number;
    };
  }
}

export async function enforceSessionRevocation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = req.session?.userId;
  if (!userId) return next();
  try {
    const user = await storage.getUser(userId);
    const revoked =
      !user ||
      (user.sessionsRevokedAt &&
        (!req.session.authenticatedAt ||
          req.session.authenticatedAt <= new Date(user.sessionsRevokedAt).getTime()));
    if (!revoked) return next();
    req.session.destroy(() => {});
    res.clearCookie("connect.sid");
    res.clearCookie("ledgerlm.binding");
    return res.status(401).json({ error: "Session revoked" });
  } catch (error) {
    console.error("Session revocation check error:", error);
    return res.status(500).json({ error: "Authentication error" });
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    if (
      user.sessionsRevokedAt &&
      (!req.session.authenticatedAt ||
        req.session.authenticatedAt <= new Date(user.sessionsRevokedAt).getTime())
    ) {
      return res.status(401).json({ error: 'Session revoked' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    if (
      user.sessionsRevokedAt &&
      (!req.session.authenticatedAt ||
        req.session.authenticatedAt <= new Date(user.sessionsRevokedAt).getTime())
    ) {
      return res.status(401).json({ error: 'Session revoked' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Authorization error' });
  }
}
