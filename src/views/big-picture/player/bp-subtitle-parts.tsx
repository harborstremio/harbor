import type { TrackInfo } from "@/lib/player/bridge";
import { variantTitle } from "@/components/player/subtitle-menu/utils";
import { providerLabel, releaseOf } from "@/lib/subtitles/provider-label";
import { subtitleTrackLanguageLabel } from "@/lib/subtitles/track-label";
import type { SubResult } from "@/lib/subtitles/types";
import { SFX } from "@/lib/sfx";
import { subtitleClassificationLabels } from "@/lib/subtitles/classification-labels";

export type BpSubT = (key: string, vars?: Record<string, string | number>) => string;

// The token sheet gives every [data-bp-root] [data-bp-row] the page gutter, a
// matching negative margin, and a 340px intrinsic placeholder while unfocused.
// All three are right for a poster rail and wrong for a list row in a panel.
export const ROW_FIX = {
  paddingInline: 0,
  marginInline: 0,
  paddingBlock: "clamp(10px, 1.4vh, 18px)",
  containIntrinsicSize: "auto 92px",
} as const;

export const HIDE_BAR =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const RAIL = `flex shrink-0 items-center gap-[clamp(8px,0.75vw,15px)] overflow-x-auto py-[clamp(10px,1.3vh,20px)] ${HIDE_BAR}`;
const CHIP =
  "flex h-[clamp(44px,5vh,60px)] shrink-0 items-center gap-[clamp(6px,0.5vw,10px)] rounded-full px-[clamp(15px,1.3vw,25px)] text-[clamp(14px,1.95vh,23px)] font-bold transition-colors duration-[var(--bp-dur-fast)]";
const CHIP_ON = "bg-[var(--bp-on)] text-ink";
const CHIP_OFF = "border border-[var(--bp-edge-2)] text-ink";
export const LABEL =
  "shrink-0 pe-[clamp(6px,0.6vw,12px)] text-[clamp(11.5px,1.5vh,17px)] font-bold uppercase tracking-[0.16em] text-ink-subtle";
export const MUTED = "text-[clamp(13px,1.8vh,20px)] font-medium text-ink-subtle";
// line-clamp sets display:-webkit-box, so it can never share a class with the
// flex status lines. Two consts, never one.
export const NOTE = `flex items-center gap-[clamp(8px,0.8vw,15px)] ${MUTED}`;
const LINE =
  "group flex min-w-0 flex-1 items-center gap-[clamp(13px,1.3vw,24px)] rounded-[var(--bp-r-md)] border px-[clamp(15px,1.4vw,26px)] py-[clamp(12px,1.5vh,20px)] text-start text-ink transition-colors duration-[var(--bp-dur-fast)]";
const LINE_ON = "border-transparent bg-[var(--bp-glass)]";
const LINE_OFF = "border-[var(--bp-edge)] bg-[var(--bp-panel)]";
const DISC =
  "flex h-[clamp(44px,5vh,60px)] w-[clamp(44px,5vh,60px)] shrink-0 items-center justify-center rounded-full bg-[var(--bp-panel-2)] group-data-[bp-focus=true]:bg-[var(--bp-void)]/25";
const BADGE =
  "shrink-0 rounded-full bg-[var(--bp-glass)] px-[clamp(8px,0.7vw,13px)] py-[3px] text-[clamp(10.5px,1.35vh,15px)] font-bold uppercase tracking-[0.12em] group-data-[bp-focus=true]:bg-[var(--bp-void)]/25";
export const SPIN = "animate-spin motion-reduce:animate-none";

export function Row({ children }: { children: React.ReactNode }) {
  return (
    <div data-bp-row data-bp-scroll-x style={ROW_FIX} className={RAIL}>
      {children}
    </div>
  );
}

export function Chip({
  label,
  ariaLabel,
  icon,
  on,
  seed,
  onPress,
}: {
  label: React.ReactNode;
  /** Required whenever the visible label is a glyph such as - or +. */
  ariaLabel?: string;
  icon?: React.ReactNode;
  on?: boolean;
  seed?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-chip
      aria-pressed={on}
      aria-label={ariaLabel}
      data-bp-autofocus={seed ? "true" : undefined}
      onClick={() => {
        SFX.click();
        onPress();
      }}
      className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
    >
      {icon}
      {label}
    </button>
  );
}

// A bare "-" or "+" is the entire accessible name of a 44px control otherwise,
// so the stepper spells out what it steps.
export function Stepper({
  label,
  value,
  t,
  onStep,
  onReset,
}: {
  label: string;
  value: string;
  t: BpSubT;
  onStep: (delta: number) => void;
  onReset: () => void;
}) {
  return (
    <>
      <span className={LABEL}>{label}</span>
      <Chip
        label="-"
        ariaLabel={t("Decrease {name}", { name: label })}
        onPress={() => onStep(-1)}
      />
      <Chip label={value} ariaLabel={t("Reset {name}", { name: label })} onPress={onReset} />
      <Chip label="+" ariaLabel={t("Increase {name}", { name: label })} onPress={() => onStep(1)} />
    </>
  );
}

export function SubLine(p: {
  title: string;
  detail?: string;
  badges?: string[];
  icon: React.ReactNode;
  on?: boolean;
  seed?: boolean;
  side?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <div
      data-bp-row
      data-bp-scroll-x
      style={ROW_FIX}
      className="flex items-center gap-[clamp(8px,0.7vw,14px)]"
    >
      <button
        type="button"
        data-bp-focusable
        data-bp-chip
        aria-pressed={p.on}
        data-bp-autofocus={p.seed ? "true" : undefined}
        onClick={() => {
          SFX.click();
          p.onPress();
        }}
        className={`${LINE} ${p.on ? LINE_ON : LINE_OFF}`}
      >
        <span className={DISC}>{p.icon}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-[clamp(3px,0.4vh,7px)]">
          <span className="flex items-center gap-[clamp(7px,0.7vw,13px)]">
            <span className="line-clamp-1 text-[clamp(14px,1.95vh,23px)] font-semibold leading-tight">
              {p.title}
            </span>
            {(p.badges ?? []).map((b) => (
              <span key={b} className={BADGE}>
                {b}
              </span>
            ))}
          </span>
          {p.detail && (
            <span className="line-clamp-1 text-[clamp(12px,1.6vh,18px)] font-medium opacity-65">
              {p.detail}
            </span>
          )}
        </span>
      </button>
      {p.side}
    </div>
  );
}

export function trackDetail(track: TrackInfo, imported: boolean, t: BpSubT): string {
  const parts = [
    imported ? t("Imported") : track.external ? t("External") : t("Embedded"),
    subtitleTrackLanguageLabel(track),
  ];
  if (track.codec) parts.push(track.codec.toUpperCase());
  if (track.release && track.release !== variantTitle(track)) parts.push(track.release);
  return parts.join(" · ");
}

export function resultDetail(r: SubResult, t: BpSubT): string {
  const parts = [providerLabel(r)];
  if (r.format) parts.push(r.format.toUpperCase());
  if (typeof r.downloads === "number" && r.downloads > 0) {
    parts.push(t("{count} dl", { count: r.downloads }));
  }
  const rel = releaseOf(r);
  if (rel) parts.push(rel);
  return parts.join(" · ");
}

export function tagsOf(
  x: {
    hearingImpaired?: boolean;
    forced?: boolean;
    foreignOnly?: boolean;
    machineTranslated?: boolean;
  },
  t: BpSubT,
): string[] {
  return subtitleClassificationLabels(x, t, "compact").map(({ label }) => label);
}

export function offsetLabel(delaySec: number, t: BpSubT): string {
  if (delaySec === 0) return t("In sync");
  return t("{sign}{n}s", { sign: delaySec > 0 ? "+" : "", n: delaySec.toFixed(1) });
}
