import type { Express } from "express";
import { isIP } from "node:net";

export function configureTrustedProxy(app: Express, cidrs?: string) {
  if (!cidrs?.trim()) {
    // Preserve the deployed secure-cookie/SSO path until operations supplies
    // Bosch's actual proxy networks. This compatibility mode is not proof of
    // correct edge configuration; account budgets never depend on forwarded IP.
    app.set("trust proxy", 1);
    return "compatibility-one-hop";
  }
  const networks = cidrs.split(",").map((value) => value.trim());
  for (const network of networks) {
    const [address, prefix, extra] = network.split("/");
    const family = isIP(address);
    if (!family || extra !== undefined || (prefix !== undefined
      && (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (family === 4 ? 32 : 128)))) {
      throw new Error("TRUSTED_PROXY_CIDRS must contain explicit IP addresses/CIDRs, not wildcard trust or hop counts");
    }
  }
  app.set("trust proxy", networks);
  return "explicit-proxy-networks";
}
