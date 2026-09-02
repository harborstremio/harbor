import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { User } from "lucide-react";
import { AWARD_CATALOG } from "@/lib/awards-catalog";
import { pushBigPicture } from "@/lib/big-picture";
import type { Meta } from "@/lib/cinemeta";
import { IMG } from "@/lib/providers/tmdb/tmdb-client";
import { tmdbDepartmentLabelKey } from "@/lib/providers/tmdb/tmdb-people";
import { SFX } from "@/lib/sfx";
import {
  MIN_VOTES_MOVIE,
  MIN_VOTES_TV,
  type FilmographySort,
} from "@/views/person/filmography-rank";
import { calcAge, fmtDate } from "@/views/person/person-utils";
import { useCreditImdbRatings } from "@/views/person/use-credit-imdb-ratings";
import { bpBoxCss, bpBoxPx, bpCardArt, type BpArtBox } from "./bp-art";
import { BpAwardMark } from "./bp-award-mark";
import { BpCollaboratorRow } from "./bp-collaborators";
import { BpEmptyState } from "./bp-empty";
import { BpCreditRow, BpCreditRowSkeleton, BpFilterRow } from "./bp-person-credits";
import { useBpPerson, type BpFilmSectionId, type BpPersonAward } from "./use-bp-person";
import { useBpT } from "./bp-i18n";
import { BP_DETAIL_HEADING } from "./detail/bp-detail-chrome";

// One record for the drawn width and the requested one, the rule bp-art states.
// h632 is 421 wide and this box floors at 132 on a television, so the page's
// largest single image was decoding roughly four times the pixels it paints.
const PORTRAIT: BpArtBox = { min: 132, vw: 11, max: 226 };

const SORTS: Array<{ value: FilmographySort; label: string }> = [
  { value: "popularity", label: "Popularity" },
  { value: "rating", label: "Rating" },
  { value: "newest", label: "Newest" },
];

const MIN_RATINGS = [0, 6, 7, 8];

// The Read more chip used to be gated on a 420 character count while the
// paragraph was clamped to four lines, so a short bio that still wrapped past
// the clamp was cut with no way to finish it.
function useBioClipped(text: string, expanded: boolean) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [clipped, setClipped] = useState(false);

  useLayoutEffect(() => {
    setClipped(false);
  }, [text]);

  useLayoutEffect(() => {
    const el = ref.current;
    // Expanding drops the clamp, so the element stops overflowing and a fresh
    // measurement would pull the chip out from under the focus ring.
    if (!el || expanded) return;
    const measure = () => {
      if (el.scrollHeight > el.clientHeight + 1) setClipped(true);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  return { ref, clipped };
}

function BpPersonAwards({ awards }: { awards: BpPersonAward[] }) {
  const t = useBpT();
  if (awards.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-[clamp(8px,0.8vw,16px)] pt-[clamp(3px,0.5vh,8px)]">
      {awards.map((a) => {
        const won = a.wins > 0;
        const headline = won
          ? a.wins === 1
            ? t("{n} win", { n: a.wins })
            : t("{n} wins", { n: a.wins })
          : a.nominations === 1
            ? t("{n} nom", { n: a.nominations })
            : t("{n} noms", { n: a.nominations });
        return (
          <span
            key={a.type}
            className="flex shrink-0 items-center gap-[clamp(6px,0.6vw,12px)] rounded-full bg-[var(--bp-void)]/85 py-[clamp(3px,0.35vh,6px)] pe-[clamp(12px,1.05vw,21px)] ps-[clamp(5px,0.45vw,9px)] ring-1 ring-[var(--bp-edge-2)]"
          >
            <BpAwardMark type={a.type} size="clamp(38px, 4.4vh, 64px)" />
            <span className="flex flex-col leading-tight">
              <span className="text-[clamp(11.5px,1.6vh,18px)] font-bold tabular-nums text-ink">
                {headline}
                {won && a.nominations > 0 && (
                  <span className="ms-[0.45em] font-semibold text-ink-subtle">
                    {a.nominations === 1
                      ? t("{n} nom", { n: a.nominations })
                      : t("{n} noms", { n: a.nominations })}
                  </span>
                )}
              </span>
              {/* Raw, like award-chips.tsx and bp-award.tsx and mobile-awards.tsx.
                  An award body is a proper noun, and only six of the eighteen
                  shorthands exist as catalog keys, so t() here produced a
                  translated headline stacked over an untranslated body name on
                  the three commonest awards in the set. */}
              <span className="text-[clamp(9px,1.2vh,13px)] font-semibold uppercase tracking-[0.15em] text-ink-subtle">
                {AWARD_CATALOG[a.type]?.shorthand ?? t("Award")}
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function BpPerson({
  personId,
  name,
  onSelect,
}: {
  personId: number;
  name: string;
  onSelect: (m: Meta) => void;
}) {
  const t = useBpT();
  const {
    person,
    loading,
    hasKey,
    knownFor,
    topRated,
    collaborators,
    awards,
    deptRank,
    sections,
    total,
    shownTotal,
    sort,
    setSort,
    minRating,
    setMinRating,
  } = useBpPerson(personId);
  const [expanded, setExpanded] = useState(false);
  const departmentKey = person?.knownForDepartment
    ? tmdbDepartmentLabelKey(person.knownForDepartment)
    : undefined;
  const departmentLabel = person?.knownForDepartment
    ? departmentKey
      ? t(departmentKey)
      : person.knownForDepartment
    : null;
  const topRatings = useCreditImdbRatings(topRated);

  const sectionTitle = (id: BpFilmSectionId, n: number): string => {
    if (id === "movies") return t("Movies · {n}", { n });
    if (id === "shows") return t("TV Shows · {n}", { n });
    if (id === "directing") return t("Directing");
    if (id === "writing") return t("Writing");
    if (id === "producing") return t("Producing");
    return t("Other Work");
  };

  const age = person?.birthday ? calcAge(person.birthday, person.deathday) : null;
  const facts: string[] = [];
  if (person?.birthday) {
    const born = t("Born {date}", { date: fmtDate(person.birthday) });
    facts.push(age != null ? `${born} · ${age}` : born);
  }
  if (person?.deathday) facts.push(t("Died {date}", { date: fmtDate(person.deathday) }));
  if (person?.placeOfBirth) facts.push(person.placeOfBirth);

  const bio = person?.biography?.trim() ?? "";
  const { ref: bioRef, clipped } = useBioClipped(bio, expanded);
  const focusId =
    knownFor.length > 0 ? "knownFor" : topRated.length > 0 ? "topRated" : sections[0]?.id;

  // Person was one of two BP pages whose rows carried no rail index, so vertical
  // ran on geometry and oscillated between two credit rows instead of walking
  // them. Indices come from position in this list, never from arithmetic: a gap
  // in data-bp-rail-row breaks vertical outright. Entries that hold nothing
  // focusable keep their index and are stepped over, which is why the heading
  // and the empty state stay in the list rather than being folded into a row.
  const rows: Array<{ key: string; node: ReactNode }> = [];
  if (loading && knownFor.length === 0) {
    rows.push({ key: "skeleton", node: <BpCreditRowSkeleton /> });
  }
  rows.push({
    key: "knownFor",
    node: (
      <BpCreditRow
        rowKey="credits:knownFor"
        title={t("Known For")}
        credits={knownFor}
        onSelect={onSelect}
        autofocusFirst={focusId === "knownFor"}
      />
    ),
  });
  rows.push({
    key: "topRated",
    node: (
      <BpCreditRow
        rowKey="credits:topRated"
        title={t("IMDb Top")}
        credits={topRated}
        onSelect={onSelect}
        autofocusFirst={focusId === "topRated"}
        ratings={topRatings}
      />
    ),
  });
  // Pushed unconditionally. The rail resolves late off an idle callback, and an
  // index that appears mid-session is fine, but one that is missing on the frame
  // a Down lands is a dead end.
  rows.push({ key: "collaborators", node: <BpCollaboratorRow people={collaborators} /> });
  if (total > 0) {
    rows.push({
      key: "filmography",
      node: <h2 className={BP_DETAIL_HEADING}>{t("Filmography")}</h2>,
    });
    rows.push({
      key: "sort",
      node: (
        <BpFilterRow
          id="sort"
          label={t("Sort")}
          options={SORTS.map((s) => ({ value: s.value, label: t(s.label) }))}
          value={sort}
          onChange={(v) => setSort(v as FilmographySort)}
          trailing={t("{n} of {total}", { n: shownTotal, total })}
        />
      ),
    });
    rows.push({
      key: "minRating",
      node: (
        <BpFilterRow
          id="rating"
          label={t("Rating")}
          options={MIN_RATINGS.map((r) => ({
            value: String(r),
            label: r === 0 ? t("Any rating") : t("Rated {r}+", { r }),
          }))}
          value={String(minRating)}
          onChange={(v) => setMinRating(Number(v))}
          caption={t("Ratings count from {movie}+ votes, {tv}+ for TV", {
            movie: MIN_VOTES_MOVIE,
            tv: MIN_VOTES_TV,
          })}
        />
      ),
    });
  }
  for (const s of sections) {
    rows.push({
      key: s.id,
      node: (
        <BpCreditRow
          rowKey={`credits:${s.id}`}
          title={sectionTitle(s.id, s.credits.length)}
          credits={s.credits}
          onSelect={onSelect}
          autofocusFirst={focusId === s.id}
        />
      ),
    });
  }
  if (!loading && shownTotal === 0) {
    // With no key every credit list above is empty and total is 0, so the sort
    // and rating rows never render either. This used to be the only row left and
    // it was a bare paragraph, which left the whole page with nothing focusable
    // and the ring with nowhere to land. It also named "Settings > Library",
    // which is not a place this shell has.
    rows.push({
      key: "empty",
      node:
        total > 0 ? (
          <BpEmptyState
            message={t("No titles clear that rating.")}
            action={t("Any rating")}
            onAction={() => setMinRating(0)}
          />
        ) : hasKey ? (
          <BpEmptyState message={t("No filmography on record.")} />
        ) : (
          <BpEmptyState
            message={t("Filmographies come from TMDB. Add a key in Setup to fill this page.")}
            action={t("Open Setup")}
            icon="setup"
            onAction={() => pushBigPicture({ kind: "settings" })}
          />
        ),
    });
  }

  return (
    <div
      data-bp-scroll-y
      className="h-full overflow-y-auto pb-[var(--bp-hint-h)] pt-[var(--bp-page-top)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex flex-col gap-[clamp(9px,1.15vh,18px)] px-[var(--bp-gutter)] [animation:bp-rise_var(--bp-dur-slow)_var(--bp-ease)_both] motion-reduce:[animation:none]">
        <div className="flex items-end gap-[clamp(16px,1.8vw,34px)]">
          <span
            className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--bp-r-lg)] bg-[var(--bp-panel-2)] shadow-[0_24px_60px_-22px_rgba(0,0,0,0.85)]"
            style={{ width: bpBoxCss(PORTRAIT), aspectRatio: "2 / 3" }}
          >
            {person?.profilePath ? (
              <img
                src={bpCardArt(`${IMG}/h632${person.profilePath}`, bpBoxPx(PORTRAIT))}
                alt=""
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <User size={34} className="text-ink-subtle" strokeWidth={1.7} />
            )}
          </span>

          <div className="flex min-w-0 flex-col gap-[clamp(4px,0.6vh,10px)] pb-[clamp(4px,0.8vh,14px)]">
            {(person?.knownForDepartment || deptRank != null) && (
              <div className="flex flex-wrap items-center gap-[clamp(7px,0.7vw,14px)]">
                {person?.knownForDepartment && (
                  <span
                    data-bp-eyebrow
                    className="text-[clamp(11px,1.5vh,17px)] font-semibold uppercase tracking-[0.16em] text-ink-subtle"
                  >
                    {departmentLabel}
                  </span>
                )}
                {/* A rank is neither actionable nor live, so it stays unsaturated
                    and there is no Top 100 route on this shell to open. It reads
                    from contrast and placement, not colour, and never focuses. */}
                {deptRank != null && (
                  <span className="rounded-full bg-[var(--bp-void)]/85 px-[clamp(9px,0.85vw,16px)] py-[clamp(2px,0.3vh,5px)] text-[clamp(10.5px,1.4vh,16px)] font-bold uppercase tracking-[0.14em] tabular-nums text-ink ring-1 ring-[var(--bp-edge-2)]">
                    {t("Top {n}", { n: deptRank })}
                  </span>
                )}
              </div>
            )}
            <h1
              data-bp-person-name
              className="font-display text-[clamp(26px,4.6vh,64px)] font-semibold leading-[1.04] tracking-[-0.025em] text-ink"
            >
              {person?.name ?? name}
            </h1>
            {facts.length > 0 && (
              <div
                data-bp-person-facts
                className="flex flex-wrap items-center gap-x-[clamp(9px,1vw,18px)] gap-y-1 text-[clamp(12px,1.7vh,20px)] font-semibold text-ink-muted"
              >
                {facts.map((f, i) => (
                  <span key={f} className="flex items-center gap-[clamp(9px,1vw,18px)]">
                    {i > 0 && (
                      <span aria-hidden className="opacity-35">
                        •
                      </span>
                    )}
                    {f}
                  </span>
                ))}
              </div>
            )}
            <BpPersonAwards awards={awards} />
          </div>
        </div>

        {bio && (
          <p
            ref={bioRef}
            data-bp-person-bio
            className={`max-w-[min(72vw,1180px)] text-[clamp(13px,1.85vh,22px)] leading-[1.62] text-ink-subtle ${
              expanded ? "" : "line-clamp-4"
            }`}
          >
            {bio}
          </p>
        )}
      </div>

      {clipped && (
        <div data-bp-row data-bp-row-key="bio" style={{ containIntrinsicSize: "auto 76px" }}>
          <div className="flex px-[var(--bp-gutter)] pt-[clamp(7px,0.9vh,14px)]">
            <div data-bp-scroll-x className="flex">
              <button
                type="button"
                data-bp-focusable
                data-bp-chip
                data-bp-filter-chip
                data-bp-restore-key="person-bio"
                onClick={() => {
                  SFX.click();
                  setExpanded((v) => !v);
                }}
                className="h-[clamp(44px,4.8vh,58px)] shrink-0 rounded-full border border-[var(--bp-edge)] px-[clamp(14px,1.2vw,22px)] text-[clamp(12.5px,1.78vh,20px)] font-semibold text-ink-subtle transition-colors duration-[var(--bp-dur-fast)]"
              >
                {expanded ? t("Show less") : t("Read more")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-[clamp(22px,3.2vh,50px)] flex flex-col gap-[var(--bp-row-gap)]">
        {/* empty:hidden, not omission: a row that resolves to nothing keeps its
            index and is stepped over, but an empty flex item still eats a
            --bp-row-gap, which is up to 52px of dead band per silent row. */}
        {rows.map((r, i) => (
          <div key={r.key} data-bp-rail-row={i} className="empty:hidden">
            {r.node}
          </div>
        ))}
      </div>
    </div>
  );
}
