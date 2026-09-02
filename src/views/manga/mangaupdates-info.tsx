import { useEffect, useState, type ReactNode } from "react";
import mangaUpdatesLogo from "@/assets/mangaupdates.png";
import { ChevronDown, ExternalLink, Loader2, Star } from "lucide-react";
import { t, useT } from "@/lib/i18n";
import { searchManga, type MangaSummary } from "@/lib/manga/api";
import {
  mangaUpdatesFor,
  type MangaUpdatesInfo,
  type MangaUpdatesRelated,
} from "@/lib/manga/mangaupdates";
import { hasAnyMangaSource } from "@/lib/manga/sources";
import { openUrl } from "@/lib/window";
import { Tooltip } from "@/views/detail/tooltip";

const MICRO = "text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle";
const CHIP =
  "rounded-full bg-elevated/60 px-3 py-1 text-[13px] text-ink-muted ring-1 ring-edge-soft";
const MORE =
  "px-1 text-[13.5px] font-medium text-accent transition-colors hover:text-ink motion-reduce:transition-none";

const CATEGORY_CAP = 8;
const GENRE_CAP = 10;
const ALT_CAP = 3;
const LIST_CAP = 8;
const THIN_DESCRIPTION = 40;

function translatedKnownStatus(status: string): string | undefined {
  switch (status.trim().toLowerCase()) {
    case "ongoing":
      return t("Ongoing");
    case "completed":
      return t("Completed");
    case "hiatus":
      return t("Hiatus");
    case "cancelled":
      return t("Cancelled");
    default:
      return undefined;
  }
}

function humanizeStatus(status?: string): string | undefined {
  if (!status) return undefined;
  return translatedKnownStatus(status) ?? status.charAt(0).toUpperCase() + status.slice(1);
}

function shortStatus(info: MangaUpdatesInfo | null): string | undefined {
  if (!info) return undefined;
  if (typeof info.completed === "boolean") return info.completed ? t("Completed") : t("Ongoing");
  const raw = /\(([^)]+)\)\s*$/.exec(info.status ?? "")?.[1]?.trim() || info.status?.trim();
  if (!raw) return undefined;
  const low = raw.toLowerCase();
  if (low.startsWith("complete")) return t("Completed");
  if (low.includes("hiatus")) return t("Hiatus");
  if (low.includes("cancel")) return t("Cancelled");
  if (low.includes("ongoing")) return t("Ongoing");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function primaryAuthor(info: MangaUpdatesInfo | null): string | undefined {
  return (info?.authors.find((a) => /author/i.test(a.role)) ?? info?.authors[0])?.name;
}

export function enrichManga(detail: MangaSummary | null, info: MangaUpdatesInfo | null) {
  const sourceDesc = detail?.description?.trim() || undefined;
  const thin = !sourceDesc || sourceDesc.length < THIN_DESCRIPTION;
  const muYear = /^\d{4}$/.test(info?.year ?? "") ? info?.year : undefined;
  return {
    description: (thin ? info?.description : undefined) ?? sourceDesc,
    year: detail?.year ? String(detail.year) : muYear,
    statusLabel: humanizeStatus(detail?.status) ?? shortStatus(info),
    author: detail?.author?.trim() || primaryAuthor(info),
  };
}

export function useMangaUpdates(title?: string): MangaUpdatesInfo | null {
  const [info, setInfo] = useState<MangaUpdatesInfo | null>(null);
  useEffect(() => {
    setInfo(null);
    if (!title) return;
    let cancelled = false;
    void mangaUpdatesFor(title)
      .then((res) => {
        if (!cancelled) setInfo(res);
      })
      .catch(() => setInfo(null));
    return () => {
      cancelled = true;
    };
  }, [title]);
  return info;
}

export function MangaUpdatesRank({ rank, onClick }: { rank: number; onClick: () => void }) {
  const [iconOk, setIconOk] = useState(true);
  const t = useT();
  return (
    <Tooltip label={t("Rank on MangaUpdates")} side="top">
      <button
        type="button"
        onClick={onClick}
        aria-label={t("Rank on MangaUpdates")}
        className="relative inline-flex items-center gap-1.5 rounded-full bg-elevated/60 px-3 py-1 text-[13px] text-ink-muted ring-1 ring-edge-soft backdrop-blur-sm transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
      >
        {iconOk && (
          <img
            src="https://www.mangaupdates.com/favicon.ico"
            alt=""
            className="h-3.5 w-3.5 rounded-[3px]"
            onError={() => setIconOk(false)}
          />
        )}
        #{rank.toLocaleString()}
      </button>
    </Tooltip>
  );
}

function Block({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-edge-soft pt-6 first:mt-0 first:border-t-0 first:pt-0">
      {label && <span className={MICRO}>{label}</span>}
      {children}
    </div>
  );
}

function ChipBlock({ label, items, cap }: { label: string; items: string[]; cap?: number }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const shown = cap && !open ? items.slice(0, cap) : items;
  return (
    <Block label={label}>
      <div className="flex flex-wrap items-center gap-2">
        {shown.map((item) => (
          <span key={item} className={CHIP}>
            {item}
          </span>
        ))}
        {cap != null && items.length > cap && (
          <button type="button" onClick={() => setOpen((v) => !v)} className={MORE}>
            {open ? t("Show less") : t("+{n} more", { n: items.length - cap })}
          </button>
        )}
      </div>
    </Block>
  );
}

function SeriesLink({
  item,
  onOpenManga,
}: {
  item: MangaUpdatesRelated;
  onOpenManga: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const t = useT();

  const open = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const found = (await searchManga(item.title, 0))[0];
      if (found) onOpenManga(found.id);
      else setMissing(true);
    } catch {
      setMissing(true);
    } finally {
      setBusy(false);
    }
  };

  const meta = missing ? t("Not on this source") : item.relation;
  const inner = (
    <>
      <span className="truncate text-[14px] text-ink">{item.title}</span>
      {busy ? (
        <Loader2 size={14} className="shrink-0 animate-spin text-ink-subtle" />
      ) : meta ? (
        <span className="shrink-0 text-[12px] text-ink-subtle">{meta}</span>
      ) : null}
    </>
  );

  if (!hasAnyMangaSource()) {
    return <span className="flex items-center justify-between gap-3 py-2">{inner}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={missing}
      className="-mx-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-start transition-colors hover:bg-elevated/60 disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
    >
      {inner}
    </button>
  );
}

export function MangaUpdatesSection({
  info,
  title,
  altTitle,
  onOpenManga,
}: {
  info: MangaUpdatesInfo;
  title?: string;
  altTitle?: string;
  onOpenManga: (id: string) => void;
}) {
  const [showAlts, setShowAlts] = useState(false);
  const [open, setOpen] = useState(false);
  const t = useT();

  const seen = new Set([title, altTitle, info.title].map((t) => (t ?? "").trim().toLowerCase()));
  const alts = info.altTitles.filter((t) => {
    const key = t.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const status = info.status ? (translatedKnownStatus(info.status) ?? info.status) : null;

  const facts = [
    info.type && { label: t("Type"), value: info.type },
    info.year && { label: t("Year"), value: info.year },
    status && { label: t("Status"), value: status },
    info.latestChapter != null && {
      label: t("Latest chapter"),
      value: t("Ch. {n}", { n: info.latestChapter }),
    },
    info.completed != null && {
      label: t("Completed"),
      value: info.completed ? t("Yes") : t("No"),
    },
    info.licensed != null && {
      label: t("Licensed"),
      value: info.licensed ? t("Yes") : t("No"),
    },
  ].filter((f): f is { label: string; value: string } => !!f);

  const lists = [
    { label: t("Related series"), items: info.related.slice(0, LIST_CAP) },
    { label: t("Readers also recommend"), items: info.recommendations.slice(0, LIST_CAP) },
  ];
  const rating = typeof info.rating === "number" ? info.rating : null;
  const ratingMeta = [
    info.ratingVotes ? t("{n} votes", { n: info.ratingVotes.toLocaleString() }) : null,
    info.rankYear ? t("Rank #{n} this year", { n: info.rankYear }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const summaryBits = [
    info.type,
    status,
    info.latestChapter != null ? t("Ch. {n}", { n: info.latestChapter }) : null,
  ].filter((b): b is string => !!b);

  const groups = [facts, info.genres, info.categories, info.authors, info.publishers, alts];
  const hasCard =
    rating != null || [...groups, ...lists.map((l) => l.items)].some((a) => a.length > 0);

  if (!hasCard) return null;

  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-[22px] font-medium tracking-tight text-ink">{t("About this series")}</h2>

      {hasCard && (
        <div className="overflow-hidden rounded-2xl border border-edge-soft bg-surface/40">
          <div
            role="button"
            tabIndex={0}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen((v) => !v);
              }
            }}
            className="group flex cursor-pointer items-start justify-between gap-4 p-6 text-start outline-none transition-colors hover:bg-elevated/25 focus-visible:bg-elevated/25 motion-reduce:transition-none"
          >
            <div className="flex min-w-0 flex-col gap-3">
              {(rating != null || summaryBits.length > 0) && (
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  {rating != null && (
                    <span className="inline-flex items-baseline gap-1.5">
                      <Star size={15} className="translate-y-0.5 text-accent" fill="currentColor" />
                      <span className="text-[18px] font-semibold text-ink">
                        {rating.toFixed(2)}
                      </span>
                      <span className="text-[12px] text-ink-subtle">/ 10</span>
                    </span>
                  )}
                  {rating != null && summaryBits.length > 0 && (
                    <span className="text-ink-subtle/40">·</span>
                  )}
                  {summaryBits.length > 0 && (
                    <span className="text-[13.5px] text-ink-muted">
                      {summaryBits.join("  ·  ")}
                    </span>
                  )}
                </div>
              )}
              {ratingMeta && <span className="text-[12px] text-ink-subtle">{ratingMeta}</span>}
              {info.genres.length > 0 && (
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  {info.genres.slice(0, GENRE_CAP).map((g) => (
                    <span key={g} className={CHIP}>
                      {g}
                    </span>
                  ))}
                  {info.genres.length > GENRE_CAP && (
                    <span className="px-1 text-[13px] font-medium text-ink-subtle">
                      +{info.genres.length - GENRE_CAP}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="mt-1 flex shrink-0 items-center gap-3">
              {info.url && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openUrl(info.url);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-[12px] text-ink-subtle transition-colors hover:text-ink-muted motion-reduce:transition-none"
                >
                  <img
                    src={mangaUpdatesLogo}
                    alt=""
                    draggable={false}
                    className="h-[14px] w-[14px] rounded-[3px]"
                  />
                  MangaUpdates
                  <ExternalLink size={11} />
                </button>
              )}
              <ChevronDown
                size={20}
                className={`text-ink-subtle transition-transform duration-200 group-hover:text-ink-muted ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
          </div>

          {open && (
            <div className="flex flex-col border-t border-edge-soft px-6 pb-6 pt-6 animate-in fade-in slide-in-from-top-1 duration-200">
              {info.categories.length > 0 && (
                <ChipBlock label={t("Categories")} items={info.categories} cap={CATEGORY_CAP} />
              )}

              {(info.authors.length > 0 || info.publishers.length > 0) && (
                <Block label={t("Creators")}>
                  <div className="flex flex-col gap-1.5">
                    {info.authors.map((a) => (
                      <span key={`${a.name}-${a.role}`} className="text-[14px] text-ink">
                        {a.name}
                        <span className="ml-2 text-[12.5px] text-ink-subtle">{a.role}</span>
                      </span>
                    ))}
                  </div>
                  {info.publishers.length > 0 && (
                    <p className="text-[13.5px] leading-relaxed text-ink-muted">
                      {t("Published by {names}", { names: info.publishers.join(", ") })}
                    </p>
                  )}
                </Block>
              )}

              {alts.length > 0 && (
                <Block label={t("Also known as")}>
                  <p className="text-[14px] leading-relaxed text-ink-muted">
                    {(showAlts ? alts : alts.slice(0, ALT_CAP)).join(", ")}
                    {alts.length > ALT_CAP && (
                      <button type="button" onClick={() => setShowAlts((v) => !v)} className={MORE}>
                        {showAlts ? t("Show less") : t("+{n} more", { n: alts.length - ALT_CAP })}
                      </button>
                    )}
                  </p>
                </Block>
              )}

              {lists.map(
                ({ label, items }) =>
                  items.length > 0 && (
                    <Block key={label} label={label}>
                      <div className="grid gap-x-8 sm:grid-cols-2">
                        {items.map((item) => (
                          <SeriesLink key={item.id} item={item} onOpenManga={onOpenManga} />
                        ))}
                      </div>
                    </Block>
                  ),
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
