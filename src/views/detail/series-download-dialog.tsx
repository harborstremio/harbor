import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { ModalShell } from "@/components/modal-shell";
import { toggleAutoDownload, useIsAutoDownloaded } from "@/lib/auto-download";
import type { Meta } from "@/lib/cinemeta";
import {
  availableDownloadEpisodes,
  endsInFinalSeason,
  episodeRange,
  remainingSeasonRange,
  type DownloadEpisode,
} from "@/lib/download/episode-range";
import { useDownloads } from "@/lib/download/downloads-store";
import { episodeDownloadStatus } from "@/lib/download/episode-download-state";
import { pendingSeasonEpisodes } from "@/lib/download/season-download";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";

export function SeriesDownloadDialog({
  meta,
  mode,
  resumeTarget,
  currentSeason,
  loadEpisodes,
  onClose,
}: {
  meta: Meta;
  mode: "all" | "remaining";
  resumeTarget?: { season: number; episode: number };
  currentSeason?: number;
  loadEpisodes: () => Promise<DownloadEpisode[]>;
  onClose: () => void;
}) {
  const t = useT();
  const titleId = useId();
  const { openPicker } = useView();
  const autoOn = useIsAutoDownloaded(meta.id);
  const downloads = useDownloads();
  const loadRef = useRef(loadEpisodes);
  loadRef.current = loadEpisodes;
  const resumeRef = useRef(resumeTarget);
  resumeRef.current = resumeTarget;
  const seasonRef = useRef(currentSeason);
  seasonRef.current = currentSeason;
  const [all, setAll] = useState<DownloadEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(-1);
  const [activePreset, setActivePreset] = useState<"all" | "remaining" | "custom">(mode);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setFailed(false);
    void loadRef
      .current()
      .then((episodes) => {
        if (canceled) return;
        const available = availableDownloadEpisodes(episodes);
        setAll(episodes);
        const range = remainingSeasonRange(available, seasonRef.current, resumeRef.current);
        setStart(mode === "remaining" ? range.start : 0);
        setEnd(mode === "remaining" ? range.end : available.length - 1);
      })
      .catch(() => {
        if (!canceled) setFailed(true);
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, [mode, attempt]);

  useEffect(() => {
    setActivePreset(mode);
  }, [mode]);

  useEffect(() => {
    if (loading || activePreset !== "remaining") return;
    const range = remainingSeasonRange(availableDownloadEpisodes(all), currentSeason, resumeTarget);
    setStart(range.start);
    setEnd(range.end);
  }, [activePreset, all, loading, currentSeason, resumeTarget?.season, resumeTarget?.episode]);

  useEffect(() => {
    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !(event.target instanceof Element)) return;
      if (!event.target.closest("[data-dropdown-menu]")) return;
      const dialog = document.querySelector<HTMLElement>(
        `[role="dialog"][aria-labelledby="${titleId}"]`,
      );
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled)"),
      );
      const openDropdown = focusable.find(
        (element) => element.getAttribute("aria-expanded") === "true",
      );
      const at = openDropdown ? focusable.indexOf(openDropdown) : -1;
      const next = event.shiftKey ? at - 1 : at + 1;
      const target = focusable[next] ?? focusable[event.shiftKey ? focusable.length - 1 : 0];
      if (!target) return;
      event.preventDefault();
      target.focus();
    };
    document.addEventListener("keydown", onTab, true);
    return () => document.removeEventListener("keydown", onTab, true);
  }, [titleId]);

  const available = availableDownloadEpisodes(all);
  const selected = episodeRange(available, start, end);
  const pending = pendingSeasonEpisodes(meta.id, selected);
  const label = (ep: DownloadEpisode) =>
    t("S{season} E{episode}", { season: ep.season, episode: ep.episode });
  const hasRange = selected.length > 0;
  const seasons = [...new Set(available.map((ep) => ep.season))];
  const seasonOptions: DropdownOption[] = seasons.map((season) => ({
    value: String(season),
    label: `S${season}`,
  }));
  const boundIndex = (bound: "start" | "end") => (bound === "start" ? start : end);
  const boundSeason = (bound: "start" | "end") => {
    const index = boundIndex(bound);
    if (bound === "start" && index === available.length && currentSeason != null)
      return String(currentSeason);
    return String(available[Math.min(index, available.length - 1)]?.season ?? seasons[0] ?? "");
  };
  const setBound = (bound: "start" | "end", index: number) => {
    setActivePreset("custom");
    if (bound === "start") {
      setStart(index);
      if (index > end) setEnd(index);
    } else {
      setEnd(index);
      if (index < start) setStart(index);
    }
  };
  const summary = hasRange
    ? t("Download episode {start} -> {end}", {
        start: label(selected[0]!),
        end: label(selected[selected.length - 1]!),
      })
    : t("No remaining episodes");

  return (
    <ModalShell
      closing={false}
      onDismiss={onClose}
      labelledBy={titleId}
      width={520}
      backdropClassName="bg-black/60 backdrop-blur-sm"
    >
      <div
        className="flex flex-col gap-5 overflow-y-auto p-6"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), select:not(:disabled)",
          );
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-ink">
              {t("Download series")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{meta.name}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="rounded-lg p-2 text-ink-muted hover:bg-raised"
          >
            <X size={18} />
          </button>
        </header>
        {loading ? (
          <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 size={16} className="animate-spin" />
            {t("Loading episodes...")}
          </p>
        ) : failed ? (
          <div role="alert" className="flex flex-col gap-3 text-sm text-ink-muted">
            <p>{t("Could not load every season. Try again before downloading the series.")}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="self-start rounded-lg border border-edge px-3 py-2"
            >
              {t("Try again")}
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={available.length === 0}
                onClick={() => {
                  setActivePreset("all");
                  setStart(0);
                  setEnd(available.length - 1);
                }}
                className="rounded-lg border border-edge px-3 py-2 text-sm text-ink hover:bg-raised disabled:opacity-45"
              >
                {t("Entire series")}
              </button>
              <button
                type="button"
                disabled={available.length === 0}
                onClick={() => {
                  setActivePreset("remaining");
                  const range = remainingSeasonRange(available, currentSeason, resumeTarget);
                  setStart(range.start);
                  setEnd(range.end);
                }}
                className="rounded-lg border border-edge px-3 py-2 text-sm text-ink hover:bg-raised disabled:opacity-45"
              >
                {t("Remaining in this season")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["start", "end"] as const).map((bound) => {
                const indices = available.flatMap((ep, index) =>
                  ep.season === Number(boundSeason(bound)) ? [index] : [],
                );
                const episodeOptions: DropdownOption[] = indices.map((index) => {
                  const episode = available[index]!;
                  const status = episodeDownloadStatus(downloads, meta.id, episode);
                  const suffix = status === "done" ? t("Downloaded") : status ? t("Queued") : null;
                  return {
                    value: String(index),
                    label: `E${episode.episode}${suffix ? ` · ${suffix}` : ""}`,
                    disabled: status !== null,
                  };
                });
                if (bound === "start" && start === available.length) {
                  episodeOptions.unshift({
                    value: "empty",
                    label: t("No remaining episodes"),
                  });
                }
                return (
                  <div key={bound} className="flex min-w-0 flex-col gap-2">
                    <span className="text-sm text-ink-muted">
                      {bound === "start" ? t("From episode") : t("To episode")}
                    </span>
                    <div className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-1.5">
                      {available.length > 0 ? (
                        <>
                          <Dropdown
                            value={boundSeason(bound)}
                            options={seasonOptions}
                            ariaLabel={bound === "start" ? t("From season") : t("To season")}
                            size="sm"
                            onChange={(value) => {
                              const seasonIndices = available.flatMap((ep, index) =>
                                ep.season === Number(value) ? [index] : [],
                              );
                              const index =
                                bound === "start" ? seasonIndices[0] : seasonIndices.at(-1);
                              if (index !== undefined) setBound(bound, index);
                            }}
                          />
                          <Dropdown
                            value={
                              bound === "start" && start === available.length
                                ? "empty"
                                : String(boundIndex(bound))
                            }
                            options={episodeOptions}
                            ariaLabel={bound === "start" ? t("From episode") : t("To episode")}
                            size="sm"
                            onChange={(value) => {
                              if (value !== "empty") setBound(bound, Number(value));
                            }}
                          />
                        </>
                      ) : (
                        <>
                          {[t("Season"), t("Episode")].map((part) => (
                            <button
                              key={part}
                              type="button"
                              disabled
                              className="h-9 min-w-0 truncate rounded-md bg-canvas px-3 text-start text-[12.5px] text-ink-subtle opacity-60"
                            >
                              {part}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p aria-live="polite" className="text-sm font-medium text-ink">
              {summary}
              {hasRange && endsInFinalSeason(selected.at(-1), all) ? ` (${t("final")})` : ""}
            </p>
            <p className="text-xs text-ink-muted">
              {pending.length === 1
                ? t("1 episode to download. Saved and queued episodes are skipped.")
                : t("{n} episodes to download. Saved and queued episodes are skipped.", {
                    n: pending.length,
                  })}
            </p>
          </>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={autoOn}
          onClick={() => toggleAutoDownload(meta)}
          className="flex items-center justify-between gap-4 rounded-lg border border-edge p-3 text-start"
        >
          <span className="text-sm text-ink">{t("Auto-download new episodes")}</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${autoOn ? "bg-accent/15 text-accent" : "bg-raised text-ink-muted"}`}
          >
            {autoOn ? t("On") : t("Off")}
          </span>
        </button>
        <button
          type="button"
          disabled={loading || failed || pending.length === 0}
          onClick={() => {
            const first = pending[0];
            if (!first) return;
            onClose();
            openPicker(meta, first, { intent: "download", seasonEpisodes: pending });
          }}
          className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-canvas disabled:cursor-not-allowed disabled:opacity-45"
        >
          {t("Continue")}
        </button>
      </div>
    </ModalShell>
  );
}
