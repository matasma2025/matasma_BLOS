import type { Request } from "express";
import { storage } from "../storage";

export async function requireOwnedBoard(req: Request, boardId: string) {
  const userId = req.session?.userId;
  if (!userId) {
    const error = new Error("Unauthorized");
    (error as any).status = 401;
    throw error;
  }
  const board = await storage.getBoard(boardId);
  if (!board) {
    const error = new Error("Board not found");
    (error as any).status = 404;
    throw error;
  }
  if (board.userId !== userId) {
    const error = new Error("Forbidden");
    (error as any).status = 403;
    throw error;
  }
  return { userId, board };
}