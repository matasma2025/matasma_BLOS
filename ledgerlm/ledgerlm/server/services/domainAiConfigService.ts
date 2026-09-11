import { storage } from "../storage";
import { decryptValue } from "../utils/encryption";
import type { DomainAiConfig } from "../openai";

/**
 * Resolve AI configuration only from the authenticated user's active domain.
 * Provider credentials never leave this server-side service.
 */
export async function resolveDomainAiConfigForUser(userId: string): Promise<DomainAiConfig | undefined> {
  const user = await storage.getUser(userId);
  if (!user) return undefined;

  const membership = await storage.getDomainUserByEmail(user.username.toLowerCase());
  if (!membership || membership.status !== "active") return undefined;

  const domain = await storage.getDomain(membership.domainId);
  if (!domain?.aiProvider || !domain.aiEndpoint) return undefined;

  const authMethod = domain.aiAuthMethod || "api_key";
  const keyless = authMethod === "entra_id" || authMethod === "private_endpoint";
  if (!keyless && !domain.aiApiKey) return undefined;

  return {
    provider: domain.aiProvider === "azure_openai" ? "azure_openai" : "ollama",
    authMethod: authMethod as DomainAiConfig["authMethod"],
    endpoint: domain.aiEndpoint,
    apiKey: domain.aiApiKey ? decryptValue(domain.aiApiKey) : undefined,
    chatModel: domain.aiChatModel ?? undefined,
    chatApiVersion: domain.aiChatApiVersion ?? undefined,
    systemPrompt: domain.aiSystemPrompt ?? undefined,
  };
}