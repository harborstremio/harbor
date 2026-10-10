import type { Account } from "../debrid/types.ts";

export type JlDebridService = "realdebrid" | "torbox";

export type JlDebridOption = {
  id: JlDebridService;
  label: string;
  settingsKey: "rdKey" | "tbKey";
  keyUrl: string;
  keyHint: string;
};

export const JL_DEBRID_OPTIONS: readonly JlDebridOption[] = [
  {
    id: "realdebrid",
    label: "Real-Debrid",
    settingsKey: "rdKey",
    keyUrl: "https://real-debrid.com/apitoken",
    keyHint: "Private API token",
  },
  {
    id: "torbox",
    label: "TorBox",
    settingsKey: "tbKey",
    keyUrl: "https://torbox.app/settings",
    keyHint: "API key",
  },
];

// The bare manifest carries no debrid configuration; keys stay with the local
// debrid resolvers instead of being embedded in a third-party addon URL.
export const JL_TORRENTIO_MANIFEST_URL = "https://torrentio.strem.fun/manifest.json";
export const JL_TORRENTIO_ADDON_ID = "com.stremio.torrentio.addon";

export type DebridVerification =
  | { state: "empty" }
  | { state: "saved" }
  | { state: "checking" }
  | { state: "verified"; account: Pick<Account, "premium" | "premiumUntil" | "username"> }
  | { state: "rejected" }
  | { state: "unreachable" };

export type DebridStatusTone = "neutral" | "good" | "warn" | "bad";

export type DebridStatus = {
  label: string;
  vars?: Record<string, string | number>;
  tone: DebridStatusTone;
};

const DAY_SECONDS = 24 * 60 * 60;

export function describeDebridVerification(v: DebridVerification, nowMs: number): DebridStatus {
  switch (v.state) {
    case "empty":
      return { label: "Not connected", tone: "neutral" };
    case "saved":
      return { label: "Key saved — not verified", tone: "warn" };
    case "checking":
      return { label: "Checking", tone: "neutral" };
    case "rejected":
      return { label: "Key rejected", tone: "bad" };
    case "unreachable":
      return { label: "Key saved — service unreachable", tone: "warn" };
    case "verified": {
      const { premium, premiumUntil } = v.account;
      if (!premium) return { label: "Connected — no active premium plan", tone: "warn" };
      if (premiumUntil == null) return { label: "Connected — premium", tone: "good" };
      const days = Math.max(0, Math.floor((premiumUntil - Math.floor(nowMs / 1000)) / DAY_SECONDS));
      return { label: "Connected — premium, {days} days left", vars: { days }, tone: "good" };
    }
  }
}

// Debrid APIs answer a bad token with 401/403; anything else (network, 5xx,
// proxy refusal) says nothing about the key itself.
export function verificationFromFailure(status: number): DebridVerification {
  return status === 401 || status === 403 ? { state: "rejected" } : { state: "unreachable" };
}

export type JlOnboardingSummary = {
  playlists: number;
  debrid: JlDebridService[];
  torrentio: boolean;
};

export function summarizeJlSetup(input: {
  playlists: Array<{ kind?: "m3u" | "xtream" | "epg" }>;
  rdKey: string;
  tbKey: string;
  torrentioInstalled: boolean;
}): JlOnboardingSummary {
  const debrid: JlDebridService[] = [];
  if (input.rdKey.trim()) debrid.push("realdebrid");
  if (input.tbKey.trim()) debrid.push("torbox");
  return {
    playlists: input.playlists.filter((p) => (p.kind ?? "m3u") !== "epg").length,
    debrid,
    torrentio: input.torrentioInstalled,
  };
}
