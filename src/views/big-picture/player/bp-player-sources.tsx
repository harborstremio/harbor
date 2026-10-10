import { useCallback, useEffect, type CSSProperties } from "react";
import { Check, Languages, RotateCcw } from "lucide-react";
import { Flag } from "@/components/flag";
import type { Meta } from "@/lib/cinemeta";
import type { TrackInfo } from "@/lib/player/bridge";
import { SFX } from "@/lib/sfx";
import type { ScoredStream } from "@/lib/streams/types";
import { languageName } from "@/lib/subtitles/language";
import type { PlayEpisode } from "@/lib/view";
import { pushBpBack } from "../bp-back";
import { useBpT } from "../bp-i18n";
import { BpStreams } from "../bp-streams";

// Both surfaces here render IN PLACE inside BpPlayerShell's panel area and are
// declared with shellNav, so the shell's own focus engine drives them.
//
// This file had a portal, a re-emitted token sheet and its own window keydown
// listener, and all three came from the first one. A portal puts the surface
// outside the shell root where bpFocusScope can never reach it, which forces
// data-bp-overlay, which switches the shell's engine off, which forces a
// private listener: the second listener on arrows the focus contract forbids.
// Render in place and none of it is needed.

const CARD = "flex h-[min(86vh,900px)] w-[min(92vw,1180px)] flex-col overflow-hidden rounded-[var(--bp-r-lg)] border border-[var(--bp-edge)] bg-[var(--bp-void)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.95)] [animation:bp-rise_var(--bp-dur)_var(--bp-ease)_backwards] motion-reduce:[animation:none]";
const SCRIM = "absolute inset-0 flex items-center justify-center bg-[var(--bp-void)]/50 p-[clamp(14px,2.4vh,40px)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_backwards] motion-reduce:[animation:none]";
const BTN = "flex h-[clamp(48px,5.6vh,66px)] shrink-0 items-center gap-[clamp(7px,0.7vw,13px)] rounded-[var(--bp-r-xs)] border border-[var(--bp-edge-2)] px-[clamp(16px,1.5vw,30px)] text-[clamp(14px,1.95vh,22px)] font-bold tabular-nums text-ink disabled:opacity-40";
const SCROLL = "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const LANE = `flex items-center gap-[clamp(9px,0.9vw,16px)] overflow-x-auto px-[var(--bp-gutter)] py-[clamp(14px,1.8vh,26px)] ${SCROLL}`;
const MUTED = "line-clamp-1 text-[clamp(13px,1.75vh,20px)] font-medium text-ink-subtle";

// Every [data-bp-row] pads by --bp-gutter and cancels it with a negative
// margin, so the card retargets the token once instead of padding each row.
const CARD_GUTTER = { "--bp-gutter": "clamp(20px,2.2vw,44px)" } as CSSProperties;

const LANE_ROW: CSSProperties = { contentVisibility: "visible" };

const DELAY_STEPS = [-0.5, -0.1, 0.1, 0.5];

export type BpPlayerSourcesProps = {
  meta: Meta;
  episode?: PlayEpisode;
  currentUrl: string;
  currentInfoHash?: string | null;
  currentFileIdx?: number | null;
  onPick: (stream: ScoredStream) => void | Promise<void>;
  onClose: () => void;
};

export function BpPlayerSources(props: BpPlayerSourcesProps) {
  // BpStreams already carries data-bp-dialog on its own panel, which is what
  // narrows bpFocusScope to it, and registers its own Back handler.
  return <BpStreams {...props} mode="switch" />;
}

export type BpPlayerAudioProps = {
  tracks: TrackInfo[];
  selectedId: string | null;
  delaySec: number;
  engine: "html5" | "mpv";
  title?: string;
  onSelect: (id: string) => void;
  onDelay: (sec: number) => void;
  onClose: () => void;
};

export function BpPlayerAudio(props: BpPlayerAudioProps) {
  const t = useBpT();
  const { tracks, selectedId, engine, title, onSelect, onClose } = props;
  const claim = useCallback(() => {
    onClose();
    return true;
  }, [onClose]);
  useEffect(() => pushBpBack(claim), [claim]);

  return (
    <div
      data-bp-dialog
      role="dialog"
      aria-modal="true"
      aria-label={t("Audio")}
      className={SCRIM}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={CARD_GUTTER} className={CARD}>
        <header className="flex shrink-0 flex-col gap-[clamp(3px,0.4vh,7px)] px-[var(--bp-gutter)] pt-[clamp(24px,3vh,44px)]">
          <h2 className="flex items-center gap-[clamp(8px,0.8vw,15px)] font-display text-[clamp(20px,2.9vh,38px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            <Languages size={26} strokeWidth={2} />
            {t("Audio")}
          </h2>
          <p className={MUTED}>{`${title ? `${title} · ` : ""}${t("{n} tracks", { n: tracks.length })}`}</p>
        </header>

        <div
          data-bp-scroll-y
          className={`flex min-h-0 flex-1 flex-col gap-[clamp(8px,0.9vh,14px)] overflow-y-auto px-[var(--bp-gutter)] pb-[clamp(14px,1.8vh,26px)] pt-[clamp(14px,1.8vh,26px)] ${SCROLL}`}
        >
          {tracks.length === 0 && (
            <p className="text-[clamp(13.5px,1.85vh,21px)] font-medium leading-relaxed text-ink-subtle">
              {engine === "mpv"
                ? t("This file has one audio track.")
                : t("Track switching isn't supported on the current engine. The file's default audio is playing.")}
            </p>
          )}
          {tracks.map((track, i) => (
            <div key={track.id} data-bp-row data-bp-scroll-x style={{ containIntrinsicSize: "auto 96px" }}>
              <BpAudioRow
                track={track}
                selected={track.id === selectedId}
                autofocus={track.id === selectedId || (selectedId == null && i === 0)}
                onPick={() => {
                  onSelect(track.id);
                  onClose();
                }}
              />
            </div>
          ))}
        </div>

        <BpAudioLane {...props} />
      </div>
    </div>
  );
}

// One bottom lane, so Left and Right walk Back through to Reset without ever
// leaving the row. html5 cannot offset audio, so those cells are marked
// disabled and the engine steps straight over them to whatever is still live.
function BpAudioLane({ delaySec, engine, onDelay, onClose }: BpPlayerAudioProps) {
  const t = useBpT();
  const locked = engine === "html5";
  const dim = locked ? "opacity-45" : "";
  const round = (v: number) => Math.round(v * 100) / 100;
  const cells = DELAY_STEPS.map((step) => ({ key: String(step), body: `${step > 0 ? "+" : ""}${step}s`, to: round(delaySec + step) }));
  if (delaySec !== 0) cells.push({ key: "reset", body: t("Reset"), to: 0 });

  return (
    <div data-bp-row style={LANE_ROW} className="shrink-0 border-t border-[var(--bp-edge)]">
      <div data-bp-scroll-x className={LANE}>
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          onClick={() => {
            SFX.close();
            onClose();
          }}
          className={BTN}
        >
          {t("Back")}
        </button>
        <span className={`ms-[clamp(6px,0.6vw,12px)] shrink-0 text-[clamp(12.5px,1.7vh,19px)] font-bold uppercase tracking-[0.12em] text-ink-subtle ${dim}`}>
          {t("Sync Offset")}
        </span>
        <span className={`shrink-0 font-mono text-[clamp(15px,2.1vh,24px)] font-bold tabular-nums ${dim} ${delaySec !== 0 ? "text-ink" : "text-ink-subtle"}`}>
          {`${delaySec > 0 ? "+" : ""}${delaySec.toFixed(2)}s`}
        </span>
        {cells.map((cell) => (
          <button
            key={cell.key}
            type="button"
            data-bp-focusable
            data-bp-chip
            data-bp-disabled={locked ? "true" : undefined}
            disabled={locked}
            onClick={() => {
              SFX.click();
              onDelay(cell.to);
            }}
            className={BTN}
          >
            {cell.key === "reset" && <RotateCcw size={18} strokeWidth={2.4} />}
            {cell.body}
          </button>
        ))}
      </div>
    </div>
  );
}

function trackLines(track: TrackInfo, t: (key: string) => string): [string, string] {
  const lang = track.lang ? languageName(track.lang) : "";
  const named = track.title?.trim() && track.title !== track.lang ? track.title.trim() : "";
  const detail = [lang, track.codec, track.channels, track.default ? t("Default") : ""];
  return [named || lang || track.label || t("Track"), detail.filter(Boolean).join(" · ")];
}

type RowProps = { track: TrackInfo; selected: boolean; autofocus: boolean; onPick: () => void };

function BpAudioRow({ track, selected, autofocus, onPick }: RowProps) {
  const t = useBpT();
  const [label, detail] = trackLines(track, t);

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-chip
      data-bp-autofocus={autofocus ? "true" : undefined}
      aria-pressed={selected}
      onClick={() => {
        SFX.click();
        onPick();
      }}
      className={`group flex w-full items-center gap-[clamp(13px,1.3vw,24px)] rounded-[var(--bp-r-md)] border px-[clamp(15px,1.4vw,26px)] py-[clamp(12px,1.5vh,20px)] text-start text-ink transition-colors duration-[var(--bp-dur-fast)] ${selected ? "border-transparent bg-[var(--bp-glass)]" : "border-[var(--bp-edge)] bg-[var(--bp-panel)]"}`}
    >
      <span className="flex h-[clamp(44px,5vh,60px)] w-[clamp(44px,5vh,60px)] shrink-0 items-center justify-center rounded-full bg-[var(--bp-panel-2)] group-data-[bp-focus=true]:bg-[var(--bp-void)]/25">
        {selected ? (
          <Check size={22} strokeWidth={3} />
        ) : track.lang ? (
          <Flag language={languageName(track.lang)} size="md" showLabel={false} />
        ) : (
          <Languages size={20} strokeWidth={2.2} />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[clamp(3px,0.4vh,7px)]">
        <span className="line-clamp-1 text-[clamp(14px,1.95vh,23px)] font-semibold leading-tight">{label}</span>
        {detail && <span className="line-clamp-1 text-[clamp(12px,1.6vh,18px)] font-medium opacity-65">{detail}</span>}
      </span>
    </button>
  );
}
