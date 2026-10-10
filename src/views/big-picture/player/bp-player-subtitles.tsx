import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Captions,
  CaptionsOff,
  Check,
  FolderOpen,
  Languages,
  RotateCw,
  Search as SearchIcon,
  SlidersHorizontal,
  Timer,
  X,
} from "lucide-react";
import { Flag } from "@/components/flag";
import { useAutoSyncHandle } from "@/components/player/autosync/autosync-store";
import { pickBestMatch } from "@/components/player/subtitle-menu/best-match";
import { useSubtitleContext } from "@/components/player/subtitle-menu/subtitle-context-store";
import { useSubtitleSearch } from "@/components/player/subtitle-menu/subtitle-search-store";
import type { SubtitleMenuProps } from "@/components/player/subtitle-menu/types";
import { groupByLang, variantTitle } from "@/components/player/subtitle-menu/utils";
import { hasImportedSubTitle, markImportedSub, useImportedSubs } from "@/lib/player/imported-subs";
import { setSecondarySub } from "@/lib/player/secondary-sub";
import { useSettings } from "@/lib/settings";
import { filterTracksByPreferredLanguage } from "@/lib/subtitles/language";
import { subtitleTrackLanguageLabel } from "@/lib/subtitles/track-label";
import { setBpFocus } from "../bp-focus-core";
import { useBpT } from "../bp-i18n";
import { BpSubtitleFind, type BpSubtitleTarget } from "./bp-subtitle-find";
import {
  Chip,
  HIDE_BAR,
  LABEL,
  MUTED,
  NOTE,
  Row,
  SPIN,
  SubLine,
  offsetLabel,
  tagsOf,
  trackDetail,
} from "./bp-subtitle-parts";
import { BpSubtitleLook, BpSubtitleSync } from "./bp-subtitle-tune";

export type BpPlayerSubtitlesProps = SubtitleMenuProps & { onClose: () => void };

type Lane = "tracks" | "find" | "sync" | "style";

const ALL = "__all__";

// data-bp-dialog, never data-bp-overlay, and the slot that mounts this MUST
// declare shellNav. The dialog attribute narrows the shell's own focus engine to
// this surface, which is what a panel that renders in place wants. Without
// shellNav the shell drops its listener for an open panel, and data-bp-overlay
// would switch the engine off outright: either way nothing drives the D-pad and
// the panel becomes a hard lock with no Back.

export function BpPlayerSubtitles(props: BpPlayerSubtitlesProps) {
  const t = useBpT();
  const { onClose, tracks, selectedId, onSelect, onDelay, onAddSubtitle, delaySec } = props;
  const { settings } = useSettings();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [lane, setLane] = useState<Lane>("tracks");
  const [activeLang, setActiveLang] = useState(ALL);
  const [source, setSource] = useState<"all" | "embedded" | "external">("all");
  const [hideHI, setHideHI] = useState(false);
  const [forcedOnly, setForcedOnly] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const autoSync = useAutoSyncHandle();
  const search = useSubtitleSearch();
  const importedTitles = useImportedSubs();
  const playCtx = useSubtitleContext();

  const preferred =
    settings.preferredSubLangs.length > 0 ? settings.preferredSubLangs : settings.preferredLanguages;
  const langTracks = useMemo(() => {
    const keep = new Set(filterTracksByPreferredLanguage(tracks, preferred));
    for (const track of tracks) {
      if (hasImportedSubTitle(track.title) || importedTitles.has(track.title ?? "")) keep.add(track);
      if (track.id === selectedId || track.secondary) keep.add(track);
    }
    return tracks.filter((track) => keep.has(track));
  }, [tracks, preferred, importedTitles, selectedId]);
  const groups = useMemo(() => groupByLang(langTracks), [langTracks]);
  const secondary = useMemo(() => tracks.find((track) => track.secondary) ?? null, [tracks]);
  const visible = useMemo(() => {
    const pool =
      activeLang === ALL
        ? langTracks
        : (groups.find((g) => g.langKey === activeLang)?.variants ?? []);
    return pool.filter((track) => {
      if (source === "embedded" && track.external) return false;
      if (source === "external" && !track.external) return false;
      if (hideHI && track.hearingImpaired) return false;
      return !(forcedOnly && !track.forced);
    });
  }, [activeLang, langTracks, groups, source, hideHI, forcedOnly]);
  const best = useMemo(() => pickBestMatch(visible, search?.hints ?? null), [visible, search]);
  const better = best && best.track.id !== selectedId ? best : null;
  const pickSecondary = props.onSelectSecondary ?? setSecondarySub;

  const isSeries = props.season != null && props.episode != null;
  const home = useMemo<BpSubtitleTarget>(
    () => ({
      imdbId: props.metaImdbId ?? "",
      type: isSeries ? "series" : "movie",
      title: props.metaTitle ?? "",
      season: props.season ?? undefined,
      episode: props.episode ?? undefined,
    }),
    [props.metaImdbId, props.metaTitle, props.season, props.episode, isSeries],
  );

  const loadLocal = useCallback(async () => {
    setLocalError(null);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({
        multiple: false,
        filters: [{ name: t("Subtitles"), extensions: ["srt", "ass", "ssa", "vtt", "sub"] }],
      });
      if (typeof path !== "string") return;
      const name = path.split(/[\\/]/).pop() || t("Local subtitle");
      if ((await onAddSubtitle(path, undefined, name)) === false) {
        setLocalError(t("Couldn't load that subtitle file. Try another."));
        return;
      }
      markImportedSub(name);
      setActiveLang(ALL);
    } catch {
      setLocalError(t("Couldn't load that subtitle file. Try another."));
    }
  }, [t, onAddSubtitle]);

  // The shell seeds focus from routeKey, which carries the panel id but not the
  // lane, so a lane swap would leave the ring on a tab chip with the list below
  // it never entered.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const root = rootRef.current;
      const seed =
        root?.querySelector<HTMLElement>("[data-bp-lane] [data-bp-autofocus='true']") ??
        root?.querySelector<HTMLElement>("[data-bp-lane] [data-bp-focusable]");
      if (seed) setBpFocus(seed, { silent: true });
    }, 40);
    return () => window.clearTimeout(id);
  }, [lane]);

  const selected = tracks.find((track) => track.id === selectedId) ?? null;
  const syncBusy = autoSync?.status === "analyzing";
  const canSync = selected?.external === true || syncBusy === true || autoSync?.status === "synced";
  const offset = offsetLabel(delaySec, t);
  const context = isSeries
    ? `${props.metaTitle ?? ""} · S${String(props.season).padStart(2, "0")}E${String(props.episode).padStart(2, "0")}`
    : (props.metaTitle ?? "");
  const lanes: Array<[Lane, string, React.ReactNode]> = [
    ["tracks", t("Tracks"), <Captions key="a" size={21} strokeWidth={2.1} />],
    ["find", t("Find more"), <SearchIcon key="b" size={21} strokeWidth={2.2} />],
    ["sync", t("Sync"), <Timer key="c" size={21} strokeWidth={2.1} />],
    ["style", t("Look"), <SlidersHorizontal key="d" size={21} strokeWidth={2.1} />],
  ];

  return (
    <div
      ref={rootRef}
      data-bp-dialog
      role="dialog"
      aria-modal="true"
      aria-label={t("Subtitles")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="absolute inset-0 flex items-center justify-center bg-[var(--bp-void)]/88 [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_backwards] motion-reduce:[animation:none]"
    >
      <div className="flex h-[min(86vh,900px)] w-[min(92vw,1180px)] flex-col overflow-hidden rounded-[var(--bp-r-lg)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] px-[clamp(20px,2.2vw,44px)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)] [animation:bp-enter_var(--bp-dur)_var(--bp-ease)_backwards] motion-reduce:[animation:none]">
        <header className="flex shrink-0 flex-col gap-[clamp(3px,0.4vh,7px)] pt-[clamp(20px,2.6vh,40px)]">
          <h2 className="flex items-center gap-[clamp(8px,0.8vw,15px)] font-display text-[clamp(20px,2.9vh,38px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            <Captions size={28} strokeWidth={2} />
            {t("Subtitles")}
          </h2>
          <p className={`line-clamp-1 ${MUTED}`}>{`${context} · ${selected ? variantTitle(selected) : t("Off")} · ${offset}`}</p>
        </header>

        <Row>
          {lanes.map(([id, label, icon]) => (
            <Chip key={id} label={label} icon={icon} on={lane === id} onPress={() => setLane(id)} />
          ))}
          <span className="flex-1" />
          <Chip label={t("Close")} icon={<X size={20} strokeWidth={2.4} />} onPress={onClose} />
        </Row>

        <div
          data-bp-lane
          data-bp-scroll-y
          className={`flex min-h-0 flex-1 flex-col gap-[clamp(8px,0.9vh,14px)] overflow-y-auto pt-[clamp(6px,1vh,14px)] pb-[clamp(20px,2.4vh,36px)] ${HIDE_BAR}`}
        >
          {lane === "tracks" && (
            <>
              <Row>
                <span className={LABEL}>{t("Languages")}</span>
                <Chip
                  label={`${t("All languages")} ${langTracks.length}`}
                  on={activeLang === ALL}
                  onPress={() => setActiveLang(ALL)}
                />
                {groups.map((g) => (
                  <Chip
                    key={g.langKey}
                    label={`${g.langDisplay} ${g.variants.length}`}
                    on={activeLang === g.langKey}
                    icon={<Flag language={g.langDisplay} size="md" showLabel={false} />}
                    onPress={() => setActiveLang(g.langKey)}
                  />
                ))}
              </Row>
              <Row>
                <span className={LABEL}>{t("Filters")}</span>
                <Chip label={t("All")} on={source === "all"} onPress={() => setSource("all")} />
                <Chip
                  label={t("Embedded")}
                  on={source === "embedded"}
                  onPress={() => setSource("embedded")}
                />
                <Chip
                  label={t("External")}
                  on={source === "external"}
                  onPress={() => setSource("external")}
                />
                <Chip label={t("Hide HI/SDH")} on={hideHI} onPress={() => setHideHI((v) => !v)} />
                <Chip
                  label={t("Forced only")}
                  on={forcedOnly}
                  onPress={() => setForcedOnly((v) => !v)}
                />
                {search && (
                  <Chip
                    label={
                      search.status === "searching"
                        ? t("Searching…")
                        : t("Search every source again")
                    }
                    icon={
                      <RotateCw
                        size={19}
                        strokeWidth={2.2}
                        className={search.status === "searching" ? SPIN : ""}
                      />
                    }
                    onPress={() => search.refresh()}
                  />
                )}
                <Chip
                  label={t("Load file")}
                  icon={<FolderOpen size={19} strokeWidth={2.2} />}
                  onPress={() => void loadLocal()}
                />
              </Row>
              {localError && <p className={NOTE}>{localError}</p>}
              {better && (
                <Row>
                  <span className={LABEL}>{t("Better match")}</span>
                  <Chip
                    label={variantTitle(better.track)}
                    onPress={() => onSelect(better.track.id)}
                  />
                </Row>
              )}
              <SubLine
                title={t("No subtitles")}
                icon={
                  selectedId == null ? (
                    <Check size={22} strokeWidth={3} />
                  ) : (
                    <CaptionsOff size={22} strokeWidth={2} />
                  )
                }
                on={selectedId == null}
                seed={selectedId == null}
                onPress={() => onSelect(null)}
              />
              {visible.map((track) => {
                const imported =
                  hasImportedSubTitle(track.title) || importedTitles.has(track.title ?? "");
                const badges = tagsOf(track, t);
                if (imported) badges.unshift(t("Yours"));
                if (best?.track.id === track.id) badges.unshift(t("Best match"));
                const on = track.id === selectedId;
                return (
                  <SubLine
                    key={track.id}
                    title={variantTitle(track)}
                    detail={trackDetail(track, imported, t)}
                    badges={badges}
                    icon={
                      on ? (
                        <Check size={22} strokeWidth={3} />
                      ) : (
                        <Flag
                          language={subtitleTrackLanguageLabel(track)}
                          size="md"
                          showLabel={false}
                        />
                      )
                    }
                    on={on}
                    seed={on}
                    onPress={() => onSelect(track.id)}
                    side={
                      <Chip
                        label={t("2nd")}
                        icon={<Languages size={19} strokeWidth={2.2} />}
                        on={track.id === secondary?.id}
                        onPress={() =>
                          pickSecondary(track.id === secondary?.id ? null : track.id)
                        }
                      />
                    }
                  />
                );
              })}
              {visible.length === 0 && (
                <p className={NOTE}>
                  {t("No tracks match these filters. Try toggling HI/SDH or Forced.")}
                </p>
              )}
            </>
          )}

          {lane === "find" && (
            <BpSubtitleFind
              home={home}
              metaTitle={props.metaTitle}
              metaReleaseDate={props.metaReleaseDate}
              candidateIds={playCtx?.candidateIds}
              stremioId={playCtx?.stremioId ?? undefined}
              hideHI={hideHI}
              forcedOnly={forcedOnly}
              onToggleHideHI={() => setHideHI((v) => !v)}
              onToggleForcedOnly={() => setForcedOnly((v) => !v)}
              onAddSubtitle={onAddSubtitle}
            />
          )}

          {lane === "sync" && (
            <BpSubtitleSync canSync={canSync} delaySec={delaySec} onDelay={onDelay} />
          )}

          {lane === "style" && <BpSubtitleLook />}
        </div>
      </div>
    </div>
  );
}
