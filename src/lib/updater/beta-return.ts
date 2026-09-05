import { experimentalChannelVersion, experimentalPayloadVersion } from "./experimental";
import type { HandoffPlan, HandoffProbe } from "./handoff";
import { UPDATE_CHANNEL_KEY } from "./channel";

export const BETA_RETURN_KEY = "harbor.update.beta-return.v1";
export type BetaReturnTarget = HandoffPlan & { recoveryProtocol: 1 };
export type BetaReturnContext = {
  version: string;
  experimentalVersion: string;
  buildId: string;
  platformKey: string;
  targets: BetaReturnTarget[];
};

// This is an explicit publisher attestation for this exact source build, not
// a conclusion drawn from the version number or the ordinary beta history.
export function parseBetaReturnTargets(
  raw: unknown,
  sourceVersion: string,
  platformKey: string,
): BetaReturnTarget[] {
  if (platformKey !== "windows-x86_64" || !Array.isArray(raw) || raw.length > 10) return [];
  const source = experimentalPayloadVersion(sourceVersion);
  if (source === null) return [];
  const seen = new Set<string>();
  const targets: BetaReturnTarget[] = [];
  for (const value of raw) {
    if (!value || typeof value !== "object") return [];
    const v = value as Record<string, unknown>;
    if (v.platformKey !== platformKey) continue;
    const payload = typeof v.version === "string" ? experimentalPayloadVersion(v.version) : null;
    if (
      v.channel !== "beta" ||
      v.dataCompatible !== true ||
      v.recoveryProtocol !== 1 ||
      typeof v.version !== "string" ||
      payload === null ||
      payload >= source ||
      v.payloadVersion !== payload ||
      seen.has(v.version) ||
      typeof v.url !== "string" ||
      typeof v.signature !== "string" ||
      !v.signature.trim() ||
      typeof v.size !== "number" ||
      !Number.isSafeInteger(v.size) ||
      v.size <= 0
    )
      return [];
    try {
      const url = new URL(v.url);
      if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search)
        return [];
      targets.push({
        version: v.version,
        notes: typeof v.notes === "string" ? v.notes : null,
        url: url.href,
        signature: v.signature.trim(),
        size: v.size,
        payloadVersion: payload,
        verifiable: true,
        recoveryProtocol: 1,
      });
      seen.add(v.version);
    } catch {
      return [];
    }
  }
  return targets.sort((a, b) => b.payloadVersion - a.payloadVersion);
}

export function betaReturnSupported(probe: HandoffProbe | null): boolean {
  return !!probe?.supported && probe.managed && probe.platformKey === "windows-x86_64";
}

export function readBetaReturnContext(installed?: string): BetaReturnContext | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(installed ? `${BETA_RETURN_KEY}.${installed}` : BETA_RETURN_KEY) ??
        "null",
    );
    if (
      !value ||
      typeof value.version !== "string" ||
      typeof value.experimentalVersion !== "string" ||
      experimentalChannelVersion(value.experimentalVersion) === null ||
      typeof value.buildId !== "string" ||
      !/^[A-Za-z0-9][\w.-]{0,79}$/.test(value.buildId) ||
      value.buildId.includes("..") ||
      value.platformKey !== "windows-x86_64"
    )
      return null;
    const targets = parseBetaReturnTargets(value.returnToBeta, value.version, value.platformKey);
    return targets.length ? { ...value, targets } : null;
  } catch {
    return null;
  }
}

export function saveBetaReturnContext(
  version: string,
  experimentalVersion: string,
  buildId: string,
  platformKey: string,
  returnToBeta: unknown,
): void {
  if (!parseBetaReturnTargets(returnToBeta, version, platformKey).length) {
    throw new Error("No tested return to beta is available for this build.");
  }
  const raw = JSON.stringify({ version, experimentalVersion, buildId, platformKey, returnToBeta });
  localStorage.setItem(`${BETA_RETURN_KEY}.${version}`, raw);
  localStorage.setItem(BETA_RETURN_KEY, raw);
}

export function returnedToExactVersion(installed: string | null, target: string): boolean {
  // >= would report a failed downgrade as successful while experimental was
  // still installed. A return must launch the exact approved target.
  return installed === target;
}

// Run before SettingsProvider reads any profile. Updating only the legacy
// mirror would be overwritten by its shared/profile store on the first render.
export function completeBetaReturnPreferences(installed: string): boolean {
  const originals = new Map<string, string | null>();
  try {
    const pending = JSON.parse(localStorage.getItem("harbor.update.pending") ?? "null");
    if (pending?.intent !== "return-beta") return true;
    if (pending.version !== installed) {
      // The native installer restored the previous application after a failed
      // launch. Undo only channel flags, never the user's settings or progress.
      if (pending.returnPreferenceUndo) {
        for (const [key, betaUpdates] of Object.entries(pending.returnPreferenceUndo.flags)) {
          if (
            (key !== "harbor.settings" && !key.startsWith("harbor.settings.")) ||
            typeof betaUpdates !== "boolean"
          ) {
            throw new Error("Invalid channel recovery flags");
          }
          const value = JSON.parse(localStorage.getItem(key) ?? "null");
          if (value && typeof value === "object")
            localStorage.setItem(key, JSON.stringify({ ...value, betaUpdates }));
        }
        const channel = pending.returnPreferenceUndo.channel;
        if (channel === null) localStorage.removeItem(UPDATE_CHANNEL_KEY);
        else localStorage.setItem(UPDATE_CHANNEL_KEY, channel);
        const { returnPreferenceUndo: _restored, ...rest } = pending;
        localStorage.setItem("harbor.update.pending", JSON.stringify(rest));
      }
      return true;
    }
    const writes = new Map<string, string>();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || (key !== "harbor.settings" && !key.startsWith("harbor.settings."))) continue;
      const raw = localStorage.getItem(key);
      const value = JSON.parse(raw ?? "null");
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        typeof value.betaUpdates !== "boolean"
      )
        continue;
      writes.set(key, JSON.stringify({ ...value, betaUpdates: true }));
    }
    if (!pending.returnPreferenceUndo) {
      const flags: Record<string, boolean> = {};
      for (const key of writes.keys())
        flags[key] = JSON.parse(localStorage.getItem(key) ?? "{}").betaUpdates;
      localStorage.setItem(
        "harbor.update.pending",
        JSON.stringify({
          ...pending,
          returnPreferenceUndo: { channel: localStorage.getItem(UPDATE_CHANNEL_KEY), flags },
        }),
      );
    }
    writes.set(UPDATE_CHANNEL_KEY, JSON.stringify({ channel: "beta", normal: "beta" }));
    for (const [key, value] of writes) {
      originals.set(key, localStorage.getItem(key));
      localStorage.setItem(key, value);
    }
    return true;
  } catch {
    for (const [key, value] of originals) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        /* Retain pending state; do not acknowledge the installation. */
      }
    }
    return false;
  }
}
