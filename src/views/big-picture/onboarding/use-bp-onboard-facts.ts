import { useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import { getUpvotedIds, subscribePrefs } from "@/lib/feed/preferences";
import { useSettings } from "@/lib/settings";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";

export type BpOnboardFacts = {
  uiLanguage: string;
  tmdbKey: string;
  stremioName: string | null;
  stremioEmail: string | null;
  harborName: string | null;
  homeMode: "harbor" | "classic";
  servicesOn: number;
  subLangs: string[];
  tastePicks: number;
};

function tasteCount(): number {
  return getUpvotedIds().size;
}

/** What the screens need to know about what is already set. Read only. */
export function useBpOnboardFacts(): BpOnboardFacts {
  const { settings } = useSettings();
  const { user } = useAuth();
  const author = useSyncExternalStore(subscribeAuthor, currentAuthor, currentAuthor);
  const picks = useSyncExternalStore(subscribePrefs, tasteCount, tasteCount);

  return {
    uiLanguage: settings.uiLanguage,
    tmdbKey: settings.tmdbKey,
    stremioName: user ? user.fullname || user.email || null : null,
    stremioEmail: user ? user.email || null : null,
    harborName: author ? author.handle || author.username : null,
    homeMode: settings.homeMode,
    servicesOn: Object.values(settings.streaming).filter(Boolean).length,
    subLangs: settings.preferredSubLangs,
    tastePicks: picks,
  };
}
