import type { Settings } from "@/lib/settings/types";
import type { PlayableCopy } from "./types";

export type PlaybackSourceDecision =
  | { kind: "chooser"; reason: "ask" | "missing" | "ambiguous" }
  | { kind: "local" }
  | { kind: "online" }
  | { kind: "home-server"; copy: PlayableCopy };

export function decidePlaybackSource(
  settings: Pick<Settings, "playbackSourcePreference" | "preferredMediaServerId">,
  localCount: number,
  serverCopies: PlayableCopy[],
): PlaybackSourceDecision {
  const preference = settings.playbackSourcePreference;
  if (preference === "online") return { kind: "online" };
  if (localCount === 0 && serverCopies.length === 0) return { kind: "online" };
  if (preference === "ask") return { kind: "chooser", reason: "ask" };
  if (preference === "local")
    return localCount > 0 ? { kind: "local" } : { kind: "chooser", reason: "missing" };
  const copies = settings.preferredMediaServerId
    ? serverCopies.filter((copy) => copy.connectionId === settings.preferredMediaServerId)
    : serverCopies;
  if (copies.length === 0) return { kind: "chooser", reason: "missing" };
  if (copies.length !== 1) return { kind: "chooser", reason: "ambiguous" };
  return { kind: "home-server", copy: copies[0] };
}
