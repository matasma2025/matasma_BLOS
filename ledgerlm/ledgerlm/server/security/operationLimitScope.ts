import type { Request } from "express";
import { storage } from "../storage";
import type { Operation } from "./operationLimitPolicy";

function deny(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}

type AdminResolver = (userId: string, authenticatedAt?: number) => Promise<{
  user: { id: string };
  domain: { id: string } | null;
  isSuperAdmin: boolean;
} | null>;

export function operationScopeResolver(resolveAdmin: AdminResolver) {
  return async (req: Request, operation: Operation) => {
    const path = req.originalUrl.split("?")[0].replace(/\/+$/, "");
    const lowerPath = path.toLowerCase();
    if (operation.startsWith("public.")) return {};
    const actor = req.session?.userId;
    if (!actor) deny(401, "Authentication required");
    const user = await storage.getUser(actor);
    if (!user) deny(401, "Invalid session");

    // Match existing ownership checks before charging budgets for a resource.
    const boardMatch = path.match(/^\/api\/boards\/([^/]+)\//i);
    const chatMatch = path.match(/^\/api\/chats\/([^/]+)\//i);
    if (boardMatch) {
      const board = await storage.getBoard(decodeURIComponent(boardMatch[1]));
      if (!board || board.userId !== actor) deny(403, "Forbidden");
    }
    if (chatMatch) {
      const chat = await storage.getChat(decodeURIComponent(chatMatch[1]));
      if (!chat) deny(404, "Chat not found");
      if (chat.userId !== actor) deny(403, "Forbidden");
    }

    if (lowerPath.startsWith("/api/domain-admin/") || lowerPath.startsWith("/api/super-admin/")) {
      const admin = await resolveAdmin(actor, req.session?.authenticatedAt);
      if (!admin || (lowerPath.startsWith("/api/super-admin/") && !admin.isSuperAdmin)) {
        deny(403, "Admin access required");
      }
      let tenantId = admin.domain?.id;
      // Only an already-authorized super administrator can select a target
      // domain. Ordinary admins cannot reset their budget with body.domainId.
      if (admin.isSuperAdmin && typeof req.body?.domainId === "string") {
        const domain = await storage.getDomain(req.body.domainId);
        if (!domain) deny(404, "Domain not found");
        tenantId = domain.id;
      }
      return { tenantId };
    }
    if (lowerPath.startsWith("/api/admin/invitations") && user.role !== "admin") {
      deny(403, "Admin access required");
    }
    const membership = await storage.getDomainUserByEmail(user.username.toLowerCase());
    return { tenantId: membership?.status === "active" ? membership.domainId : undefined };
  };
}
