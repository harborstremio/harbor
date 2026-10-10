import { PRODUCT_NAME } from "@/lib/i18n/brand";
import { parseExternalLink } from "./external-link-policy.ts";

export type ExternalUrlOpenAdapter = {
  isTauri: boolean;
  openTauri: (href: string) => Promise<void>;
  openWeb: (href: string, target: string, features: string) => void;
};

export async function openExternalUrlStrict(
  rawUrl: string,
  adapter: ExternalUrlOpenAdapter,
): Promise<void> {
  const parsed = parseExternalLink(rawUrl);
  if (!parsed.ok) throw new Error(`${PRODUCT_NAME} requires a valid external link.`);
  if (adapter.isTauri) {
    await adapter.openTauri(parsed.link.href);
    return;
  }
  adapter.openWeb(parsed.link.href, "_blank", "noopener,noreferrer");
}
