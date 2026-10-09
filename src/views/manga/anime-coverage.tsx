import { type ReactNode } from "react";
import { t as translate, useT } from "@/lib/i18n";
import type { MangaChapter } from "@/lib/manga/api";
import type { MangaUpdatesInfo } from "@/lib/manga/mangaupdates";

export type Coverage = {
  start?: string;
  end?: string;
  jumpIndex?: number;
  resumeLabel?: string;
  endChapter?: number;
};

function formatChapter(num: number): string {
  return translate("Chapter {n}", { n: Number.isInteger(num) ? num : num.toFixed(1) });
}

function lastChapterOf(text?: string): number | null {
  const m = /chap[a-z.]*\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/i.exec(text ?? "");
  const num = m ? parseFloat(m[2] ?? m[1]) : NaN;
  return Number.isFinite(num) ? num : null;
}

function firstChapterAfter(chapters: MangaChapter[], after: number) {
  let index = -1;
  let best = Infinity;
  for (let i = 0; i < chapters.length; i++) {
    const raw = chapters[i].chapter;
    const num = raw == null ? NaN : parseFloat(raw);
    if (!Number.isFinite(num) || num <= after || num >= best) continue;
    best = num;
    index = i;
  }
  return index < 0 ? null : { index, num: best };
}

export function coverageOf(info: MangaUpdatesInfo, chapters: MangaChapter[]): Coverage | null {
  const start = info.animeStart?.trim() || undefined;
  const end = info.animeEnd?.trim() || undefined;
  if (!start && !end) return null;
  const last = lastChapterOf(end);
  if (last == null) return { start, end };
  const next = firstChapterAfter(chapters, last);
  return {
    start,
    end,
    endChapter: last,
    jumpIndex: next?.index,
    resumeLabel: formatChapter(next ? next.num : Math.floor(last) + 1),
  };
}

function strong(text: string): ReactNode {
  return <span className="font-semibold text-ink">{text}</span>;
}

export function AnimeCoverage({
  coverage,
  onReadChapter,
  className,
}: {
  coverage: Coverage;
  onReadChapter: (index: number) => void;
  className?: string;
}) {
  const t = useT();
  const { start, end, jumpIndex, resumeLabel } = coverage;
  const lead = !start
    ? t("The anime adaptation runs through ")
    : end
      ? t("The anime adaptation covers ")
      : t("The anime adaptation starts at ");
  return (
    <div className={`flex flex-col gap-3${className ? ` ${className}` : ""}`}>
      <p className="text-[14px] leading-relaxed text-ink-muted">
        {lead}
        {strong(start ?? end ?? "")}
        {start && end ? <>{t(" through ")}{strong(end)}.</> : "."}
      </p>
      {resumeLabel && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[13px] text-ink-subtle">
            {jumpIndex == null
              ? t("Pick up the manga at {label}.", { label: resumeLabel })
              : t("Pick up the manga where the anime ends.")}
          </span>
          {jumpIndex != null && (
            <button
              type="button"
              onClick={() => onReadChapter(jumpIndex)}
              className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.03] active:scale-[0.97] motion-reduce:transition-none"
            >
              {t("Read {label}", { label: resumeLabel })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
