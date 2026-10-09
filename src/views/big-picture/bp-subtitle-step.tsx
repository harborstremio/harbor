import { useEffect, useRef, useState } from "react";
import { Captions, CaptionsOff, Check, Loader2 } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { Flag } from "@/components/flag";
import { SFX } from "@/lib/sfx";
import { languageName } from "@/lib/subtitles/language";
import { subtitleLoadMetadataOf } from "@/lib/subtitles/provider-label";
import { subtitleClassificationLabels } from "@/lib/subtitles/classification-labels";
import type { SubResult } from "@/lib/subtitles/types";
import type { PlayerSrc } from "@/lib/view";
import { useSubtitleChoices } from "@/views/play-picker/hooks/use-subtitle-choices";
import { pushBpBack } from "./bp-back";
import { useBpT } from "./bp-i18n";
import { currentBpFocus, setBpFocus } from "./use-bp-focus";

type Selection = string | "off" | null;

const CHIP_BASE =
  "flex h-[clamp(46px,5.2vh,64px)] shrink-0 items-center gap-[clamp(6px,0.5vw,10px)] rounded-full px-[clamp(15px,1.3vw,25px)] text-[clamp(13px,1.75vh,20px)] font-bold transition-colors duration-[var(--bp-dur-fast)]";
const CHIP_ON = "bg-[var(--bp-on)] text-ink";
const CHIP_OFF = "border border-[var(--bp-edge)] text-ink-subtle";

export function BpSubtitleStep({
  src,
  onStart,
  onCancel,
}: {
  src: PlayerSrc;
  onStart: (finalSrc: PlayerSrc) => void;
  onCancel: () => void;
}) {
  const t = useBpT();
  const { loading, error, results, groups, bestId } = useSubtitleChoices(src);
  const [selected, setSelected] = useState<Selection>(null);
  const [activeLang, setActiveLang] = useState("all");
  const inited = useRef(false);
  const seedRef = useRef<HTMLButtonElement | null>(null);

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
    const prev = currentBpFocus(document.querySelector<HTMLElement>("[data-bp-root]"));
    if (seedRef.current) setBpFocus(seedRef.current, { silent: true });
    return () => {
      if (prev?.isConnected) setBpFocus(prev, { silent: true });
    };
  }, []);

  useEffect(
    () =>
      pushBpBack(() => {
        onCancel();
        return true;
      }),
    [onCancel],
  );

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
  const total = results?.length ?? 0;
  const context = src.episode
    ? `${src.meta.name} · S${src.episode.imdbSeason ?? src.episode.season}E${src.episode.imdbEpisode ?? src.episode.episode}`
    : src.meta.name;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("Choose subtitles")}
      data-bp-dialog
      className="absolute inset-0 z-[75] flex flex-col bg-[var(--bp-void)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <header className="flex flex-col gap-[clamp(3px,0.4vh,7px)] px-[var(--bp-gutter)] pt-[calc(clamp(26px,3.4vh,52px)_+_var(--bp-safe-y,0px))]">
        <h2 className="flex items-center gap-[clamp(8px,0.8vw,15px)] font-display text-[clamp(20px,2.9vh,38px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
          <Captions size={26} strokeWidth={2} />
          {t("Choose subtitles")}
        </h2>
        <p className="line-clamp-1 text-[clamp(13px,1.75vh,20px)] font-medium text-ink-subtle">
          {context}
          {" · "}
          {loading ? t("Finding subtitles…") : t("{n} tracks", { n: total })}
        </p>
      </header>

      <section data-bp-row className="relative shrink-0">
        <div
          data-bp-scroll-x
          className="flex gap-[clamp(8px,0.75vw,15px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            onClick={() => {
              SFX.click();
              setActiveLang("all");
            }}
            aria-pressed={activeLang === "all"}
            className={`${CHIP_BASE} ${activeLang === "all" ? CHIP_ON : CHIP_OFF}`}
          >
            {t("All languages")} {total}
          </button>
          {groups.map((g) => (
            <button
              key={g.langKey}
              type="button"
              data-bp-focusable
              data-bp-chip
              onClick={() => {
                SFX.click();
                setActiveLang(g.langKey);
              }}
              aria-pressed={activeLang === g.langKey}
              className={`${CHIP_BASE} ${activeLang === g.langKey ? CHIP_ON : CHIP_OFF}`}
            >
              {g.langDisplay} {g.items.length}
            </button>
          ))}
        </div>
      </section>

      <div
        data-bp-scroll-y
        className="mt-[clamp(10px,1.2vh,18px)] flex min-h-0 flex-1 flex-col gap-[clamp(8px,0.9vh,14px)] overflow-y-auto px-[var(--bp-gutter)] pt-[6px] pb-[clamp(20px,2.4vh,36px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div data-bp-row data-bp-scroll-x style={{ containIntrinsicSize: "auto 96px" }}>
          <BpTrackRow
            ref={seedRef}
            autofocus
            label={t("No subtitles")}
            selected={selected === "off"}
            onPick={() => setSelected("off")}
            icon={<CaptionsOff size={22} strokeWidth={2} />}
          />
        </div>
        {loading && (
          <p className="flex items-center gap-[clamp(8px,0.8vw,15px)] px-[clamp(4px,0.4vw,8px)] text-[clamp(13px,1.8vh,20px)] font-medium text-ink-subtle">
            <Loader2
              size={20}
              className="animate-spin motion-reduce:[animation-duration:2.4s]"
              strokeWidth={2.2}
            />
            {t("Finding subtitles…")}
          </p>
        )}
        {!loading && total === 0 && (
          <p className="px-[clamp(4px,0.4vw,8px)] text-[clamp(13px,1.8vh,20px)] font-medium text-ink-subtle">
            {error
              ? t("Couldn't load subtitles. You can start anyway and add one later in the player.")
              : t("No subtitles found. Start anyway, Harbor keeps looking while you watch.")}
          </p>
        )}
        {visible.map((r) => (
          <div
            key={r.id}
            data-bp-row
            data-bp-scroll-x
            style={{ containIntrinsicSize: "auto 96px" }}
          >
            <BpTrackRow
              label={r.title || languageName(r.lang)}
              detail={trackDetail(r, t)}
              best={r.id === bestId}
              bestLabel={t("Best match")}
              selected={r.id === selected}
              onPick={() => setSelected(r.id)}
              icon={<Flag language={languageName(r.lang)} size="md" showLabel={false} />}
            />
          </div>
        ))}
      </div>

      <section data-bp-row className="relative shrink-0">
        <div
          data-bp-scroll-x
          className="flex gap-[clamp(9px,0.9vw,16px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(14px,1.8vh,26px)] pb-[clamp(26px,3.4vh,52px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            onClick={() => {
              SFX.close();
              onCancel();
            }}
            className="h-[clamp(48px,5.6vh,66px)] shrink-0 rounded-[var(--bp-r-xs)] border border-[var(--bp-edge-2)] px-[clamp(18px,1.6vw,32px)] text-[clamp(14px,1.95vh,22px)] font-bold text-ink"
          >
            {t("Back")}
          </button>
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            onClick={() => {
              SFX.click();
              onStart(src);
            }}
            className="h-[clamp(48px,5.6vh,66px)] shrink-0 rounded-[var(--bp-r-xs)] border border-[var(--bp-edge-2)] px-[clamp(18px,1.6vw,32px)] text-[clamp(14px,1.95vh,22px)] font-bold text-ink"
          >
            {t("Skip, let Harbor choose")}
          </button>
          <button
            type="button"
            data-bp-focusable
            data-bp-chip
            onClick={() => {
              SFX.click();
              start();
            }}
            className="flex h-[clamp(48px,5.6vh,66px)] shrink-0 items-center gap-[clamp(7px,0.7vw,13px)] rounded-[var(--bp-r-xs)] bg-[var(--bp-on)] px-[clamp(18px,1.6vw,32px)] text-[clamp(14px,1.95vh,22px)] font-bold text-ink"
          >
            <Play size={20} className="fill-current" strokeWidth={0} />
            {t("Start playback")}
          </button>
        </div>
      </section>
    </div>
  );
}

function trackDetail(r: SubResult, t: (k: string) => string): string {
  const parts: string[] = [r.source];
  if (r.format) parts.push(r.format.toUpperCase());
  parts.push(...subtitleClassificationLabels(r, t, "compact").map(({ label }) => label));
  return parts.filter(Boolean).join(" · ");
}

function BpTrackRow({
  ref,
  autofocus,
  label,
  detail,
  best,
  bestLabel,
  selected,
  onPick,
  icon,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  autofocus?: boolean;
  label: string;
  detail?: string;
  best?: boolean;
  bestLabel?: string;
  selected: boolean;
  onPick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      ref={ref}
      type="button"
      data-bp-focusable
      data-bp-chip
      data-bp-autofocus={autofocus ? "true" : undefined}
      aria-pressed={selected}
      onClick={() => {
        SFX.click();
        onPick();
      }}
      className={`group flex w-full items-center gap-[clamp(13px,1.3vw,24px)] rounded-[var(--bp-r-md)] border px-[clamp(15px,1.4vw,26px)] py-[clamp(12px,1.5vh,20px)] text-start text-ink transition-colors duration-[var(--bp-dur-fast)] ${
        selected
          ? "border-transparent bg-[var(--bp-glass)]"
          : "border-[var(--bp-edge)] bg-[var(--bp-panel)]"
      }`}
    >
      <span className="flex h-[clamp(44px,5vh,60px)] w-[clamp(44px,5vh,60px)] shrink-0 items-center justify-center rounded-full bg-[var(--bp-panel-2)] group-data-[bp-focus=true]:bg-[var(--bp-void)]/25">
        {selected ? <Check size={22} strokeWidth={3} /> : icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[clamp(3px,0.4vh,7px)]">
        <span className="flex items-center gap-[clamp(7px,0.7vw,13px)]">
          <span className="line-clamp-1 text-[clamp(14px,1.95vh,23px)] font-semibold leading-tight">
            {label}
          </span>
          {best && bestLabel && (
            <span className="shrink-0 rounded-full bg-[var(--bp-glass)] px-[clamp(8px,0.7vw,13px)] py-[3px] text-[clamp(10.5px,1.35vh,15px)] font-bold uppercase tracking-[0.12em] group-data-[bp-focus=true]:bg-[var(--bp-void)]/25">
              {bestLabel}
            </span>
          )}
        </span>
        {detail && (
          <span className="line-clamp-1 text-[clamp(12px,1.6vh,18px)] font-medium opacity-65">
            {detail}
          </span>
        )}
      </span>
    </button>
  );
}
