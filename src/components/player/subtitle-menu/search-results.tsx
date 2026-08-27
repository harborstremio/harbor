import { Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Plus, Save, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Flag } from "@/components/flag";
import { useContextMenu } from "@/lib/context-menu";
import { saveSubtitleToDisk } from "@/lib/subtitles/save-to-disk";
import { markAddedSub, useAddedSubs } from "@/lib/subtitles/added-subs";
import { wasLimitReached } from "@/lib/subtitles/limit-signal";
import type { SubResult } from "@/lib/subtitles/types";
import { useT } from "@/lib/i18n";

const PAGE_SIZE = 30;

function isMeaningful(s: string | undefined | null): s is string {
  if (!s) return false;
  const trimmed = s.trim();
  if (trimmed.length <= 3) return false;
  if (!/[a-zA-Z]{2,}/.test(trimmed)) return false;
  return true;
}

function filenameFromUrl(url: string): string | null {
  try {
    const last = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() ?? "");
    const withoutExt = last.replace(/\.(srt|vtt|ass|ssa|sub|zip)$/i, "").replace(/[._]+/g, " ").trim();
    return isMeaningful(withoutExt) ? withoutExt : null;
  } catch {
    return null;
  }
}

export function LangGroup({
  lang,
  items,
  defaultOpen,
  onAdd,
}: {
  lang: string;
  items: SubResult[];
  defaultOpen: boolean;
  onAdd: (r: SubResult) => void | Promise<boolean | void>;
}) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [items]);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageItems = items.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  const toggleOpen = () => setOpen((v) => !v);

  return (
    <div className="border-t border-edge-soft/60">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleOpen();
          }
        }}
        className="flex w-full select-none items-center gap-2 bg-canvas/40 px-4 py-2 text-start transition-colors hover:bg-canvas/60"
      >
        <Flag language={lang} size="sm" showLabel={false} />
        <span className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-ink-muted">{t(lang)}</span>
        <span className="text-[11px] tabular-nums text-ink-subtle">{items.length}</span>
        {open && pageCount > 1 && (
          <span className="ms-1 flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPage((p) => Math.max(0, p - 1));
              }}
              disabled={clampedPage === 0}
              aria-label={t("Previous page")}
              className="flex h-5 w-5 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-raised hover:text-ink disabled:opacity-30"
            >
              <ChevronLeft size={12} strokeWidth={2.6} />
            </button>
            <span className="text-[10px] tabular-nums text-ink-subtle">
              {clampedPage + 1}/{pageCount}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPage((p) => Math.min(pageCount - 1, p + 1));
              }}
              disabled={clampedPage === pageCount - 1}
              aria-label={t("Next page")}
              className="flex h-5 w-5 items-center justify-center rounded text-ink-subtle transition-colors hover:bg-raised hover:text-ink disabled:opacity-30"
            >
              <ChevronRight size={12} strokeWidth={2.6} />
            </button>
          </span>
        )}
        <ChevronDown
          size={14}
          strokeWidth={2.4}
          className={`ms-auto shrink-0 text-ink-subtle transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
      </div>
      {open &&
        pageItems.map((r) => (
          <ResultRow key={`${r.source}:${r.id}:${r.url}`} result={r} lang={lang} onAdd={() => onAdd(r)} />
        ))}
    </div>
  );
}

function ResultRow({
  result,
  lang,
  onAdd,
}: {
  result: SubResult;
  lang: string;
  onAdd: () => void | Promise<boolean | void>;
}) {
  const t = useT();
  const { open } = useContextMenu();
  const addedSubs = useAddedSubs();
  const added = addedSubs.has(result.url);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addStatus, setAddStatus] = useState<"failed" | "limited" | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<"failed" | "limited" | null>(null);
  const timer = useRef<number | null>(null);
  const failTimer = useRef<number | null>(null);
  const downloadFailTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (failTimer.current !== null) window.clearTimeout(failTimer.current);
      if (downloadFailTimer.current !== null) window.clearTimeout(downloadFailTimer.current);
    },
    [],
  );

  const handleAdd = async () => {
    if (adding || added) return;
    setAdding(true);
    setAddStatus(null);
    try {
      const ok = await Promise.resolve(onAdd());
      if (ok !== false) {
        markAddedSub(result.url);
        return;
      }
      setAddStatus(wasLimitReached(result.url) ? "limited" : "failed");
      if (failTimer.current !== null) window.clearTimeout(failTimer.current);
      failTimer.current = window.setTimeout(() => setAddStatus(null), 2200);
    } finally {
      setAdding(false);
    }
  };

  const download = async () => {
    if (busy) return;
    setBusy(true);
    setDownloadStatus(null);
    try {
      const outcome = await saveSubtitleToDisk(result.url, {
        title: result.title,
        lang: result.lang,
        format: result.format,
        label: t("Subtitle"),
      });
      if (outcome === "ok") {
        setSaved(true);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setSaved(false), 1400);
      } else {
        setDownloadStatus(outcome);
        if (downloadFailTimer.current !== null) window.clearTimeout(downloadFailTimer.current);
        downloadFailTimer.current = window.setTimeout(() => setDownloadStatus(null), 2200);
      }
    } catch {
      setDownloadStatus("failed");
      if (downloadFailTimer.current !== null) window.clearTimeout(downloadFailTimer.current);
      downloadFailTimer.current = window.setTimeout(() => setDownloadStatus(null), 2200);
    } finally {
      setBusy(false);
    }
  };

  const sourceColor =
    {
      addon: "text-blue-400",
      opensubtitles: "text-emerald-400",
      wyzie: "text-purple-400",
      jimaku: "text-amber-400",
      podnapisi: "text-rose-400",
      subdl: "text-teal-400",
      gestdown: "text-orange-400",
      subsource: "text-sky-400",
    }[result.source] || "text-ink-subtle";

  const primaryName =
    (isMeaningful(result.release) ? result.release : null) ||
    filenameFromUrl(result.url) ||
    result.title ||
    lang;
  const sourceLabel = result.title && result.title !== primaryName ? result.title : null;

  return (
    <div
      onContextMenu={(e) => open(e, { kind: "subtitle", label: primaryName, download })}
      className={`group flex w-full items-start gap-3 px-4 py-2.5 transition-colors duration-300 ${
        added ? "bg-emerald-400/12" : addStatus ? "bg-red-400/10" : "hover:bg-canvas/60"
      }`}
    >
      <button
        onClick={handleAdd}
        disabled={added}
        className="flex min-w-0 flex-1 items-start gap-3 text-start disabled:cursor-default"
      >
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
            added ? "bg-emerald-400/20 text-emerald-300" : addStatus ? "bg-red-400/20 text-red-300" : ""
          }`}
        >
          {adding ? (
            <Loader2 size={14} className="animate-spin text-ink-subtle" />
          ) : added ? (
            <Check size={12} strokeWidth={3} className="animate-in zoom-in-50 duration-200" />
          ) : addStatus ? (
            <X size={12} strokeWidth={3} className="animate-in zoom-in-50 duration-200" />
          ) : (
            <Plus size={14} strokeWidth={2.4} className="text-ink-subtle transition-colors group-hover:text-ink" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span title={primaryName} className="truncate text-[13.5px] text-ink">
              {primaryName}
            </span>
            {added && (
              <span className="shrink-0 rounded bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300 animate-in fade-in slide-in-from-left-1 duration-200">
                {t("Added")}
              </span>
            )}
            {addStatus && (
              <span className="shrink-0 rounded bg-red-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red-300 animate-in fade-in slide-in-from-left-1 duration-200">
                {addStatus === "limited" ? t("Limit reached") : t("Couldn't add, try again")}
              </span>
            )}
          </span>
          <span className="flex items-center gap-2 text-[11.5px] text-ink-subtle">
            <span className={`font-semibold capitalize ${sourceColor}`}>{result.source}</span>
            {sourceLabel && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{sourceLabel}</span>
              </>
            )}
            {result.format && (
              <>
                <span aria-hidden>·</span>
                <span className="uppercase">{result.format}</span>
              </>
            )}
            {typeof result.downloads === "number" && result.downloads > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>{t("{count} dl", { count: compactNumber(result.downloads) })}</span>
              </>
            )}
            {result.hearingImpaired && (
              <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200">
                {t("HI/SDH")}
              </span>
            )}
            {result.forced && (
              <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-200">
                {t("Forced")}
              </span>
            )}
          </span>
        </div>
      </button>
      <span
        role="button"
        tabIndex={0}
        title={
          saved
            ? t("Saved to disk")
            : downloadStatus === "limited"
              ? t("Limit reached")
              : downloadStatus === "failed"
                ? t("Couldn't download, try again")
                : t("Download to disk")
        }
        aria-label={t("Download subtitle to disk")}
        onClick={(e) => {
          e.stopPropagation();
          void download();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            void download();
          }
        }}
        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors ${
          saved ? "text-accent" : downloadStatus ? "text-red-400" : "text-ink-subtle hover:bg-elevated hover:text-ink"
        }`}
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : saved ? (
          <Check size={13} strokeWidth={2.4} />
        ) : downloadStatus ? (
          <X size={13} strokeWidth={2.4} />
        ) : (
          <Save size={13} strokeWidth={2} />
        )}
      </span>
    </div>
  );
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-7 items-center rounded-full px-2.5 text-[11.5px] font-semibold transition-colors ${
        active ? "bg-elevated text-ink ring-1 ring-edge" : "bg-raised text-ink-muted hover:bg-elevated/80"
      }`}
    >
      {children}
    </button>
  );
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
