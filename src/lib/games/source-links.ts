import { CLOUD_PROVIDERS, type CloudKeys } from "./cloud-files";
import type { DownloadGame } from "./transfers";

export const SOURCE_LINK_PROVIDERS = ["rd", "tb", "pm", "ad"] as const;
export type SourceLinkProvider = typeof SOURCE_LINK_PROVIDERS[number];
export const SOURCE_LINK_SERVICES = [...CLOUD_PROVIDERS, { id: "ad" as const, name: "AllDebrid" }];
export type SourceLink = { url: string; title: string; game?: DownloadGame };
export const connectedSourceLinkProviders = (keys: CloudKeys) => SOURCE_LINK_PROVIDERS.filter(provider => !!keys[provider]?.trim());
export function sourceLinkError(reason: unknown) {
  const code = reason instanceof Error ? reason.message : String(reason);
  const key = code === "cloud_key" ? "account" : code === "cloud_rate_limit" ? "rate" : code === "cloud_limit" ? "limit" : code === "cloud_missing" ? "empty" : code === "cloud_link" || code === "cloud_metadata" ? "invalid" : "failed";
  return `games.sources.links.${key}`;
}
