import type { AnilistMediaDetails } from "@/lib/anilist/media-details";
import { useT } from "@/lib/i18n";

type TitleRow = { label: string; value: string; muted?: boolean };

function isNew(value: string | undefined, primary: string, seen: Set<string>): value is string {
  if (!value) return false;
  const key = value.trim().toLowerCase();
  if (!key || key === primary) return false;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

export function AnimeTitlesBlock({
  details,
  primaryTitle,
}: {
  details: AnilistMediaDetails;
  primaryTitle: string;
}) {
  const t = useT();
  const primary = primaryTitle.trim().toLowerCase();
  const seen = new Set<string>();
  const rows: TitleRow[] = [];
  if (isNew(details.nativeTitle, primary, seen)) {
    rows.push({ label: t("Native Title"), value: details.nativeTitle, muted: true });
  }
  if (isNew(details.romajiTitle, primary, seen)) {
    rows.push({ label: t("Romaji"), value: details.romajiTitle });
  }
  if (isNew(details.englishTitle, primary, seen)) {
    rows.push({ label: t("English"), value: details.englishTitle });
  }
  if (details.synonyms.length) {
    rows.push({ label: t("Also Known As"), value: details.synonyms.slice(0, 4).join("  •  ") });
  }

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
            {row.label}
          </span>
          <span className={row.muted ? "text-[13.5px] text-ink-muted" : "text-[13.5px] text-ink"}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
