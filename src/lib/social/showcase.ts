import { useSyncExternalStore } from "react";
import { socialPost } from "@/lib/social/client";
import type { ProfileSummary } from "@/views/profile/profile-types";

type ShowcaseKind = "favorite" | "top-genre" | "pinned";

export type SetShowcaseInput = {
  metaId?: string;
  title: string;
  posterUrl?: string;
  kind?: ShowcaseKind;
  caption?: string;
};

let currentMetaId: string | undefined;
const listeners = new Set<() => void>();

function setLocal(metaId: string | undefined) {
  if (currentMetaId === metaId) return;
  currentMetaId = metaId;
  for (const fn of listeners) fn();
}

export function seedShowcaseMetaId(metaId: string | undefined) {
  setLocal(metaId);
}

export function useShowcaseMetaId(): string | undefined {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => currentMetaId,
    () => currentMetaId,
  );
}

export async function setShowcase(input: SetShowcaseInput): Promise<ProfileSummary> {
  const summary = await socialPost<ProfileSummary>("/social/profile/showcase", {
    kind: input.kind ?? "pinned",
    title: input.title,
    metaId: input.metaId,
    posterUrl: input.posterUrl,
    caption: input.caption,
  });
  setLocal(summary.showcase?.metaId ?? input.metaId);
  return summary;
}

export async function setThemeShowcase(themeId: string): Promise<ProfileSummary> {
  const summary = await socialPost<ProfileSummary>("/social/profile/showcase", {
    kind: "theme",
    themeId,
  });
  setLocal(undefined);
  return summary;
}

export async function clearShowcase(): Promise<ProfileSummary> {
  const summary = await socialPost<ProfileSummary>("/social/profile/showcase", { clear: true });
  setLocal(undefined);
  return summary;
}
