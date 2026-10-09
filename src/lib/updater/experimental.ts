import type { HandoffPlan, HandoffProbe } from "./handoff";

type Artifact = { url: string; signature: string };
type InstallerArtifact = Artifact & { payloadVersion: number; size: number; recoveryProtocol?: 1 };
export type ExperimentalRelease = {
  version: string;
  experimentalVersion: string;
  buildId: string;
  notes: string | null;
  artifact: Artifact;
  installer: InstallerArtifact | null;
  returnToBeta?: unknown;
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function artifact(value: unknown): Artifact | null {
  const entry = object(value);
  if (typeof entry?.url !== "string" || typeof entry.signature !== "string") return null;
  if (!entry.signature.trim()) return null;
  try {
    const url = new URL(entry.url);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    return { url: url.href, signature: entry.signature.trim() };
  } catch {
    return null;
  }
}

// Keep the installed marker formula unchanged. Suffix-only versions cannot
// identify successive payloads, so experimental publishing needs unique triplets.
export function experimentalPayloadVersion(version: string): number | null {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.exec(version);
  if (!match) return null;
  const value = Number(match[1]) * 1_000_000 + Number(match[2]) * 1_000 + Number(match[3]);
  return Number.isSafeInteger(value) ? value : null;
}

export function experimentalChannelVersion(version: string): number | null {
  const value = experimentalPayloadVersion(version);
  return value !== null && value > 0 && value < 1_000_000 ? value : null;
}

export function parseExperimentalRelease(
  raw: unknown,
  platformKey: string,
): ExperimentalRelease | null {
  const manifest = object(raw);
  if (manifest?.channel !== "experimental" || typeof manifest.version !== "string") return null;
  if (manifest.withdrawn === true) return null;
  if (!/^(windows|darwin)-(x86_64|aarch64)$/.test(platformKey)) return null;
  // Do not let Tauri choose a top-level dynamic artifact instead of the
  // platform entry that this preflight validated.
  if ("url" in manifest || "signature" in manifest) return null;
  const payloadVersion = experimentalPayloadVersion(manifest.version);
  if (payloadVersion === null) return null;
  if (
    typeof manifest.experimentalVersion !== "string" ||
    experimentalChannelVersion(manifest.experimentalVersion) === null
  )
    return null;
  if (typeof manifest.buildId !== "string" || !/^[\w.-]{1,80}$/.test(manifest.buildId)) return null;
  const platform = artifact(object(manifest.platforms)?.[platformKey]);
  if (!platform) return null;
  const installers = object(manifest.installer);
  if (manifest.installer !== undefined && !installers) return null;
  let installer: InstallerArtifact | null = null;
  if (installers && Object.hasOwn(installers, platformKey)) {
    const entry = object(installers[platformKey]);
    const setup = artifact(entry);
    if (
      !setup ||
      entry?.payloadVersion !== payloadVersion ||
      typeof entry.size !== "number" ||
      !Number.isSafeInteger(entry.size) ||
      entry.size <= 0
    )
      return null;
    installer = {
      ...setup,
      size: entry.size,
      payloadVersion,
      ...(entry.recoveryProtocol === 1 ? { recoveryProtocol: 1 as const } : {}),
    };
  }
  return {
    version: manifest.version,
    experimentalVersion: manifest.experimentalVersion,
    buildId: manifest.buildId,
    notes: typeof manifest.notes === "string" ? manifest.notes : null,
    artifact: platform,
    installer,
    returnToBeta: manifest.returnToBeta,
  };
}

export function sameExperimentalRelease(a: ExperimentalRelease, b: ExperimentalRelease): boolean {
  return (
    a.version === b.version &&
    a.experimentalVersion === b.experimentalVersion &&
    a.buildId === b.buildId &&
    a.artifact.url === b.artifact.url &&
    a.artifact.signature === b.artifact.signature
  );
}

export function experimentalHandoff(
  release: ExperimentalRelease,
  probe: HandoffProbe,
): HandoffPlan | null {
  const entry = release.installer;
  if (!probe.supported || !entry || entry.payloadVersion <= probe.payloadVersion) {
    return null;
  }
  return {
    version: release.version,
    notes: release.notes,
    ...entry,
    verifiable: true,
  };
}
