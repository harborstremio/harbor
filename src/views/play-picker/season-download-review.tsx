import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Loader2, Search, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import type { Addon } from "@/lib/addons";
import type { Meta } from "@/lib/cinemeta";
import type { DebridStore } from "@/lib/debrid/types";
import {
  downloadReviewedSeasonEpisodes,
  findSeasonDownloadSources,
  pendingSeasonEpisodes,
  type SeasonReviewCandidate,
} from "@/lib/download/season-download";
import type { ScoredStream } from "@/lib/streams/types";
import type { PlayEpisode } from "@/lib/view";
import { useT } from "@/lib/i18n";
import type { ResolveOptions } from "@/lib/auto-download/resolve";
import { useDownloads } from "@/lib/download/downloads-store";

type ReviewRow = SeasonReviewCandidate & {
  selected: number | null;
  result?: "queued" | "failed";
};

function episodeKey(episode: PlayEpisode): string {
  return `${episode.season}:${episode.episode}:${episode.imdbId ?? episode.videoId ?? episode.kitsuStreamId ?? ""}`;
}

function safeDisplayText(raw: string): string {
  return raw
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "")
    .replace(/\b[^\s/@:]+:[^\s/@]+@[^\s/]+(?:\/\S*)?/g, "")
    .replace(/\b(?:token|password|passwd|api[_-]?key)=\S+/gi, "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function safeCandidateTitle(stream: ScoredStream): string {
  const raw =
    stream.behaviorHints?.filename ??
    stream.behaviorHints?.fileName ??
    stream.parsedTitle ??
    stream.title ??
    stream.name ??
    "";
  const value = safeDisplayText(raw);
  return value || "Unnamed source";
}

function safeAddonName(stream: ScoredStream): string {
  return safeDisplayText(stream.addonName || "Addon") || "Addon";
}

function streamQuality(stream: ScoredStream): string {
  return [stream.resolution, stream.hdrFormat, stream.source !== "Other" ? stream.source : null]
    .filter(Boolean)
    .join(" ");
}

function streamAudioTags(stream: ScoredStream): string[] {
  const text = [
    stream.behaviorHints?.filename,
    stream.behaviorHints?.fileName,
    stream.parsedTitle,
    stream.title,
    stream.description,
    stream.name,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
  const tags = new Set<string>();
  if (/\bdual(?:[ ._-]?audio)?\b/i.test(text)) tags.add("DUAL");
  if (/\bdub(?:bed)?\b/i.test(text)) tags.add("DUB");
  if (/\bsub(?:bed)?\b/i.test(text)) tags.add("SUB");
  return [...tags];
}

function safeCandidateDetails(stream: ScoredStream): string[] {
  const primary = safeCandidateTitle(stream);
  return [stream.name, stream.title, stream.description]
    .filter((part): part is string => Boolean(part))
    .map(safeDisplayText)
    .filter((part) => part && part !== primary)
    .filter((part, index, all) => all.indexOf(part) === index);
}

function sizeLabel(size: number | null): string | null {
  if (!size || !Number.isFinite(size) || size <= 0) return null;
  return size >= 1024 ** 3
    ? `${(size / 1024 ** 3).toFixed(1)} GB`
    : `${Math.round(size / 1024 ** 2)} MB`;
}

export function SeasonDownloadReview({
  meta,
  episodes,
  addons,
  debrids,
  allowP2p,
  imdbId,
  disabled,
  onBusyChange,
  autoDownload,
}: {
  meta: Meta;
  episodes: PlayEpisode[];
  addons: Addon[];
  debrids: DebridStore[];
  allowP2p: boolean;
  imdbId: string | null;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  autoDownload: {
    busy: boolean;
    ready: boolean;
    status: string | null;
    onStart: () => void;
  };
}) {
  const t = useT();
  const downloads = useDownloads();
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const pending = useMemo(
    () => pendingSeasonEpisodes(meta.id, episodes),
    [meta.id, episodes, downloads],
  );

  useEffect(() => () => controller.current?.abort(), []);

  const options = (signal: AbortSignal): ResolveOptions => ({
    allowP2p,
    maxHeight: null,
    imdbId,
    debrids,
    addons,
    signal,
  });

  const find = async () => {
    if (disabled || !autoDownload.ready || controller.current || pending.length === 0) return;
    const ac = new AbortController();
    controller.current = ac;
    onBusyChange(true);
    setDiscovering(true);
    setRows(null);
    setMessage(null);
    setProgress({ done: 0, total: pending.length });
    try {
      const found = await findSeasonDownloadSources(
        meta,
        pending,
        options(ac.signal),
        (done, total) => {
          if (!ac.signal.aborted && controller.current === ac) setProgress({ done, total });
        },
      );
      if (ac.signal.aborted) return;
      setRows(
        found.map(({ episode, candidates }) => ({
          episode,
          candidates,
          selected: candidates.length > 0 ? 0 : null,
        })),
      );
      if (found.length === 0) setMessage(t("No pending episodes need a download."));
      else if (found.every((row) => row.candidates.length === 0)) {
        setMessage(t("No sources were found. Try another addon or search again."));
      }
    } catch {
      if (!ac.signal.aborted) setMessage(t("Could not search episode sources."));
    } finally {
      if (controller.current === ac) controller.current = null;
      if (!ac.signal.aborted && controller.current === null) {
        setDiscovering(false);
        onBusyChange(false);
      }
    }
  };

  const cancel = () => {
    controller.current?.abort();
    controller.current = null;
    setDiscovering(false);
    setDownloading(false);
    onBusyChange(false);
  };

  const changeSelection = (key: string, value: string) => {
    if (downloading) return;
    const selected = value === "skip" ? null : Number(value);
    setRows(
      (current) =>
        current?.map((row) =>
          episodeKey(row.episode) === key ? { ...row, selected, result: undefined } : row,
        ) ?? null,
    );
  };

  const downloadSelected = async () => {
    if (!rows || controller.current || disabled) return;
    const activeRows = rows.filter((row) => row.selected !== null && row.result !== "queued");
    if (activeRows.length === 0) return;
    const ac = new AbortController();
    controller.current = ac;
    onBusyChange(true);
    setDownloading(true);
    setMessage(null);
    setProgress({ done: 0, total: activeRows.length });
    try {
      const results = await downloadReviewedSeasonEpisodes(
        meta,
        rows.map((row) => ({
          episode: row.episode,
          stream: row.selected === null ? null : (row.candidates[row.selected] ?? null),
        })),
        options(ac.signal),
        (done, total) => {
          if (!ac.signal.aborted && controller.current === ac) setProgress({ done, total });
        },
      );
      if (ac.signal.aborted) return;
      const statuses = new Map(
        results.map((result) => [episodeKey(result.episode), result.status]),
      );
      setRows(
        (current) =>
          current?.map((row) => {
            const result = statuses.get(episodeKey(row.episode));
            return result === "queued" || result === "already-queued" || result === "failed"
              ? { ...row, result: result === "already-queued" ? "queued" : result }
              : row;
          }) ?? null,
      );
      const queued = results.filter((result) => result.status === "queued").length;
      const alreadyQueued = results.filter((result) => result.status === "already-queued").length;
      const failed = results.filter((result) => result.status === "failed").length;
      setMessage(
        failed > 0
          ? t(
              "Queued {queued}; {already} were already queued or saved; {failed} failed. Failed episodes remain available to retry.",
              {
                queued,
                already: alreadyQueued,
                failed,
              },
            )
          : t("Queued {queued}; {already} were already queued or saved.", {
              queued,
              already: alreadyQueued,
            }),
      );
    } catch {
      if (!ac.signal.aborted) setMessage(t("Could not queue the selected episodes."));
    } finally {
      if (controller.current === ac) controller.current = null;
      if (!ac.signal.aborted && controller.current === null) {
        setDownloading(false);
        onBusyChange(false);
      }
    }
  };

  const selectedCount =
    rows?.filter((row) => row.selected !== null && row.result !== "queued").length ?? 0;
  const candidateText = (stream: ScoredStream) =>
    [
      safeCandidateTitle(stream),
      safeAddonName(stream),
      streamQuality(stream),
      sizeLabel(stream.size),
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <section className="rounded-3xl border border-edge-soft/70 bg-canvas/80 px-6 py-5">
      <div className="flex flex-col gap-4">
        <div className="flex max-w-xl flex-col gap-2">
          <h2 className="font-display text-2xl leading-tight text-ink">{t("Download episodes")}</h2>
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            {t("Review sources first, or automatically choose and download the best matches.")}
          </p>
          {discovering && (
            <p className="text-[12.5px] text-ink-subtle">
              {t("Checking {done} of {total} episodes", progress)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void find()}
            disabled={
              disabled || discovering || downloading || !autoDownload.ready || pending.length === 0
            }
            className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            {discovering ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {rows ? t("Search again") : t("Find and review")}
          </button>
          <button
            type="button"
            onClick={autoDownload.onStart}
            disabled={
              disabled || discovering || downloading || !autoDownload.ready || pending.length === 0
            }
            className="inline-flex h-10 items-center gap-2 rounded-full bg-elevated px-5 text-[13px] font-semibold text-ink ring-1 ring-edge-soft transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-55"
          >
            {autoDownload.busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArrowDownToLine size={14} />
            )}
            {autoDownload.busy ? t("Finding and downloading") : t("Find and auto-download")}
          </button>
          {(discovering || downloading) && (
            <button
              type="button"
              onClick={cancel}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-elevated px-4 text-[13px] font-medium text-ink-muted hover:text-ink"
            >
              <X size={14} /> {t("Cancel")}
            </button>
          )}
        </div>
        {(autoDownload.status || !autoDownload.ready) && (
          <p role="status" className="text-[12.5px] text-ink-subtle">
            {autoDownload.status || t("Preparing episode sources")}
          </p>
        )}
      </div>

      {message && (
        <p role="status" className="mt-4 text-center text-[13px] text-ink-muted">
          {message}
        </p>
      )}

      {rows && (
        <div className="mt-6 space-y-3">
          <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {rows.map((row) => {
              const key = episodeKey(row.episode);
              const selection = row.selected === null ? "skip" : String(row.selected);
              const dropdownOptions = [
                { value: "skip", label: t("Skip this episode") },
                ...row.candidates.map((candidate, index) => ({
                  value: String(index),
                  label: safeCandidateTitle(candidate),
                })),
              ];
              const chosen = row.selected === null ? null : (row.candidates[row.selected] ?? null);
              const expectedTitle =
                row.episode.name || t("Episode {episode}", { episode: row.episode.episode });
              return (
                <article
                  key={key}
                  className="rounded-2xl bg-elevated/70 px-4 py-3 ring-1 ring-edge-soft"
                >
                  <div className="grid gap-2 md:grid-cols-[minmax(160px,0.7fr)_minmax(0,1.3fr)] md:items-start">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {t("S{season} E{episode}", {
                          season: row.episode.season,
                          episode: row.episode.episode,
                        })}
                      </p>
                      <p
                        className="break-words text-[12.5px] leading-snug text-ink-muted"
                        title={expectedTitle}
                      >
                        {expectedTitle}
                      </p>
                    </div>
                    <div className="min-w-0">
                      {row.candidates.length === 0 ? (
                        <p className="rounded-xl bg-canvas px-3 py-2 text-[12.5px] text-ink-subtle">
                          {t("No matching sources found")}
                        </p>
                      ) : (
                        <>
                          {downloading || row.result === "queued" ? (
                            <p className="break-words rounded-xl bg-canvas px-3 py-2 text-[12px] text-ink">
                              {chosen ? candidateText(chosen) : t("Skip this episode")}
                            </p>
                          ) : (
                            <Dropdown
                              value={selection}
                              options={dropdownOptions}
                              onChange={(value) => changeSelection(key, value)}
                              ariaLabel={t("Source for S{season} E{episode}", {
                                season: row.episode.season,
                                episode: row.episode.episode,
                              })}
                              size="sm"
                              menuWidth={760}
                              renderOption={(option) => {
                                if (option.value === "skip") return option.label;
                                const source = row.candidates[Number(option.value)];
                                if (!source) return option.label;
                                const languages = source.audioLanguages.filter(
                                  (language) =>
                                    language.trim() && language.toLowerCase() !== "unknown",
                                );
                                const quality = streamQuality(source);
                                const size = sizeLabel(source.size);
                                const audioTags = streamAudioTags(source);
                                const details = safeCandidateDetails(source);
                                const episodeRange =
                                  source.episode == null
                                    ? t("Unknown")
                                    : source.episodeEnd != null &&
                                        source.episodeEnd !== source.episode
                                      ? `${source.episode}–${source.episodeEnd}`
                                      : String(source.episode);
                                return (
                                  <span className="flex min-w-0 flex-col gap-1.5 py-1">
                                    <span className="whitespace-normal break-words text-[12.5px] font-semibold leading-snug">
                                      {safeCandidateTitle(source)}
                                    </span>
                                    {details.map((detail) => (
                                      <span
                                        key={detail}
                                        className="whitespace-normal break-words text-[11px] font-normal leading-snug opacity-80"
                                      >
                                        {detail}
                                      </span>
                                    ))}
                                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-normal opacity-80">
                                      <span>{safeAddonName(source)}</span>
                                      <span aria-hidden>·</span>
                                      <span>{quality || t("Quality unknown")}</span>
                                      <span aria-hidden>·</span>
                                      <span>{size ?? t("Size unknown")}</span>
                                    </span>
                                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-normal opacity-80">
                                      <span>
                                        {t("Audio")}:{" "}
                                        {languages.length ? languages.join(", ") : t("Unknown")}
                                      </span>
                                      {audioTags.map((tag) => (
                                        <span
                                          key={tag}
                                          className="rounded bg-ink/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </span>
                                    <span className="text-[11px] font-normal opacity-70">
                                      {source.seasonPack && <>{t("Season pack")} · </>}
                                      {t("Source season")}: {source.season ?? t("Unknown")} ·{" "}
                                      {t("Source episode")}: {episodeRange}
                                    </span>
                                  </span>
                                );
                              }}
                              menuMaxHeight={560}
                            />
                          )}
                          {chosen && (
                            <p
                              className="mt-1 break-words px-1 text-[11.5px] leading-snug text-ink-subtle"
                              title={safeCandidateTitle(chosen)}
                            >
                              {candidateText(chosen)}
                            </p>
                          )}
                        </>
                      )}
                      {row.result === "queued" && (
                        <p className="mt-1 px-1 text-[11.5px] text-emerald-400">{t("Queued")}</p>
                      )}
                      {row.result === "failed" && (
                        <p className="mt-1 px-1 text-[11.5px] text-red-300">
                          {t("Could not queue. Select a source and retry.")}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void downloadSelected()}
              disabled={disabled || downloading || discovering || selectedCount === 0}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              {downloading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowDownToLine size={14} />
              )}
              {downloading
                ? t("Resolving {done} of {total}", progress)
                : t("Download selected ({count})", { count: selectedCount })}
            </button>
            <p className="text-[12px] text-ink-subtle">
              {rows.filter((row) => row.selected !== null).length} / {rows.length} {t("selected")}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
