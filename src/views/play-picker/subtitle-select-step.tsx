import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Captions, CaptionsOff, Check, Languages, Loader2 } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { Flag } from "@/components/flag";
import { useContextMenu } from "@/lib/context-menu";
import { languageName } from "@/lib/subtitles/language";
import { subtitleLoadMetadataOf } from "@/lib/subtitles/provider-label";
import { saveSubtitleToDisk } from "@/lib/subtitles/save-to-disk";
import type { SubResult } from "@/lib/subtitles/types";
import { useT } from "@/lib/i18n";
import { subtitleClassificationLabels } from "@/lib/subtitles/classification-labels";
import type { PlayEpisode, PlayerSrc } from "@/lib/view";
import { useWindowFullscreen } from "@/lib/use-window-fullscreen";
import { BackdropLayer } from "./backdrop-layer";
import { useSubtitleChoices } from "./hooks/use-subtitle-choices";

type Selection = string | "off" | null;

export function SubtitleSelectStep({
  src,
  absoluteEpisode,
  onStart,
  onCancel,
}: {
  src: PlayerSrc;
  absoluteEpisode?: number | null;
  onStart: (finalSrc: PlayerSrc) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const fs = useWindowFullscreen();
  const { loading, error, results, groups, bestId } = useSubtitleChoices(src);
  const [selected, setSelected] = useState<Selection>(null);
  const [activeLang, setActiveLang] = useState<string>("all");
  const inited = useRef(false);

  useEffect(() => {
    if (loading || inited.current) return;
    inited.current = true;
    if (bestId) {
      setSelected(bestId);
      const g = groups.find((gr) => gr.items.some((it) => it.id === bestId));
      setActiveLang(g?.langKey ?? "all");
    } else {
      setSelected("off");
    }
  }, [loading, bestId, groups]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const start = () => {
    if (selected === "off") {
      onStart({ ...src, subtitlePreselect: { off: true } });
      return;
    }
    const r = results?.find((x) => x.id === selected);
    if (r) {
      onStart({
        ...src,
        subtitlePreselect: {
          off: false,
          url: r.url,
          lang: r.lang,
          title: r.title || languageName(r.lang),
          metadata: subtitleLoadMetadataOf(r),
        },
      });
      return;
    }
    onStart(src);
  };

  const visible =
    activeLang === "all"
      ? (results ?? [])
      : (groups.find((g) => g.langKey === activeLang)?.items ?? []);
  const context = episodeContext(src.episode, src.meta.name, absoluteEpisode);
  const total = results?.length ?? 0;

  return (
    <main className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-canvas">
      <BackdropLayer src={src.episode?.still || src.meta.background || src.meta.poster} />
      <div
        aria-hidden
        data-tauri-drag-region={fs ? "false" : "true"}
        className="absolute inset-x-0 top-0 z-10 h-20"
      />

      <div className="relative mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-6 px-10 pb-10 pt-24">
        <header className="flex items-start gap-4">
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("Back")}
            className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-elevated/70 text-ink-muted ring-1 ring-edge-soft backdrop-blur transition-colors hover:bg-raised hover:text-ink"
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </button>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <Captions size={22} strokeWidth={2} className="shrink-0 text-accent" />
              <h1 className="text-[26px] font-semibold tracking-tight text-ink">
                {t("Choose subtitles")}
              </h1>
            </div>
            {context && <p className="truncate text-[14px] text-ink-muted">{context}</p>}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden rounded-3xl border border-edge-soft bg-elevated/50 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <>
              <aside className="flex w-[190px] shrink-0 flex-col gap-1 overflow-y-auto border-e border-edge-soft bg-canvas/30 p-3">
                <SidebarItem
                  active={activeLang === "all"}
                  onClick={() => setActiveLang("all")}
                  icon={<Languages size={16} strokeWidth={2} className="shrink-0" />}
                  label={t("All languages")}
                  count={total}
                />
                {groups.length > 0 && (
                  <div className="mt-2 mb-1 px-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                    {t("Languages")}
                  </div>
                )}
                {groups.map((g) => (
                  <SidebarItem
                    key={g.langKey}
                    active={activeLang === g.langKey}
                    onClick={() => setActiveLang(g.langKey)}
                    icon={<Flag language={g.langDisplay} size="sm" showLabel={false} />}
                    label={g.langDisplay}
                    count={g.items.length}
                    dot={g.items.some((it) => it.id === selected)}
                  />
                ))}
              </aside>

              <section className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <OffRow
                    selected={selected === "off"}
                    onPick={() => setSelected("off")}
                    label={t("No subtitles")}
                  />

                  {error && total === 0 && (
                    <p className="px-4 py-6 text-[14px] text-ink-muted">
                      {t(
                        "Couldn't load subtitles. You can start anyway and add one later in the player.",
                      )}
                    </p>
                  )}
                  {!error && total === 0 && (
                    <p className="px-4 py-6 text-[14px] text-ink-muted">
                      {t("No subtitles found. Start anyway, Harbor keeps looking while you watch.")}
                    </p>
                  )}

                  {visible.length > 0 && (
                    <div className="mt-1 flex flex-col gap-1.5">
                      {visible.map((r) => (
                        <TrackRow
                          key={r.id}
                          result={r}
                          selected={r.id === selected}
                          isBest={r.id === bestId}
                          onPick={() => setSelected(r.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onStart(src)}
            className="h-12 rounded-full px-6 text-[15px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            {t("Skip, let Harbor choose")}
          </button>
          <button
            type="button"
            onClick={start}
            disabled={loading}
            className="flex h-12 items-center gap-2.5 rounded-full bg-accent px-8 text-[16px] font-bold text-canvas shadow-[0_16px_40px_-12px_var(--color-accent)] transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50"
          >
            <Play size={20} strokeWidth={2.6} fill="currentColor" />
            {t("Start playback")}
          </button>
        </div>
      </div>
    </main>
  );
}

function episodeContext(
  episode: PlayEpisode | undefined,
  name: string,
  absoluteEpisode?: number | null,
): string {
  if (!episode) return name;
  const label =
    absoluteEpisode != null
      ? `E${absoluteEpisode}`
      : `S${episode.imdbSeason ?? episode.season} · E${episode.imdbEpisode ?? episode.episode}`;
  return episode.name ? `${name} · ${label} · ${episode.name}` : `${name} · ${label}`;
}

function SidebarItem({
  active,
  onClick,
  icon,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  dot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 text-start text-[13.5px] transition-colors ${
        active
          ? "bg-elevated text-ink ring-1 ring-edge"
          : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
      }`}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {dot && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
      <span className="shrink-0 text-[11.5px] tabular-nums text-ink-subtle">{count}</span>
    </button>
  );
}

function OffRow({
  selected,
  onPick,
  label,
}: {
  selected: boolean;
  onPick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onPick}
      className={`flex min-h-[52px] w-full items-center gap-3.5 rounded-2xl px-4 text-start transition-colors ${
        selected ? "bg-accent/12 ring-1 ring-accent/50" : "hover:bg-canvas/50"
      }`}
    >
      <SelectDot selected={selected} />
      <CaptionsOff size={19} strokeWidth={2} className="shrink-0 text-ink-subtle" />
      <span className="text-[15px] font-medium text-ink">{label}</span>
    </button>
  );
}

function TrackRow({
  result,
  selected,
  isBest,
  onPick,
}: {
  result: SubResult;
  selected: boolean;
  isBest: boolean;
  onPick: () => void;
}) {
  const t = useT();
  const { open } = useContextMenu();
  const title = result.title || languageName(result.lang);
  const classificationLabels = subtitleClassificationLabels(result, t, "compact");
  return (
    <button
      onClick={onPick}
      onContextMenu={(e) =>
        open(e, {
          kind: "subtitle",
          label: title,
          download: result.url
            ? () =>
                saveSubtitleToDisk(result.url, {
                  title,
                  lang: result.lang,
                  format: result.format,
                  downloadAuth: result.downloadAuth,
                  label: t("Subtitle"),
                })
            : undefined,
        })
      }
      className={`flex min-h-[56px] w-full items-center gap-3.5 rounded-2xl px-4 py-2.5 text-start transition-colors ${
        selected ? "bg-accent/12 ring-1 ring-accent/50" : "hover:bg-canvas/50"
      }`}
    >
      <SelectDot selected={selected} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14.5px] text-ink">{title}</span>
          {isBest && (
            <span className="shrink-0 rounded-full bg-accent/18 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
              {t("Best match")}
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-[12px] text-ink-subtle">
          <span className="font-semibold capitalize text-ink-muted">{result.source}</span>
          {result.format && (
            <>
              <span aria-hidden>·</span>
              <span className="uppercase">{result.format}</span>
            </>
          )}
          {classificationLabels.map(({ kind, label }) => (
            <span
              key={kind}
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                kind === "hearingImpaired" || kind === "machineTranslated"
                  ? "bg-amber-400/15 text-amber-200"
                  : "bg-sky-400/15 text-sky-200"
              }`}
            >
              {label}
            </span>
          ))}
        </span>
      </div>
      <Flag language={languageName(result.lang)} size="md" showLabel={false} />
    </button>
  );
}

function SelectDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${
        selected ? "bg-accent text-canvas" : "bg-raised ring-1 ring-edge-soft"
      }`}
    >
      {selected && <Check size={14} strokeWidth={3} />}
    </span>
  );
}

function LoadingSkeleton() {
  const t = useT();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1">
        <div className="flex w-[190px] shrink-0 flex-col gap-1.5 border-e border-edge-soft bg-canvas/30 p-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-11 animate-pulse rounded-xl bg-elevated/60"
              style={{ opacity: 1 - i * 0.15 }}
            />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-2xl bg-elevated/50"
              style={{ opacity: 1 - i * 0.12 }}
            />
          ))}
        </div>
      </div>
      <p className="flex items-center gap-2.5 border-t border-edge-soft px-5 py-3.5 text-[13.5px] text-ink-muted">
        <Loader2 size={15} className="animate-spin text-ink-subtle" />
        {t("Finding subtitles…")}
      </p>
    </div>
  );
}
