// Families of Record<string, { t: number }> documents merged entry-wise by
// their newest timestamp instead of last-write-wins.
const ENTRY_MERGE_BASES = ["harbor.localcw.v1", "harbor.downloads.catalog.v1"] as const;

type LocalCwRecord = Record<string, Record<string, unknown> & { t: number }>;

function isLocalCwRecord(value: unknown): value is LocalCwRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  for (const entry of Object.values(value)) {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      !("t" in entry) ||
      typeof entry.t !== "number"
    ) {
      return false;
    }
  }

  return true;
}

function parseLocalCw(value: string | null): LocalCwRecord | null {
  if (value === null) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return isLocalCwRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function mergeDoc(
  key: string,
  localValue: string | null,
  remoteValue: string | null,
  localNewer: boolean,
): string | null {
  const lww = localNewer ? localValue : remoteValue;
  const entryMerged = ENTRY_MERGE_BASES.some((base) => key === base || key.startsWith(`${base}.`));
  if (!entryMerged) return lww;

  const local = parseLocalCw(localValue);
  const remote = parseLocalCw(remoteValue);
  if (!local || !remote) return lww;

  const merged: LocalCwRecord = { ...remote };
  for (const [id, entry] of Object.entries(local)) {
    if (!merged[id] || entry.t >= merged[id].t) merged[id] = entry;
  }

  return JSON.stringify(merged);
}
