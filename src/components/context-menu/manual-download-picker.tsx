import { ArrowDownToLine, Check, ImageOff, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HoverTooltip } from "@/components/hover-tooltip";
import { Poster } from "@/components/poster";
import { toggleAutoDownload, useIsAutoDownloaded } from "@/lib/auto-download";
import type { Meta } from "@/lib/cinemeta";
import {
  contextDownloadTask,
  selectedDownloadEpisode,
} from "@/lib/download/contextual-preparation";
import {
  downloadsSnapshot,
  completedDownloadFor,
  useDownloads,
} from "@/lib/download/downloads-store";
import { pendingSeasonEpisodes } from "@/lib/download/season-download";
import { useT } from "@/lib/i18n";
import { SPOILER_TEXT_CLASS, SPOILER_THUMB_CLASS } from "@/lib/spoilers";
import type { PlayEpisode } from "@/lib/view";
import { saveAutoDownloadChange } from "@/views/downloads/auto-download-feedback";
import { useDownloadEpisodes } from "./use-download-episodes";
import { useDownloadTitle } from "./use-download-title";
import "./manual-download-picker.css";

export function ManualDownloadPicker({
  meta,
  episode,
  visible,
  isCurrent,
  onPick,
  onClose,
}: {
  meta: Meta;
  episode?: PlayEpisode;
  visible: boolean;
  isCurrent: () => boolean;
  onPick: (meta: Meta, episode?: PlayEpisode, seasonEpisodes?: PlayEpisode[]) => void;
  onClose: () => void;
}) {
  const t = useT();
  const title = useDownloadTitle(meta, isCurrent);
  const data = useDownloadEpisodes(title, episode, isCurrent);
  const series = meta.type === "series";
  const autoOn = useIsAutoDownloaded(meta.id);
  const downloads = useDownloads();
  const visibleKeys = new Set(
    series
      ? data.episodes.map((ep) => `${ep.sourceMetaId ?? meta.id}:${ep.season}:${ep.episode}`)
      : [`${meta.id}:null:null`],
  );
  const completed = downloads.filter(
    (item) =>
      item.status === "done" && visibleKeys.has(`${item.metaId}:${item.season}:${item.episode}`),
  );
  const completedKey = completed.map((item) => `${item.metaId}:${item.id}:${item.path}`).join("|");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [verifiedKey, setVerifiedKey] = useState("");
  useEffect(() => {
    let cancelled = false;
    const targets = [
      ...new Map(
        completed.map((item) => [`${item.metaId}:${item.season}:${item.episode}`, item]),
      ).values(),
    ];
    void Promise.all(
      targets.map(async (item) => {
        const file = await completedDownloadFor(item.metaId, item.season, item.episode);
        return file ? `${item.metaId}:${item.season}:${item.episode}` : null;
      }),
    ).then((keys) => {
      if (!cancelled && isCurrent()) {
        setSaved(new Set(keys.filter((key): key is string => key != null)));
        setVerifiedKey(completedKey);
      }
    });
    return () => {
      cancelled = true;
    };
    // Progress ticks do not require repeating file existence checks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedKey, visible]);
  const [failedLogo, setFailedLogo] = useState<string>();
  const [failedBackdrop, setFailedBackdrop] = useState<string>();
  const [autoError, setAutoError] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const autoBusy = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<string | undefined>(undefined);
  const previousScroll = useRef({ episodes: 0, seasons: 0 });
  const close = useRef(onClose);
  close.current = onClose;
  const logo = title.logo !== failedLogo ? title.logo : undefined;
  const backdrop = title.backdrop !== failedBackdrop ? title.backdrop : undefined;

  useEffect(() => {
    if (!visible) return;
    const controls = () =>
      Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []);
    const content = panel.current?.querySelector(".context-download-content");
    const seasons = panel.current?.querySelector(".context-download-seasons");
    if (content) content.scrollTop = previousScroll.current.episodes;
    if (seasons) seasons.scrollLeft = previousScroll.current.seasons;
    const first =
      (previousFocus.current &&
        panel.current?.querySelector<HTMLElement>(`${previousFocus.current}:not(:disabled)`)) ||
      panel.current?.querySelector<HTMLElement>(
        ".context-download-seasons button[aria-pressed=true], .context-download-source:not(:disabled)",
      ) ||
      panel.current;
    first?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (!panel.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current();
        return;
      }
      const items = controls();
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.key === "Tab" || event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopImmediatePropagation();
        const delta = event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey) ? -1 : 1;
        const next = items[(index + delta + items.length) % items.length];
        next?.focus();
        next?.scrollIntoView({ block: "nearest", inline: "nearest" });
      } else if (event.target === window && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) items[index]?.click();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [visible]);

  const choose = (selected?: PlayEpisode, seasonEpisodes?: PlayEpisode[]) => {
    if (!isCurrent()) return;
    const focused = document.activeElement as HTMLElement | null;
    const focusedEpisode = focused?.dataset.downloadEpisode;
    previousFocus.current = focusedEpisode
      ? `[data-download-episode="${focusedEpisode}"]`
      : focused?.hasAttribute("data-download-season")
        ? "[data-download-season]"
        : ".context-download-source";
    previousScroll.current = {
      episodes: panel.current?.querySelector(".context-download-content")?.scrollTop ?? 0,
      seasons: panel.current?.querySelector(".context-download-seasons")?.scrollLeft ?? 0,
    };
    const target = selected ? selectedDownloadEpisode(selected, episode) : undefined;
    const sourceMeta =
      target?.sourceMetaId && target.sourceMetaId !== title.meta.id
        ? { ...title.meta, id: target.sourceMetaId }
        : title.meta;
    onPick(sourceMeta, target, seasonEpisodes);
  };
  const changeAuto = () => {
    if (!isCurrent() || autoBusy.current) return;
    autoBusy.current = true;
    setAutoSaving(true);
    setAutoError(false);
    try {
      setAutoError(!saveAutoDownloadChange(() => toggleAutoDownload(title.meta)));
    } finally {
      autoBusy.current = false;
      setAutoSaving(false);
    }
  };
  const available = data.episodes.filter(
    (ep) => !ep.airDate || !(Date.parse(ep.airDate) > Date.now()),
  );
  const missingCompleted = new Set(
    verifiedKey === completedKey
      ? completed
          .filter((item) => !saved.has(`${item.metaId}:${item.season}:${item.episode}`))
          .map((item) => item.id)
      : [],
  );
  const pendingEpisodes = pendingSeasonEpisodes(meta.id, available, missingCompleted);
  const movieTask = series ? null : contextDownloadTask(downloads, meta.id);
  const movieSaved = saved.has(`${meta.id}:null:null`);
  const movieBusy =
    !!movieTask &&
    movieTask.status !== "error" &&
    movieTask.status !== "canceled" &&
    movieTask.status !== "done";
  if (!visible) return null;

  return createPortal(
    <div
      data-harbor-context-layer
      data-context-submenu
      data-harbor-menu-panel
      className="context-download-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-download-title"
        tabIndex={-1}
        className="context-download-panel"
      >
        <div className="context-download-header">
          {backdrop && (
            <img
              src={backdrop}
              alt=""
              aria-hidden
              className="context-download-backdrop"
              decoding="async"
              onError={() => setFailedBackdrop(backdrop)}
            />
          )}
          <div className="context-download-header-shade" />
          <div className="context-download-toolbar">
            <span className="text-[12px] font-semibold tracking-wide text-ink-muted">
              {t("Download")}
            </span>
            <div className="flex items-center gap-2">
              {series && (
                <HoverTooltip
                  contextMenu
                  label={
                    autoOn
                      ? t("Enabled for newly released episodes")
                      : t("Grab each new episode as it airs")
                  }
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoOn}
                    disabled={autoSaving}
                    onClick={changeAuto}
                    className={`context-download-auto ${autoOn ? "is-enabled" : ""}`}
                  >
                    {autoSaving ? (
                      <LoaderCircle size={14} aria-hidden className="animate-spin" />
                    ) : autoOn ? (
                      <Check size={14} aria-hidden />
                    ) : (
                      <ArrowDownToLine size={14} aria-hidden />
                    )}
                    <span>{t("Auto-download new episodes")}</span>
                  </button>
                </HoverTooltip>
              )}
              <HoverTooltip contextMenu label={t("Close")}>
                <button
                  type="button"
                  className="context-download-close"
                  aria-label={t("Close")}
                  onClick={onClose}
                >
                  <X size={17} aria-hidden />
                </button>
              </HoverTooltip>
            </div>
          </div>
          <div className="context-download-title-slot">
            <h2 id="context-download-title" className={logo ? "sr-only" : "context-download-title"}>
              {title.meta.name}
            </h2>
            {logo && (
              <img
                src={logo}
                alt=""
                aria-hidden
                className="context-download-logo"
                decoding="async"
                onError={() => setFailedLogo(logo)}
              />
            )}
          </div>
          <p className="relative text-[12px] text-ink-muted">
            {series
              ? t("Choose an episode or season, then choose a source.")
              : t("Choose a source to download this movie.")}
          </p>
        </div>
        {autoError && (
          <p role="alert" className="px-4 py-2 text-[12px] text-danger">
            {t("Could not save automatic download settings. Your previous settings were kept.")}
          </p>
        )}
        {series && data.seasons.length > 0 && (
          <div role="group" aria-label={t("Season")} className="context-download-seasons">
            {data.seasons.map((s) => (
              <button
                key={s.seasonNumber}
                type="button"
                aria-pressed={s.seasonNumber === data.season}
                onClick={() => data.selectSeason(s.seasonNumber)}
              >
                {s.seasonNumber === 0 ? t("Specials") : t("Season {n}", { n: s.seasonNumber })}
              </button>
            ))}
          </div>
        )}
        <div
          className={`context-download-content ${series ? "" : "is-movie"}`}
          aria-busy={series && data.pending}
        >
          {!series ? (
            <div className="px-2 py-3">
              <button
                type="button"
                className="context-download-source"
                disabled={movieSaved || movieBusy || verifiedKey !== completedKey}
                onClick={() => {
                  const now = contextDownloadTask(downloadsSnapshot(), meta.id);
                  if (
                    (!now ||
                      now.status === "error" ||
                      now.status === "canceled" ||
                      now.status === "done") &&
                    !movieSaved
                  )
                    choose();
                }}
              >
                <ArrowDownToLine size={17} aria-hidden />{" "}
                {verifiedKey !== completedKey
                  ? t("Checking file…")
                  : movieSaved
                    ? t("Saved offline")
                    : movieBusy
                      ? t("In downloads")
                      : t("Choose source")}
              </button>
            </div>
          ) : data.pending ? (
            <p role="status" className="px-3 py-5 text-[13px] text-ink-muted">
              {t("Loading episodes…")}
            </p>
          ) : data.failed ? (
            <div role="alert" className="px-3 py-5 text-[13px] text-ink-muted">
              <p>{t("Could not load episodes. Try again.")}</p>
              <button
                type="button"
                onClick={data.retry}
                className="mt-3 rounded-lg bg-raised px-3 py-2 text-ink"
              >
                {t("Try again")}
              </button>
            </div>
          ) : !data.episodes.length ? (
            <p role="status" className="px-3 py-5 text-[13px] text-ink-muted">
              {t("No episodes available from this title’s providers.")}
            </p>
          ) : (
            data.episodes.map((ep) => {
              const task = contextDownloadTask(downloads, ep.sourceMetaId ?? meta.id, ep);
              const notReleased = !!ep.airDate && Date.parse(ep.airDate) > Date.now();
              const offline = saved.has(`${ep.sourceMetaId ?? meta.id}:${ep.season}:${ep.episode}`);
              const checkingFile = task?.status === "done" && verifiedKey !== completedKey;
              const busy =
                checkingFile ||
                offline ||
                (!!task &&
                  task.status !== "error" &&
                  task.status !== "canceled" &&
                  task.status !== "done");
              const mask = data.masks.get(ep);
              const identity = `S${ep.season} · ${t("Episode {n}", { n: ep.episode })}`;
              return (
                <button
                  key={`${ep.sourceMetaId ?? meta.id}:${ep.season}:${ep.episode}:${ep.videoId ?? ep.kitsuStreamId ?? ""}`}
                  type="button"
                  data-download-episode={`${ep.season}:${ep.episode}`}
                  disabled={notReleased || busy}
                  aria-label={
                    mask?.title ? identity : `${identity}${ep.name ? ` · ${ep.name}` : ""}`
                  }
                  className="context-download-episode group"
                  onClick={() => {
                    const now = contextDownloadTask(
                      downloadsSnapshot(),
                      ep.sourceMetaId ?? meta.id,
                      ep,
                    );
                    if (
                      (!now ||
                        now.status === "error" ||
                        now.status === "canceled" ||
                        now.status === "done") &&
                      !offline &&
                      !notReleased
                    )
                      choose(ep);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[11px] font-medium text-ink-subtle">
                      {identity}
                      {data.progress.get(ep)?.watched && (
                        <Check size={12} className="text-success" aria-hidden />
                      )}
                    </span>
                    <span
                      aria-hidden={mask?.title || undefined}
                      className={`mt-1 block truncate text-[13px] font-medium text-ink ${mask?.title ? SPOILER_TEXT_CLASS : ""}`}
                    >
                      {ep.name || t("Episode {n}", { n: ep.episode })}
                    </span>
                    {(notReleased || task) && (
                      <span className="mt-1 block text-[11px] text-ink-muted">
                        {notReleased
                          ? t("Not released")
                          : checkingFile
                            ? t("Checking file…")
                            : offline
                              ? t("Saved offline")
                              : task?.status === "done"
                                ? t("File unavailable")
                                : task?.status === "downloading"
                                  ? t("Downloading {pct} percent", {
                                      pct: Math.round(task.ratio * 100),
                                    })
                                  : task?.status === "error"
                                    ? t("Retry download")
                                    : busy
                                      ? t("In downloads")
                                      : ""}
                      </span>
                    )}
                  </div>
                  <div className="context-download-still" aria-hidden>
                    {ep.still ? (
                      <div className={mask?.thumb ? SPOILER_THUMB_CLASS : undefined}>
                        <Poster
                          src={ep.still}
                          seed={`${meta.id}:${ep.season}:${ep.episode}`}
                          ratio="landscape"
                          lazy
                        />
                      </div>
                    ) : (
                      <ImageOff size={18} className="text-ink-subtle" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
        {series && !data.pending && !data.failed && data.episodes.length > 0 && (
          <div className="context-download-bottom">
            <button
              type="button"
              data-download-season
              className="context-download-source"
              disabled={!pendingEpisodes.length}
              onClick={() => {
                const current = pendingSeasonEpisodes(meta.id, available, missingCompleted);
                if (current[0]) choose(current[0], current);
              }}
            >
              <ArrowDownToLine size={16} aria-hidden /> {t("Download this season")}
              {pendingEpisodes.length > 0 && (
                <span className="text-ink-muted">
                  · {t("{n} episodes", { n: pendingEpisodes.length })}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.fullscreenElement ?? document.body,
  );
}
