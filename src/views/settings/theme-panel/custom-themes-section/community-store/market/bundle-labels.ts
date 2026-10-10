import { ALL_BADGE_KINDS, badgeLabel, type BadgeKind } from "@/components/format-badge";
import { AWARD_ICON_REGISTRY } from "@/lib/award-icons";
import type { BundleKind } from "@/lib/bundle-store";

const awardLabels = new Map<string, string>();
for (const group of AWARD_ICON_REGISTRY) {
  for (const item of group.items) awardLabels.set(item.key, item.label);
}

const badgeKeys = new Set<string>(ALL_BADGE_KINDS);

function titleize(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function labelForIcon(kind: BundleKind, key: string): string {
  if (kind === "badge") {
    return badgeKeys.has(key) ? badgeLabel(key as BadgeKind) : titleize(key);
  }
  return awardLabels.get(key) ?? titleize(key);
}
