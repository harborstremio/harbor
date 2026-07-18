import { resolveAddonLogo } from "@/components/addon-logo";
import type { Addon } from "@/lib/addons";
import { hostOf, type SaveResult, type SaveStep } from "@/lib/addons-store/reorder";
import { t } from "@/lib/i18n";
import type { OrganizeEntry } from "./section-card";

export type Notice = { tone: "info" | "danger"; text: string; retry?: boolean; reload?: boolean };

export function stepLabel(step: SaveStep): string {
  switch (step) {
    case "checking":
      return t("Checking");
    case "saving":
      return t("Saving");
    case "verifying":
      return t("Verifying");
  }
}

export function urlsOf(items: Array<{ transportUrl: string }>): string[] {
  return items.map((i) => i.transportUrl);
}

export function entriesOf(
  items: Array<{ transportUrl: string; manifest?: Addon["manifest"] }>,
): OrganizeEntry[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const n = seen.get(item.transportUrl) ?? 0;
    seen.set(item.transportUrl, n + 1);
    const host = hostOf(item.transportUrl);
    return {
      key: `${item.transportUrl}#${n}`,
      name: item.manifest?.name ?? host,
      host,
      addonId: item.manifest?.id ?? item.transportUrl,
      logo: resolveAddonLogo(item.manifest?.logo, item.transportUrl),
    };
  });
}

export function noticeFor(result: Exclude<SaveResult, { ok: true }>): Notice {
  switch (result.stage) {
    case "validate":
      return {
        tone: "danger",
        text: t("Couldn't save: the reordered list failed safety validation. Nothing was written."),
        reload: true,
      };
    case "fetch":
      return {
        tone: "danger",
        text: t("Couldn't reach Stremio to confirm your collection. Nothing was written."),
        retry: true,
      };
    case "stale":
      return {
        tone: "danger",
        text: t("Your addon collection changed on another device. Nothing was written."),
        reload: true,
      };
    case "write":
      return {
        tone: "danger",
        text: t(
          "Stremio didn't confirm the save. Your collection may be unchanged. Retry will re-check before writing again.",
        ),
        retry: true,
      };
    case "verify":
      return result.current == null
        ? {
            tone: "danger",
            text: t("Saved, but Harbor couldn't confirm the new order. Retry to re-check."),
            retry: true,
          }
        : {
            tone: "danger",
            text: t("Stremio reports a different order than was saved."),
            retry: true,
            reload: true,
          };
  }
}
