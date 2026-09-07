import { useEffect, useState } from "react";
import { CoverImg } from "@/components/cover-img";
import { BookOpen, ChevronLeft, FolderOpen, HardDrive, Pause, Play, Trash2, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { MangaChapter } from "@/lib/manga/model";
import {
  cancelMangaDownload,
  defaultMangaDownloadDir,
  deleteMangaDownload,
  hydrateDownloadProgress,
  importMangaDownloadsFromDisk,
  pauseChapterDownload,
  pauseMangaDownloadBatch,
  resumeChapterDownload,
  resumeMangaDownloadBatch,
  setMangaDownloadDir,
  useMangaDownloadBatch,
  useMangaDownloadDir,
  useMangaDownloadGroups,
  type MangaDownloadGroup,
} from "@/lib/manga-downloads";

type MangaMeta = { id: string; title: string; cover?: string };

function readerChapters(group: MangaDownloadGroup): MangaChapter[] {
  return group.chapters.map((c) => ({
    id: c.chapterId,
    chapter: c.chapterRaw === undefined ? null : c.chapterRaw,
    pages: c.pages,
    language: "en",
  }));
}

function DownloadGroupSection({
  group,
  onOpenManga,
  onRead,
}: {
  group: MangaDownloadGroup;
  onOpenManga: (id: string) => void;
  onRead: (chapters: MangaChapter[], index: number, manga: MangaMeta) => void;
}) {
  const t = useT();
  const batch = useMangaDownloadBatch(group.key);
  const batchDownloading = batch.status === "downloading";
  const batchPaused = batch.status === "paused";

  return (
    <section className="overflow-hidden rounded-2xl border border-edge-soft bg-surface/40">
      <div className="flex items-center gap-4 border-b border-edge-soft/60 px-5 py-4">
        <button
          type="button"
          onClick={() => onOpenManga(group.key)}
          className="flex min-w-0 flex-1 items-center gap-4 text-start"
        >
          {group.cover ? (
            <CoverImg
              src={group.cover}
              alt=""
              className="h-16 w-11 shrink-0 rounded-lg object-cover ring-1 ring-edge-soft"
            />
          ) : (
            <span className="grid h-16 w-11 shrink-0 place-items-center rounded-lg bg-elevated/60 text-ink-subtle ring-1 ring-edge-soft">
              <BookOpen size={18} />
            </span>
          )}
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[16px] font-semibold text-ink">{group.title}</span>
            <span className="text-[12.5px] text-ink-subtle">
              {group.chapters.length === 1
                ? t("{n} chapter", { n: group.chapters.length })
                : t("{n} chapters", { n: group.chapters.length })}{" "}
              · {t("{n} pages", { n: group.chapters.reduce((n, c) => n + c.pages, 0) })}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          {(batchDownloading || batchPaused) && (
            <button
              type="button"
              aria-label={batchPaused ? t("Resume downloads") : t("Pause downloads")}
              onClick={() =>
                batchPaused
                  ? resumeMangaDownloadBatch(group.key)
                  : pauseMangaDownloadBatch(group.key)
              }
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-elevated/60 hover:text-ink"
            >
              {batchPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              for (const c of group.chapters) {
                if (c.rec && c.rec.status !== "idle" && c.rec.status !== "done") {
                  cancelMangaDownload(c.chapterId);
                } else {
                  deleteMangaDownload(c.chapterId);
                }
              }
            }}
            className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-ink-subtle transition-colors hover:bg-danger/10 hover:text-danger"
          >
            {t("Remove all")}
          </button>
        </div>
      </div>
      {group.chapters.map((c, i) => {
        const active = c.rec && c.rec.status !== "idle" && c.rec.status !== "done";
        const downloading = c.rec?.status === "downloading";
        const paused = c.rec?.status === "paused";
        const failed = c.rec?.status === "error";
        const pct = c.rec && c.rec.total > 0 ? Math.round((c.rec.done / c.rec.total) * 100) : 0;
        return (
          <div
            key={c.chapterId}
            className="flex flex-col gap-2 border-b border-edge-soft/40 px-5 py-3 last:border-b-0"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col">
                <span
                  className={
                    failed
                      ? "truncate text-[14.5px] font-medium text-danger"
                      : "truncate text-[14.5px] font-medium text-ink"
                  }
                >
                  {c.label}
                </span>
                {!active && (
                  <span className="text-[12px] text-ink-subtle">
                    {t("{n} pages", { n: c.pages })}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {active ? (
                  <>
                    <span className="mr-1 text-[12px] tabular-nums text-ink-muted">
                      {c.rec!.total > 0
                        ? `${Math.min(c.rec!.done, c.rec!.total)} / ${c.rec!.total}`
                        : t("Resolving pages")}
                    </span>
                    {(downloading || paused) && (
                      <button
                        type="button"
                        aria-label={paused ? t("Resume download") : t("Pause download")}
                        onClick={() =>
                          paused
                            ? resumeChapterDownload(c.chapterId)
                            : pauseChapterDownload(c.chapterId)
                        }
                        className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-elevated/60 hover:text-ink"
                      >
                        {paused ? <Play size={15} /> : <Pause size={15} />}
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={t("Cancel download")}
                      onClick={() => cancelMangaDownload(c.chapterId)}
                      className="grid h-9 w-9 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        onRead(readerChapters(group), i, {
                          id: group.key,
                          title: group.title,
                          cover: group.cover,
                        })
                      }
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-muted transition-colors hover:bg-elevated/60 hover:text-ink"
                    >
                      <BookOpen size={15} />
                      {t("Read")}
                    </button>
                    <button
                      type="button"
                      aria-label={t("Delete download")}
                      onClick={() => deleteMangaDownload(c.chapterId)}
                      className="grid h-9 w-9 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
            {active && (
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated/60">
                  <div
                    className={
                      failed
                        ? "h-full rounded-full bg-danger"
                        : "h-full rounded-full bg-accent transition-[width] duration-200"
                    }
                    style={{ width: `${failed ? 100 : pct}%` }}
                  />
                </div>
                <span className="w-10 text-end text-[11.5px] tabular-nums text-ink-subtle">
                  {failed ? t("Failed") : `${pct}%`}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function LocationCard() {
  const t = useT();
  const custom = useMangaDownloadDir();
  const [fallback, setFallback] = useState("");
  useEffect(() => {
    defaultMangaDownloadDir().then(setFallback).catch(() => {});
  }, []);
  const shown = custom || fallback;

  const change = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const picked = await open({ directory: true, title: t("Choose manga download folder") });
      if (typeof picked === "string" && picked) setMangaDownloadDir(picked);
    } catch {
      return;
    }
  };

  const reveal = async () => {
    if (!shown) return;
    try {
      const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
      await revealItemInDir(shown);
    } catch {
      return;
    }
  };

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-edge-soft bg-surface/40 px-5 py-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-elevated/60 text-ink-muted ring-1 ring-edge-soft">
        <HardDrive size={19} strokeWidth={1.9} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14.5px] font-semibold text-ink">{t("Storage location")}</span>
        <span className="truncate text-[12.5px] text-ink-subtle" title={shown}>
          {shown || "…"}
        </span>
        <span className="text-[12px] text-ink-subtle/80">
          {t("New downloads are saved here. Chapters you already saved stay where they are.")}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {custom && (
          <button
            type="button"
            onClick={() => setMangaDownloadDir("")}
            className="h-10 rounded-xl px-3.5 text-[13px] font-medium text-ink-subtle transition-colors hover:bg-elevated/60 hover:text-ink"
          >
            {t("Use default")}
          </button>
        )}
        <button
          type="button"
          onClick={() => void reveal()}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-edge-soft bg-surface/60 px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:bg-elevated/60 hover:text-ink"
        >
          <FolderOpen size={15} />
          {t("Open")}
        </button>
        <button
          type="button"
          onClick={() => void change()}
          className="h-10 rounded-xl bg-ink px-4 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
        >
          {t("Change folder")}
        </button>
      </div>
    </section>
  );
}

export function MangaDownloadsView({
  onBack,
  onOpenManga,
  onRead,
}: {
  onBack: () => void;
  onOpenManga: (id: string) => void;
  onRead: (chapters: MangaChapter[], index: number, manga: MangaMeta) => void;
}) {
  const t = useT();
  const groups = useMangaDownloadGroups();
  useEffect(() => {
    void importMangaDownloadsFromDisk();
    hydrateDownloadProgress();
  }, []);
  const totalChapters = groups.reduce((n, g) => n + g.chapters.length, 0);
  const totalPages = groups.reduce((n, g) => n + g.chapters.reduce((p, c) => p + c.pages, 0), 0);

  return (
    <div className="flex flex-col gap-7">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-7 inline-flex items-center gap-1.5 rounded-full border border-edge-soft bg-canvas/40 px-4 py-2 text-[14px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <ChevronLeft size={18} />
          {t("Back")}
        </button>
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-[32px] font-medium tracking-tight text-ink">{t("Downloads")}</h1>
          {totalChapters > 0 && (
            <span className="text-[15px] text-ink-subtle">
              {totalChapters === 1
                ? t("{n} chapter", { n: totalChapters })
                : t("{n} chapters", { n: totalChapters })}{" "}
              · {t("{n} pages", { n: totalPages })}
            </span>
          )}
        </div>
      </div>

      <LocationCard />

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-edge-soft bg-surface/40 px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-elevated/50 text-ink-subtle ring-1 ring-edge-soft">
            <BookOpen size={24} strokeWidth={1.8} />
          </span>
          <p className="text-[15.5px] font-medium text-ink">{t("No downloads yet")}</p>
          <p className="max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
            {t("Use the download arrow next to any chapter to save it for reading offline.")}
          </p>
        </div>
      ) : (
        groups.map((g) => (
          <DownloadGroupSection key={g.key} group={g} onOpenManga={onOpenManga} onRead={onRead} />
        ))
      )}
    </div>
  );
}
