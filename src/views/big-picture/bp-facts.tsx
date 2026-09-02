import { Info } from "lucide-react";
import type { TmdbDetail } from "@/lib/providers/tmdb/tmdb-details";
import { SFX } from "@/lib/sfx";
import { useBpT } from "./bp-i18n";
import { BP_DETAIL_HEADING, BP_DETAIL_TRACK, bpShortDate } from "./detail/bp-detail-chrome";

export type BpFactRow = [label: string, value: string];

function money(n?: number): string {
  if (!n || n <= 0) return "";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${Math.round(n / 1000)}K`;
}

function names(list: Array<{ name: string }>, max = 3): string {
  return list
    .slice(0, max)
    .map((p) => p.name)
    .join(", ");
}

export type BpTranslate = (key: string, vars?: Record<string, string | number>) => string;

export function bpFactRows(detail: TmdbDetail, t: BpTranslate): BpFactRow[] {
  const rows: BpFactRow[] = [];
  const push = (label: string, value: string) => {
    if (value) rows.push([label, value]);
  };

  push(t("Directed by"), names(detail.directors));
  push(t("Created by"), names(detail.creators));
  push(t("Written by"), names(detail.writers));
  push(t("Music by"), names(detail.composer, 2));
  push(t("Cinematography"), names(detail.cinematography, 2));
  push(t("Status"), detail.status);
  if (detail.kind === "tv") {
    push(t("First aired"), bpShortDate(detail.firstAirDate));
    push(t("Last aired"), bpShortDate(detail.lastAirDate));
  } else {
    push(t("Released"), bpShortDate(detail.releaseDate));
  }
  if (detail.kind === "tv" && detail.numberOfEpisodes > 0) {
    push(
      t("Length"),
      `${t("{n} seasons", { n: detail.numberOfSeasons })} · ${t("{n} episodes", { n: detail.numberOfEpisodes })}`,
    );
  } else {
    push(t("Runtime"), detail.runtime ?? "");
  }
  push(t("Network"), detail.networks.slice(0, 2).join(", "));
  push(t("Studio"), detail.productionCompanies.slice(0, 2).join(", "));
  push(t("Country"), detail.productionCountries.slice(0, 2).join(", "));
  push(t("Language"), detail.spokenLanguages.slice(0, 2).join(", "));
  push(t("Genres"), detail.genres.slice(0, 4).join(", "));
  if (detail.originalTitle && detail.originalTitle !== detail.title) {
    push(t("Original title"), detail.originalTitle);
  }
  push(t("Budget"), money(detail.budget));
  push(t("Box office"), money(detail.revenue));
  if (detail.rating) {
    push(
      t("Rating"),
      detail.voteCount > 0
        ? `${detail.rating} · ${t("{n} votes", { n: detail.voteCount.toLocaleString() })}`
        : detail.rating,
    );
  }

  return rows;
}

// Three lines, because a page that answers on arrival beats a page that lets
// you ask. Every one of these is a press away otherwise, and on a remote the
// press is the expensive part.
const PREVIEW = 3;

/**
 * One cell, and that is the whole row.
 *
 * This used to render the fact grid inline as the last rail index on the page,
 * holding no focusable at all. An index with nothing focusable in it is stepped
 * over silently, so the ring stopped on the row above and roughly 178px of
 * scroll below it could never be consumed by a D-pad: every line of it was
 * unreachable on a television. The grid also floored to a 10px uppercase label
 * at 641px, which is under any ten-foot floor even once you can reach it.
 *
 * That was answered with a chip reading "Details", which is reachable and says
 * nothing: an unlabelled door at the bottom of a page nobody scrolls to. So the
 * cell shows the head of the payload at the SAME type scale the panel uses,
 * bp-facts-dialog.tsx:23-28, and names how much is behind it. Keep exactly one
 * focusable here: the rail index is positional, and the lines are read, not
 * operated, so they must not become cells of their own.
 */
export function BpFacts({ detail, onOpen }: { detail: TmdbDetail; onOpen: () => void }) {
  const t = useBpT();
  const rows = bpFactRows(detail, t);
  if (rows.length === 0) return null;

  const shown = rows.slice(0, PREVIEW);
  const rest = rows.length - shown.length;

  return (
    <section data-bp-row data-bp-row-key="facts" className="relative">
      <h2 className={BP_DETAIL_HEADING}>{t("Details")}</h2>
      <div data-bp-scroll-x className={BP_DETAIL_TRACK}>
        <button
          type="button"
          data-bp-focusable
          data-bp-tile="wide"
          data-bp-restore-key="detail-facts"
          onClick={() => {
            SFX.open();
            onOpen();
          }}
          aria-label={t("All details")}
          className="flex shrink-0 flex-col gap-[clamp(5px,0.7vh,11px)] rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] p-[clamp(16px,1.6vw,30px)] text-start"
          style={{ width: "min(58vw, 780px)" }}
        >
          {shown.map(([label, value]) => (
            <span key={label} className="flex w-full items-baseline gap-[clamp(12px,1.4vw,28px)]">
              <span className="w-[clamp(118px,12vw,220px)] shrink-0 text-[clamp(11px,1.45vh,17px)] font-bold uppercase tracking-[0.15em] text-ink-subtle">
                {label}
              </span>
              {/* truncate, not line-clamp-1: a -webkit-box child under
                  items-baseline aligns off its own box rather than its text,
                  and every one of these lines is a single line by design. */}
              <span className="min-w-0 flex-1 truncate text-[clamp(14px,2vh,24px)] font-semibold leading-snug text-ink">
                {value}
              </span>
            </span>
          ))}
          <span className="flex items-center gap-[clamp(9px,0.8vw,15px)] pt-[clamp(4px,0.6vh,10px)] text-[clamp(12.5px,1.78vh,20px)] font-semibold text-ink-muted">
            <Info size={20} strokeWidth={2.1} className="shrink-0" />
            {rest > 0 ? t("{n} more details", { n: rest }) : t("All details")}
          </span>
        </button>
      </div>
    </section>
  );
}
