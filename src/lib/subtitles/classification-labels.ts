export type SubtitleClassificationLabelKind =
  | "hearingImpaired"
  | "forced"
  | "foreignOnly"
  | "machineTranslated";

export type SubtitleClassificationFlags = Partial<Record<SubtitleClassificationLabelKind, boolean>>;

export type SubtitleClassificationLabel = {
  kind: SubtitleClassificationLabelKind;
  label: string;
};

type Translate = (key: string) => string;
const MACHINE_TRANSLATED_COMPACT = "MT";

export function subtitleClassificationLabels(
  flags: SubtitleClassificationFlags,
  t: Translate,
  presentation: "full" | "compact" = "full",
): SubtitleClassificationLabel[] {
  const labels: SubtitleClassificationLabel[] = [];
  if (flags.hearingImpaired) {
    labels.push({
      kind: "hearingImpaired",
      label: presentation === "compact" ? t("HI/SDH") : t("Hearing impaired"),
    });
  }
  if (flags.forced) labels.push({ kind: "forced", label: t("Forced") });
  if (flags.foreignOnly) labels.push({ kind: "foreignOnly", label: t("Foreign-only") });
  if (flags.machineTranslated) {
    labels.push({
      kind: "machineTranslated",
      label: presentation === "compact" ? t(MACHINE_TRANSLATED_COMPACT) : t("Machine-translated"),
    });
  }
  return labels;
}
