import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Chat } from "@shared/schema";

// Session-level workspace chat key — stored in React Query cache so it is
// automatically wiped by queryClient.clear() on logout.
const WS_CHAT_KEY = ["lm_ws_chat"];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const redirected = useRef(false);
  const [error, setError] = useState<string | null>(null);
  // Fix 3: retryCount in the effect deps forces re-run when Retry is clicked,
  // even if `chats` data hasn't changed (304 / same cache snapshot).
  const [retryCount, setRetryCount] = useState(0);

  const { data: chats, isLoading: chatsLoading } = useQuery<Chat[]>({
    queryKey: ["/api/chats"],
  });

  useEffect(() => {
    if (chatsLoading) return;
    if (redirected.current) return;

    const doRedirect = async () => {
      if (redirected.current) return;
      redirected.current = true;

      try {
        // ── Fix 4: Reuse the session workspace chat if we already have one ──────
        // queryClient.clear() on logout wipes this automatically.
        const sessionChatId = queryClient.getQueryData<string>(WS_CHAT_KEY);
        if (sessionChatId) {
          try {
            // Verify it still exists (may have been deleted)
            await apiRequest("GET", `/api/chats/${sessionChatId}`);
            setLocation(`/chat/${sessionChatId}`);
            return;
          } catch {
            // Gone — clear the stale pointer and fall through to normal flow
            queryClient.removeQueries({ queryKey: WS_CHAT_KEY });
          }
        }

        // ── Case 1: No chats at all → create a fresh blank one ──────────────
        if (!chats || chats.length === 0) {
          const chat = await apiRequest<Chat>("POST", "/api/chats", {
            title: "New Analysis",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
          queryClient.setQueryData<string>(WS_CHAT_KEY, chat.id);
          setLocation(`/chat/${chat.id}`);
          return;
        }

        // ── Case 2: Most recent chat is still blank → reuse it ──────────────
        // chats ordered by createdAt DESC so index 0 is the newest.
        const mostRecent = chats[0];
        let hasMessages = false;
        try {
          const result = await apiRequest<{
            hasMessages: boolean;
            messageCount: number;
          }>("GET", `/api/chats/${mostRecent.id}/has-messages`);
          hasMessages = result.hasMessages;
        } catch {
          // Check failed (network blip, stale ID) — reuse conservatively
          queryClient.setQueryData<string>(WS_CHAT_KEY, mostRecent.id);
          setLocation(`/chat/${mostRecent.id}`);
          return;
        }

        if (!hasMessages) {
          queryClient.setQueryData<string>(WS_CHAT_KEY, mostRecent.id);
          setLocation(`/chat/${mostRecent.id}`);
        } else {
          // ── Case 3: Most recent has messages → create a new blank one ────────
          const chat = await apiRequest<Chat>("POST", "/api/chats", {
            title: "New Analysis",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
          queryClient.setQueryData<string>(WS_CHAT_KEY, chat.id);
          setLocation(`/chat/${chat.id}`);
        }
      } catch (err: unknown) {
        console.error("[Dashboard] Redirect failed:", err);
        // Reset guard so the retry path can run again
        redirected.current = false;

        // ── Fix 2: Smarter error handling — don't show a fatal screen for
        // transient failures. Parse the status code out of the error message
        // (apiRequest throws `new Error("STATUS: text")`).
        const status =
          err instanceof Error
            ? parseInt(err.message.split(":")[0], 10)
            : NaN;

        if (status === 401 || status === 403) {
          // Session expired or unauthorised — go back to sign-in
          setLocation("/");
          return;
        }

        if (status === 429) {
          // Rate-limited — show a brief message then auto-retry
          setError("Too many requests — retrying in a moment…");
          setTimeout(() => {
            setError(null);
            redirected.current = false;
            setRetryCount((c) => c + 1);
          }, 2500);
          return;
        }

        // Genuine failure — show error + working Retry button
        setError("Something went wrong loading your workspace. Please try again.");
      }
    };

    // 300 ms settle debounce: lets any in-flight sidebar chat-creation
    // mutations finish before Dashboard decides which chat to open.
    const timer = setTimeout(doRedirect, 300);
    return () => clearTimeout(timer);
    // Fix 3: retryCount in deps so the effect re-fires when Retry is clicked
  }, [chats, chatsLoading, setLocation, retryCount]);

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-primary/10">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <p className="text-sm text-destructive">{error}</p>
          <button
            className="text-sm text-primary underline underline-offset-2 hover:text-primary/80"
            onClick={() => {
              setError(null);
              redirected.current = false;
              queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
              // Fix 3: increment retryCount to force the useEffect to re-run
              // even if the chats query returns the same cached snapshot (304)
              setRetryCount((c) => c + 1);
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  return (
    <div className="h-full flex items-center justify-center bg-primary/10">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}
