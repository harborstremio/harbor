export type ProviderSubtitleFlags = {
  hearingImpaired?: unknown;
  hearing_impaired?: unknown;
  hi?: unknown;
  sdh?: unknown;
  forced?: unknown;
  foreignOnly?: unknown;
  foreign_only?: unknown;
  foreignParts?: unknown;
  foreign_parts?: unknown;
  machineTranslated?: unknown;
  machine_translated?: unknown;
  aiTranslated?: unknown;
  ai_translated?: unknown;
};

export type SubtitleClassification = {
  hearingImpaired?: boolean;
  forced?: boolean;
  foreignOnly?: boolean;
  machineTranslated?: boolean;
};

function providerBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number" && (value === 0 || value === 1)) return value === 1;
    if (typeof value !== "string") continue;
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
  }
  return undefined;
}

function descriptorOf(labels: readonly (string | null | undefined)[]): string {
  return labels
    .filter((label): label is string => Boolean(label?.trim()))
    .join(" ")
    .toLowerCase()
    .replace(/[._\-/\\()[\]]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Provider booleans win; filename/release tags are only a fallback when metadata is absent. */
export function classifyProviderSubtitleMetadata(
  metadata: ProviderSubtitleFlags,
  labels: readonly (string | null | undefined)[] = [],
): SubtitleClassification {
  const descriptor = descriptorOf(labels);
  const hearingImpaired = providerBoolean(
    metadata.hearingImpaired,
    metadata.hearing_impaired,
    metadata.hi,
    metadata.sdh,
  );
  const forced = providerBoolean(metadata.forced);
  const foreignOnly = providerBoolean(
    metadata.foreignOnly,
    metadata.foreign_only,
    metadata.foreignParts,
    metadata.foreign_parts,
  );
  const machineTranslated = providerBoolean(
    metadata.machineTranslated,
    metadata.machine_translated,
    metadata.aiTranslated,
    metadata.ai_translated,
  );

  return {
    hearingImpaired:
      hearingImpaired ??
      (/(?:^|\s)(?:sdh|hearing impaired|closed captions?)(?:\s|$)/u.test(descriptor) || undefined),
    forced: forced ?? (/(?:^|\s)(?:forced|foreign parts?)(?:\s|$)/u.test(descriptor) || undefined),
    foreignOnly:
      foreignOnly ?? (/(?:^|\s)foreign (?:only|parts?)(?:\s|$)/u.test(descriptor) || undefined),
    machineTranslated:
      machineTranslated ??
      (/(?:^|\s)(?:machine|ai) translat(?:ed|ion)(?:\s|$)/u.test(descriptor) || undefined),
  };
}
