import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Download,
  Globe,
  LayoutGrid,
  List,
  Loader2,
  Pause,
  Play,
  Search,
  Server,
  Tv,
} from "lucide-react";
import { t, useT } from "@/lib/i18n";
import { Flag, flagSrc } from "@/components/flag";
import { languageName, type MangaChapter } from "@/lib/manga/model";
import { useMangaProgressEntry, type MangaProgressEntry } from "@/lib/manga-progress";
import {
  downloadAllChapters,
  downloadChapter,
  pauseMangaDownloadBatch,
  resumeMangaDownloadBatch,
  useMangaDownload,
  useMangaDownloadBatch,
  type MangaDownloadInfo,
} from "@/lib/manga-downloads";
import { listMangaSources, sourceIconUrl } from "@/lib/manga/sources";

type ChapterView = "grid" | "list";
const VIEW_KEY = "harbor.manga.chapterview";

function readView(): ChapterView {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(VIEW_KEY) : null;
  return v === "grid" || v === "list" ? v : "grid";
}

function relativeDate(iso?: string): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return t("just now");
  const mins = Math.round(secs / 60);
  if (mins < 60) return t("{n}m ago", { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t("{n}h ago", { n: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return t("{n}d ago", { n: days });
  const weeks = Math.round(days / 7);
  if (weeks < 5) return t("{n}w ago", { n: weeks });
  const months = Math.round(days / 30);
  if (months < 12) return t("{n}mo ago", { n: months });
  return t("{n}y ago", { n: Math.round(days / 365) });
}

function chapterLabel(chapter: string | null): string {
  return chapter == null ? t("Oneshot") : t("Chapter {n}", { n: chapter });
}

function flagLanguageName(code: string): string {
  const name = languageName(code);
  if (flagSrc(name)) return name;
  const base = code.split(/[-_]/)[0];
  return languageName(base);
}

function LangFlag({ code }: { code: string }) {
  return <Flag language={flagLanguageName(code)} size="sm" showLabel={false} />;
}

function chapterNum(c: MangaChapter, index: number): number {
  const n = c.chapter == null ? NaN : parseFloat(c.chapter);
  return Number.isFinite(n) ? n : index + 1;
}

function bucketOf(num: number): number {
  return Math.floor((Math.ceil(num) - 1) / 50);
}

function LangDropdown({
  langs,
  selected,
  onSelect,
}: {
  langs: Array<{ code: string; count: number }>;
  selected: string;
  onSelect: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const active = langs.find((l) => l.code === selected);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-edge-soft bg-surface/60 px-4 text-[14px] text-ink transition-colors hover:border-edge hover:bg-elevated/60"
      >
        <LangFlag code={selected} />
        <span>{languageName(selected)}</span>
        <span className="text-ink-subtle">({active?.count ?? 0})</span>
        <ChevronDown
          size={16}
          className={`text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 max-h-80 w-64 overflow-y-auto rounded-xl border border-edge-soft bg-elevated py-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.45)]">
          {langs.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                onSelect(l.code);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-[14px] transition-colors hover:bg-raised ${
                l.code === selected ? "text-ink" : "text-ink-muted"
              }`}
            >
              <span className="flex items-center gap-2">
                {l.code === selected ? (
                  <Check size={15} className="text-accent" />
                ) : (
                  <span className="w-[15px]" />
                )}
                <LangFlag code={l.code} />
                {languageName(l.code)}
              </span>
              <span className="text-[12px] text-ink-subtle">{l.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChapterMeta({ chapter }: { chapter: MangaChapter }) {
  const rel = relativeDate(chapter.publishAt);
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-subtle">
      {chapter.group && <span className="truncate">{chapter.group}</span>}
      {chapter.group && rel && (
        <span aria-hidden className="text-ink-subtle/50">
          ·
        </span>
      )}
      {rel && <span className="shrink-0">{rel}</span>}
    </span>
  );
}

function ChapterProgress({ page, total }: { page: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((page / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-edge-soft/60">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-accent">
        {page}/{total}
      </span>
    </div>
  );
}

function chapterSourceId(id: string): string {
  const i = id.indexOf("::");
  return i === -1 ? "" : id.slice(0, i);
}

function isCurrentChapter(progress: MangaProgressEntry | undefined, c: MangaChapter): boolean {
  if (!progress) return false;
  if (progress.chapterId === c.id) return true;
  return (
    progress.chapterNumber != null && c.chapter != null && progress.chapterNumber === c.chapter
  );
}

function ChapterDownloadButton({
  mangaId,
  chapterId,
  info,
  serverDownloaded,
}: {
  mangaId: string;
  chapterId: string;
  info?: MangaDownloadInfo;
  serverDownloaded?: boolean;
}) {
  const rec = useMangaDownload(chapterId);
  const t = useT();
  if (rec.status === "done") {
    return <Check size={16} className="shrink-0 text-accent" aria-label={t("Downloaded")} />;
  }
  if (rec.status === "downloading") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums text-ink-subtle">
        <Loader2 size={14} className="animate-spin" />
        {rec.total ? `${rec.done}/${rec.total}` : null}
      </span>
    );
  }
  if (rec.status === "paused") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums text-ink-subtle">
        <Pause size={14} />
        {rec.total ? `${rec.done}/${rec.total}` : null}
      </span>
    );
  }
  if (serverDownloaded) {
    return (
      <span
        aria-label={t("Saved on your server")}
        title={t("Saved on your server, reads instantly")}
        className="grid h-7 w-7 shrink-0 place-items-center text-accent/75"
      >
        <Server size={15} strokeWidth={2.2} />
      </span>
    );
  }
  return (
    <span
      role="button"
      tabIndex={-1}
      aria-label={t("Download chapter")}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        void downloadChapter(mangaId, chapterId, info);
      }}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
    >
      <Download size={16} className={rec.status === "error" ? "text-danger" : ""} />
    </span>
  );
}

function SourceIcon({ iconUrl }: { iconUrl?: string }) {
  const [failed, setFailed] = useState(false);
  if (!iconUrl || failed) return <Globe size={15} className="text-ink-subtle" />;
  return (
    <img
      src={iconUrl}
      alt=""
      className="h-[15px] w-[15px] shrink-0 rounded-[3px] object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function SourceRow({
  label,
  iconUrl,
  active,
  onClick,
}: {
  label: string;
  iconUrl?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-[14px] transition-colors hover:bg-raised ${
        active ? "text-ink" : "text-ink-muted"
      }`}
    >
      {active ? <Check size={15} className="text-accent" /> : <span className="w-[15px]" />}
      <SourceIcon iconUrl={iconUrl} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function SourceFilterDropdown({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ id: string; name: string; iconUrl?: string }>;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  const t = useT();
  const active = options.find((o) => o.id === selected);
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-edge-soft bg-surface/60 px-4 text-[14px] text-ink transition-colors hover:border-edge hover:bg-elevated/60"
      >
        <SourceIcon iconUrl={active?.iconUrl} />
        <span>{active ? active.name : t("All sources")}</span>
        <ChevronDown
          size={16}
          className={`text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 max-h-80 w-56 overflow-y-auto rounded-xl border border-edge-soft bg-elevated py-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.45)]">
          <SourceRow label={t("All sources")} active={!selected} onClick={() => onSelect("")} />
          {options.map((o) => (
            <SourceRow
              key={o.id}
              label={o.name}
              iconUrl={o.iconUrl}
              active={o.id === selected}
              onClick={() => onSelect(o.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AnimeEndTag() {
  const t = useT();
  return (
    <span
      title={t("The anime adaptation ends at this chapter")}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/12 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-wide text-accent ring-1 ring-accent/25"
    >
      <Tv size={11} strokeWidth={2.4} />
      {t("Anime ends")}
    </span>
  );
}

export function ChapterList({
  chapters,
  langs,
  selectedLang,
  onSelectLang,
  onRead,
  mangaId,
  mangaTitle,
  mangaCover,
  animeEndChapter,
  pending = false,
}: {
  chapters: MangaChapter[];
  langs: Array<{ code: string; count: number }>;
  selectedLang: string;
  onSelectLang: (code: string) => void;
  onRead: (chapters: MangaChapter[], index: number) => void;
  mangaId?: string;
  mangaTitle?: string;
  mangaCover?: string;
  animeEndChapter?: number;
  pending?: boolean;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("oldest");
  const [view, setView] = useState<ChapterView>(readView);
  const [range, setRange] = useState<number | null>(null);
  const [sourceFilter, setSourceFilter] = useState("");
  const batch = useMangaDownloadBatch(mangaId ?? "");

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    setRange(null);
  }, [selectedLang]);

  const progress = useMangaProgressEntry(mangaId, mangaTitle);

  const sourceOptions = useMemo(() => {
    const all = listMangaSources();
    const ids = new Set<string>();
    for (const c of chapters) ids.add(chapterSourceId(c.id));
    return [...ids].filter(Boolean).map((sid) => {
      const s = all.find((x) => x.id === sid);
      return { id: sid, name: s?.name ?? sid, iconUrl: s ? sourceIconUrl(s) : undefined };
    });
  }, [chapters]);

  useEffect(() => {
    if (sourceFilter && !sourceOptions.some((o) => o.id === sourceFilter)) setSourceFilter("");
  }, [sourceOptions, sourceFilter]);

  const scoped = useMemo(
    () =>
      sourceFilter ? chapters.filter((c) => chapterSourceId(c.id) === sourceFilter) : chapters,
    [chapters, sourceFilter],
  );

  const animeEndId = useMemo(() => {
    if (animeEndChapter == null) return null;
    let bestId: string | null = null;
    let bestNum = -Infinity;
    for (const c of scoped) {
      const n = c.chapter == null ? NaN : parseFloat(c.chapter);
      if (!Number.isFinite(n) || n > animeEndChapter || n <= bestNum) continue;
      bestNum = n;
      bestId = c.id;
    }
    return bestId;
  }, [scoped, animeEndChapter]);

  const nums = useMemo(() => {
    const m = new Map<string, number>();
    scoped.forEach((c, i) => m.set(c.id, chapterNum(c, i)));
    return m;
  }, [scoped]);

  const ranges = useMemo(() => {
    const map = new Map<number, { lo: number; hi: number }>();
    let max = 0;
    for (const c of scoped) {
      const num = nums.get(c.id) ?? 0;
      max = Math.max(max, Math.ceil(num));
      const b = bucketOf(num);
      if (!map.has(b)) map.set(b, { lo: b * 50 + 1, hi: b * 50 + 50 });
    }
    return [...map.entries()]
      .map(([b, r]) => ({ b, lo: r.lo, hi: Math.min(r.hi, max) }))
      .sort((a, z) => z.b - a.b);
  }, [scoped, nums]);

  const q = query.trim().toLowerCase();
  const searched = useMemo(() => {
    if (!q) return scoped;
    return scoped.filter((c) => {
      const label = c.chapter == null ? "oneshot" : `chapter ${c.chapter}`;
      return label.includes(q) || (c.title?.toLowerCase().includes(q) ?? false);
    });
  }, [scoped, q]);

  const showPager = !q && scoped.length > 60 && ranges.length > 1;

  const narrowed = useMemo(() => {
    if (!showPager || range == null) return searched;
    return searched.filter((c) => bucketOf(nums.get(c.id) ?? 0) === range);
  }, [searched, showPager, range, nums]);

  const ascending = useMemo(
    () => [...narrowed].sort((a, b) => (nums.get(a.id) ?? 0) - (nums.get(b.id) ?? 0)),
    [narrowed, nums],
  );
  const ordered = useMemo(
    () => (sort === "newest" ? [...ascending].reverse() : ascending),
    [ascending, sort],
  );

  if (chapters.length === 0) {
    return (
      <section className="flex flex-col gap-6">
        <h2 className="text-[22px] font-medium tracking-tight text-ink">{t("Chapters")}</h2>
        <div className="rounded-2xl border border-edge-soft bg-surface/40 px-6 py-14 text-center">
          {pending ? (
            <p className="flex items-center justify-center gap-2 text-[15px] text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
              {t("Loading chapters...")}
            </p>
          ) : (
            <p className="text-[15px] text-ink-muted">
              {t("No chapters available in {lang} from this source.", {
                lang: languageName(selectedLang),
              })}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[22px] font-medium tracking-tight text-ink">{t("Chapters")}</h2>
          <span className="text-[15px] text-ink-subtle">{chapters.length}</span>
          {pending && (
            <span className="flex items-center gap-1.5 text-[12.5px] text-ink-subtle">
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
              {t("checking other sources")}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 items-center gap-1 rounded-xl border border-edge-soft bg-surface/60 p-1">
            {(
              [
                ["list", List],
                ["grid", LayoutGrid],
              ] as const
            ).map(([v, Icon]) => (
              <button
                key={v}
                type="button"
                aria-label={v === "list" ? t("list view") : t("grid view")}
                onClick={() => setView(v)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  view === v ? "bg-elevated text-ink" : "text-ink-subtle hover:text-ink"
                }`}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
          <div className="flex h-11 items-center gap-1 rounded-xl border border-edge-soft bg-surface/60 p-1">
            {(["newest", "oldest"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`h-9 rounded-lg px-4 text-[13px] font-medium transition-colors ${
                  sort === s ? "bg-elevated text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {s === "newest" ? t("Newest") : t("Oldest")}
              </button>
            ))}
          </div>
          {mangaId && ascending.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (batch.status === "downloading") {
                  pauseMangaDownloadBatch(mangaId);
                  return;
                }
                if (batch.status === "paused") {
                  resumeMangaDownloadBatch(mangaId);
                  return;
                }
                void downloadAllChapters(
                  mangaId,
                  ascending.map((c) => ({
                    chapterId: c.id,
                    info: { title: mangaTitle, cover: mangaCover, chapter: c.chapter },
                  })),
                );
              }}
              aria-label={
                batch.status === "downloading"
                  ? t("Pause downloads")
                  : batch.status === "paused"
                    ? t("Resume downloads")
                    : t("Download all")
              }
              className="flex h-11 items-center gap-2 rounded-xl border border-edge-soft bg-surface/60 px-3.5 text-[13px] font-medium text-ink-muted transition-[color,background-color,transform] hover:bg-elevated/60 hover:text-ink active:scale-[0.96] motion-reduce:active:scale-100"
            >
              {batch.status === "downloading" ? (
                <Pause size={16} />
              ) : batch.status === "paused" ? (
                <Play size={16} />
              ) : (
                <Download size={16} />
              )}
              {batch.status === "downloading"
                ? t("Pause downloads")
                : batch.status === "paused"
                  ? t("Resume downloads")
                  : batch.status === "error"
                    ? t("Retry downloads")
                    : t("Download all")}
              {(batch.status === "downloading" || batch.status === "paused") && batch.total > 0 && (
                <span className="tabular-nums text-ink-subtle">
                  {batch.done}/{batch.total}
                </span>
              )}
            </button>
          )}
          {sourceOptions.length > 1 && (
            <SourceFilterDropdown
              options={sourceOptions}
              selected={sourceFilter}
              onSelect={setSourceFilter}
            />
          )}
          {langs.length > 1 && (
            <LangDropdown langs={langs} selected={selectedLang} onSelect={onSelectLang} />
          )}
        </div>
      </div>

      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search chapters...")}
          className="h-11 w-full rounded-xl border border-edge-soft bg-surface/60 pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-ink-subtle focus:border-edge focus:outline-none"
        />
      </div>

      {showPager && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[13px] font-medium text-ink-subtle">{t("Jump to")}</span>
          <button
            type="button"
            onClick={() => setRange(null)}
            className={`h-9 rounded-lg px-3.5 text-[13px] font-medium tabular-nums transition-colors ${
              range == null
                ? "bg-accent text-canvas"
                : "bg-elevated/50 text-ink-muted hover:text-ink"
            }`}
          >
            {t("All")}
          </button>
          {ranges.map((r) => (
            <button
              key={r.b}
              type="button"
              onClick={() => setRange(r.b)}
              className={`h-9 rounded-lg px-3.5 text-[13px] font-medium tabular-nums transition-colors ${
                range === r.b
                  ? "bg-accent text-canvas"
                  : "bg-elevated/50 text-ink-muted hover:text-ink"
              }`}
            >
              {r.hi}-{r.lo}
            </button>
          ))}
        </div>
      )}

      {ordered.length === 0 ? (
        <div className="rounded-2xl border border-edge-soft bg-surface/40 px-6 py-14 text-center">
          <p className="text-[15px] text-ink-muted">{t("No chapters match your search.")}</p>
        </div>
      ) : view === "list" ? (
        <div className="overflow-hidden rounded-2xl border border-edge-soft bg-surface/40">
          {ordered.map((c) => {
            const cur = isCurrentChapter(progress, c);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  onRead(
                    ascending,
                    ascending.findIndex((x) => x.id === c.id),
                  )
                }
                className={`group flex min-h-[64px] w-full items-center justify-between gap-4 border-b border-edge-soft/60 px-5 py-3.5 text-start transition-colors last:border-b-0 hover:bg-elevated/40 ${
                  cur ? "bg-accent/5" : ""
                }`}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[12px] ${cur ? "text-accent" : "text-ink-subtle"}`}>
                      {c.chapter == null ? t("Oneshot") : t("Ch. {n}", { n: c.chapter })}
                    </span>
                    {c.id === animeEndId && <AnimeEndTag />}
                  </div>
                  <span className="truncate text-[16px] font-semibold text-ink">
                    {c.title?.trim() ? c.title : chapterLabel(c.chapter)}
                  </span>
                  {cur && progress && (
                    <div className="mt-1 w-56">
                      <ChapterProgress page={progress.page} total={progress.totalPages} />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <ChapterMeta chapter={c} />
                  <ChapterDownloadButton
                    mangaId={mangaId ?? ""}
                    chapterId={c.id}
                    info={{ title: mangaTitle, cover: mangaCover, chapter: c.chapter }}
                    serverDownloaded={c.downloaded}
                  />
                  <BookOpen
                    size={18}
                    className="shrink-0 text-ink-subtle transition-colors group-hover:text-accent"
                  />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
        >
          {ordered.map((c) => {
            const cur = isCurrentChapter(progress, c);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  onRead(
                    ascending,
                    ascending.findIndex((x) => x.id === c.id),
                  )
                }
                className={`group flex min-h-[64px] flex-col justify-between gap-2 rounded-xl border bg-surface/60 px-4 py-3.5 text-start transition-colors hover:bg-elevated/60 ${
                  cur ? "border-accent/70" : "border-edge-soft hover:border-edge"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[12px] ${cur ? "text-accent" : "text-ink-subtle"}`}>
                      {c.chapter == null ? t("Oneshot") : t("Ch. {n}", { n: c.chapter })}
                    </span>
                    {c.id === animeEndId && <AnimeEndTag />}
                  </div>
                  <span className="line-clamp-1 text-[15px] font-semibold text-ink">
                    {c.title?.trim() ? c.title : chapterLabel(c.chapter)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {cur && progress ? (
                    <div className="min-w-0 flex-1">
                      <ChapterProgress page={progress.page} total={progress.totalPages} />
                    </div>
                  ) : (
                    <ChapterMeta chapter={c} />
                  )}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <ChapterDownloadButton
                      mangaId={mangaId ?? ""}
                      chapterId={c.id}
                      info={{ title: mangaTitle, cover: mangaCover, chapter: c.chapter }}
                      serverDownloaded={c.downloaded}
                    />
                    <BookOpen
                      size={16}
                      className="shrink-0 text-ink-subtle transition-colors group-hover:text-accent"
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
