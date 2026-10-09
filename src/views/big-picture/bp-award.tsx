import { useEffect, useMemo, useState } from "react";
import { pushBigPicture } from "@/lib/big-picture";
import type { CategoryWinner } from "@/lib/awards-history";
import type { Meta } from "@/lib/cinemeta";
import type { AwardType } from "@/lib/providers/wikidata";
import { SFX } from "@/lib/sfx";
import { useSettings } from "@/lib/settings";
import { bpCardArt } from "./bp-art";
import { bpArtDead, markBpArtDead } from "./use-bp-art";
import { BpArt } from "./bp-art-img";
import { BpAwardMark, bpAwardTint } from "./bp-award-mark";
import { BpGrid, BpGridScroller } from "./bp-grid";
import { useBpT } from "./bp-i18n";
import { BpChip, BpChipRow } from "./bp-library-chips";
import { useBpAutoPage } from "./use-bp-auto-page";
import { useBundledAwardsVersion } from "@/lib/use-bundled-awards";
import { bpAwardDetail } from "./use-bp-discover";
import { resolveBpAwardWork } from "./use-bp-award-work";

const ALL = "all";
const COLUMNS = "repeat(auto-fill, minmax(clamp(240px, 22vw, 420px), 1fr))";
const POSTER_ART_W = 38;

// Winners per page. The default filter here is every decade of every category:
// awards.json holds 3,920 Oscar winners, 2,547 Emmy and 2,469 Golden Globe, and
// each one is a focusable button with a poster, so the unpaged grid committed
// roughly 24,000 nodes in one render. That is the node count that made
// Input.dispatchKeyEvent time out after twenty five seconds, and this page is
// two presses from Discover.
const PAGE = 90;

const TV_CATEGORY =
  /series|television|\btv\b|daytime|talk|host|reality|variety|game show|soap|miniseries|anthology/i;

export function BpAward({
  awardType,
  onSelect,
}: {
  awardType: AwardType;
  onSelect?: (m: Meta) => void;
}) {
  const t = useBpT();
  const awardsV = useBundledAwardsVersion();
  const detail = useMemo(() => bpAwardDetail(awardType), [awardsV, awardType]);
  const [decade, setDecade] = useState<number | null>(null);
  const [categoryKey, setCategoryKey] = useState<string>(ALL);
  const tint = bpAwardTint(awardType);

  // The chips count what the decade actually leaves behind, so a chip can never
  // advertise winners the grid under it is not going to show.
  const byDecade = useMemo(
    () =>
      detail.groups.map((g) => ({
        ...g,
        entries:
          decade === null
            ? g.entries
            : g.entries.filter((e) => e.year >= decade && e.year < decade + 10),
      })),
    [detail.groups, decade],
  );

  const groups = useMemo(
    () =>
      byDecade.filter(
        (g) =>
          (categoryKey === ALL || g.category.key === categoryKey) && g.entries.length > 0,
      ),
    [byDecade, categoryKey],
  );

  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [decade, categoryKey, awardType]);

  const paged = useMemo(() => {
    const out: typeof groups = [];
    let left = limit;
    for (const g of groups) {
      if (left <= 0) break;
      out.push(left >= g.entries.length ? g : { ...g, entries: g.entries.slice(0, left) });
      left -= g.entries.length;
    }
    return out;
  }, [groups, limit]);

  const mounted = useMemo(
    () => paged.reduce((n, g) => n + g.entries.length, 0),
    [paged],
  );

  const shown = useMemo(() => {
    let wins = 0;
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const g of groups) {
      wins += g.entries.length;
      for (const e of g.entries) {
        if (e.year < lo) lo = e.year;
        if (e.year > hi) hi = e.year;
      }
    }
    return { wins, span: wins === 0 ? "" : lo === hi ? String(lo) : `${lo} - ${hi}` };
  }, [groups]);

  const sentinelRef = useBpAutoPage(mounted, mounted < shown.wins, () =>
    setLimit((n) => n + PAGE),
  );

  return (
    <div className="flex h-full flex-col pt-[var(--bp-page-top)]">
      <div className="flex items-center gap-[clamp(14px,1.4vw,30px)] px-[var(--bp-gutter)]">
        <BpAwardMark type={awardType} size="clamp(76px, 7vw, 148px)" />
        <div className="flex min-w-0 flex-col gap-[clamp(2px,0.4vh,6px)]">
          <span
            className="truncate text-[clamp(13px,1.6vh,16px)] font-bold uppercase tracking-[0.2em]"
            style={{ color: tint }}
          >
            {detail.meta.shorthand}
          </span>
          <h1 className="truncate font-display text-[clamp(32px,4.4vh,50px)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
            {t(detail.meta.title)}
          </h1>
          <p className="truncate text-[clamp(15px,2vh,20px)] font-semibold text-ink-muted">
            {t("{n} winners", { n: shown.wins })}
            {shown.span && (
              <>
                <span aria-hidden className="mx-[0.55em] opacity-40">
                  •
                </span>
                {shown.span}
              </>
            )}
            <span aria-hidden className="mx-[0.55em] opacity-40">
              •
            </span>
            {t("{n} categories", { n: groups.length })}
          </p>
        </div>
      </div>

      <div className="mt-[clamp(9px,1.3vh,20px)] flex flex-col gap-[clamp(6px,0.9vh,14px)] px-[var(--bp-gutter)]">
        {detail.decades.length > 1 && (
          <BpChipRow>
            <BpChip
              label={t("All years")}
              selected={decade === null}
              restoreKey="bp-award-decade:all"
              onSelect={() => setDecade(null)}
            />
            {detail.decades.map((d) => (
              <BpChip
                key={d}
                label={`${d}s`}
                selected={decade === d}
                restoreKey={`bp-award-decade:${d}`}
                onSelect={() => setDecade(decade === d ? null : d)}
              />
            ))}
          </BpChipRow>
        )}
        {detail.groups.length > 1 && (
          <BpChipRow>
            <BpChip
              label={t("All categories")}
              selected={categoryKey === ALL}
              restoreKey="bp-award-cat:all"
              onSelect={() => setCategoryKey(ALL)}
            />
            {byDecade
              .filter((g) => g.entries.length > 0 || categoryKey === g.category.key)
              .map((g) => (
                <BpChip
                  key={g.category.key}
                  label={g.category.name}
                  count={g.entries.length}
                  selected={categoryKey === g.category.key}
                  restoreKey={`bp-award-cat:${g.category.key}`}
                  onSelect={() => setCategoryKey(g.category.key)}
                />
              ))}
          </BpChipRow>
        )}
      </div>

      <div className="mt-[clamp(9px,1.3vh,20px)] flex min-h-0 flex-1 flex-col px-[var(--bp-gutter)]">
        <BpGridScroller>
          {groups.length === 0 ? (
            <p className="max-w-[min(52vw,820px)] pt-[clamp(14px,2vh,28px)] text-[clamp(17px,2.3vh,22px)] text-ink-subtle">
              {t("No winners match these filters.")}
            </p>
          ) : (
            <div className="flex flex-col gap-[clamp(18px,2.6vh,42px)]">
              {paged.map((g, gi) => (
                <section key={g.category.key} className="flex flex-col gap-[clamp(7px,1vh,15px)]">
                  <div className="flex items-baseline justify-between gap-[clamp(9px,1vw,18px)] border-b border-[var(--bp-edge)] pb-[clamp(5px,0.7vh,11px)]">
                    <h2 className="text-[clamp(19px,2.6vh,28px)] font-bold tracking-[-0.01em] text-ink">
                      {g.category.name}
                    </h2>
                    <span className="shrink-0 text-[clamp(12px,1.6vh,16px)] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                      {t("{n} winners", { n: g.entries.length })}
                    </span>
                  </div>
                  <BpGrid columns={COLUMNS} gap="clamp(8px,0.8vw,16px)">
                    {g.entries.map((e, i) => (
                      <BpAwardWinner
                        key={`${e.year}-${e.workTitle}-${i}`}
                        entry={e}
                        preferTv={TV_CATEGORY.test(g.category.name)}
                        tint={tint}
                        autofocus={gi === 0 && i === 0}
                        onSelect={onSelect}
                      />
                    ))}
                  </BpGrid>
                </section>
              ))}
              <div ref={sentinelRef} className="h-px w-full" />
            </div>
          )}
        </BpGridScroller>
      </div>
    </div>
  );
}

function BpAwardWinner({
  entry,
  preferTv,
  tint,
  autofocus,
  onSelect,
}: {
  entry: CategoryWinner;
  preferTv: boolean;
  tint: string;
  autofocus?: boolean;
  onSelect?: (m: Meta) => void;
}) {
  const t = useBpT();
  const { settings } = useSettings();
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [, redraw] = useState(0);
  // The url is unchanged: which metahub tier actually exists is an open question
  // that only a probe on the device can answer, and guessing a different one here
  // would just manufacture a different failing url. What is fixed is the memory.
  // A miss used to live in component state, so the same dead url was requested
  // again by every later mount of this row. The dead set is the shared one, so a
  // failure costs once per session rather than once per visit.
  const raw = entry.imdb
    ? `https://images.metahub.space/poster/small/${entry.imdb}/img`
    : null;
  const sized = raw ? (bpCardArt(raw, POSTER_ART_W) ?? null) : null;
  const poster =
    sized && !bpArtDead(sized)
      ? sized
      : raw && raw !== sized && !bpArtDead(raw)
        ? raw
        : null;

  const open = (meta: Meta) => {
    if (onSelect) {
      onSelect(meta);
      return;
    }
    pushBigPicture({ kind: "detail", metaId: `${meta.type}:${meta.id}` });
  };

  const activate = async () => {
    if (busy) return;
    SFX.click();
    if (entry.imdb) {
      open({
        id: entry.imdb,
        type: preferTv ? "series" : "movie",
        name: entry.workTitle,
      } as Meta);
      return;
    }
    // One press, one answer. This used to return here, so a keyless winner lit
    // up under the ring, made a sound and changed nothing, which is the worst
    // thing a remote can do. The press now goes to the surface that fixes it.
    if (!settings.tmdbKey) {
      pushBigPicture({ kind: "settings" });
      return;
    }
    setBusy(true);
    setMissing(false);
    try {
      const hit = await resolveBpAwardWork(
        settings.tmdbKey,
        entry.workTitle,
        entry.year,
        preferTv,
      );
      if (hit) {
        open({
          id: `tmdb:${hit.type}:${hit.id}`,
          type: hit.type === "tv" ? "series" : "movie",
          name: entry.workTitle,
        } as Meta);
      } else {
        setMissing(true);
      }
    } finally {
      setBusy(false);
    }
  };

  // Still focusable with no key: every keyless winner would drop out at once,
  // and a grid the ring cannot enter is a dead end, not a disabled cell. No
  // aria-disabled either, because the press now has somewhere to go.
  const unlinked = !entry.imdb && !settings.tmdbKey;

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-autofocus={autofocus ? "true" : undefined}
      aria-busy={busy || undefined}
      data-bp-restore-key={`bp-winner:${entry.year}:${entry.workTitle}`}
      onClick={() => void activate()}
      aria-label={`${entry.workTitle}, ${entry.year}`}
      // No fade and no pulse while busy. Dimming the tile at the instant of the
      // press reads as "this is disabled", which is the opposite of what is
      // happening, and a group opacity under the ring is a live offscreen pass.
      // The lookup answers in the second text row instead.
      className={`flex min-h-[clamp(72px,8.6vh,92px)] items-center gap-[clamp(9px,0.9vw,16px)] rounded-[var(--bp-r-sm)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] p-[clamp(6px,0.55vw,11px)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)] ${
        unlinked ? "opacity-70" : ""
      }`}
    >
      <span
        className="relative flex h-[clamp(56px,6.6vh,76px)] w-[clamp(38px,4.4vh,52px)] shrink-0 items-center justify-center overflow-hidden rounded-[var(--bp-r-xs)] bg-[var(--bp-panel-2)] text-[clamp(11px,1.5vh,14px)] font-bold tabular-nums text-ink-subtle"
        style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${tint} 22%, transparent)` }}
      >
        {poster ? (
          <BpArt
            src={poster}
            onError={() => {
              markBpArtDead(poster);
              redraw((n) => n + 1);
            }}
            className="object-cover"
          />
        ) : (
          entry.year
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-[2px]">
        <span className="flex items-baseline gap-[clamp(5px,0.5vw,10px)]">
          <span className="shrink-0 text-[clamp(13px,1.75vh,17px)] font-bold tabular-nums text-ink-subtle">
            {entry.year}
          </span>
          <span className="line-clamp-2 text-[clamp(16px,2.2vh,21px)] font-semibold leading-tight text-ink">
            {entry.workTitle}
          </span>
        </span>
        {busy ? (
          <span className="line-clamp-1 text-[clamp(13px,1.75vh,17px)] font-semibold text-ink-muted">
            {t("Checking with TMDB…")}
          </span>
        ) : missing ? (
          <span className="line-clamp-1 text-[clamp(13px,1.75vh,17px)] font-semibold text-ink-muted">
            {t("No match found")}
          </span>
        ) : (
          entry.recipients.length > 0 && (
            <span className="line-clamp-1 text-[clamp(13px,1.75vh,17px)] font-medium text-ink-subtle">
              {entry.recipients.join(", ")}
            </span>
          )
        )}
      </span>
    </button>
  );
}
