import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { MatchPlayer } from "@/lib/sports/espn";
import type { PitchSide, SubState } from "./pitch-formation";

export type PitchPlayerProps = {
  player: MatchPlayer;
  side: PitchSide;
  left: number;
  top: number;
  order: number;
  goals: number;
  sub: SubState | null;
  compact: boolean;
  flip: boolean;
  align: "start" | "center" | "end";
};

function surname(name: string): string {
  const parts = (name || "").trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
}

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10.5px] uppercase tracking-[0.1em] text-ink-subtle">{label}</span>
      <span className="text-[11.5px] font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

function useDismiss(
  open: boolean,
  host: RefObject<HTMLDivElement | null>,
  setOpen: (next: boolean) => void,
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!host.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, host, setOpen]);
}

export function PitchPlayer({
  player,
  side,
  left,
  top,
  order,
  goals,
  sub,
  compact,
  flip,
  align,
}: PitchPlayerProps) {
  const t = useT();
  const cardId = useId();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  useDismiss(open, hostRef, setOpen);
  const showImage = Boolean(player.image) && !broken;
  const yellow = player.yellowCards || 0;
  const red = player.redCards || 0;

  const disc = compact ? "h-[30px] w-[30px] text-[11px]" : "h-[38px] w-[38px] text-[13px]";
  const skin =
    side === "home"
      ? "bg-ink text-canvas ring-canvas/40"
      : "bg-canvas text-ink ring-edge";

  const tipSide = flip ? "top-full mt-2" : "bottom-full mb-2";
  const tipAlign =
    align === "start"
      ? "left-0"
      : align === "end"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";
  const tipShow = open
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100";

  return (
    <div
      ref={hostRef}
      className="pitch-token"
      data-open={open || undefined}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      style={{ left: `${left}%`, top: `${top}%`, "--pitch-order": order } as CSSProperties}
    >
      <div
        className={`group relative flex ${compact ? "w-[62px]" : "w-[74px]"} flex-col items-center gap-1`}
      >
        <button
          type="button"
          aria-label={player.name}
          aria-expanded={open}
          aria-controls={cardId}
          onClick={() => setOpen((v) => !v)}
          className={`relative flex ${disc} items-center justify-center overflow-visible rounded-full font-bold tabular-nums ring-2 transition-transform duration-150 group-hover:scale-[1.06] ${skin}`}
        >
          {showImage ? (
            <img
              src={player.image}
              alt=""
              draggable={false}
              onError={() => setBroken(true)}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span dir="ltr">{player.jersey || "-"}</span>
          )}

          {goals > 0 && (
            <span className="pitch-mark-pop absolute -top-1 -right-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-ink px-[3px] text-[9px] font-bold tabular-nums text-canvas ring-2 ring-canvas">
              {goals}
            </span>
          )}

          {(yellow > 0 || red > 0) && (
            <span className="absolute -bottom-1 -right-1 flex items-center gap-px">
              {yellow > 0 && <span className="pitch-card h-[13px] w-[9px] bg-yellow-400 ring-1 ring-canvas" />}
              {red > 0 && <span className="pitch-card h-[13px] w-[9px] bg-danger ring-1 ring-canvas" />}
            </span>
          )}

          {sub && (
            <span className="absolute -bottom-1 -left-1 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-canvas ring-1 ring-edge">
              {sub === "in" ? (
                <ArrowUp size={9} strokeWidth={3.2} className="text-success" />
              ) : (
                <ArrowDown size={9} strokeWidth={3.2} className="text-danger" />
              )}
            </span>
          )}
        </button>

        <span className="max-w-full truncate rounded-sm bg-canvas/70 px-1 py-px text-center text-[10px] font-semibold leading-[1.35] text-ink">
          {surname(player.name)}
        </span>

        <div
          id={cardId}
          className={`pointer-events-none absolute z-30 w-[172px] rounded-lg bg-elevated p-2.5 shadow-[0_10px_28px_-8px_rgba(0,0,0,0.55)] ring-1 ring-edge-soft transition-opacity duration-150 ${tipShow} ${tipSide} ${tipAlign}`}
        >
          <div className="truncate text-[12.5px] font-semibold text-ink">{player.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-subtle">
            {player.jersey ? (
              <span dir="ltr" className="tabular-nums">{`#${player.jersey}`}</span>
            ) : (
              <span>{t("No number")}</span>
            )}
            {player.position && <span className="uppercase">{player.position}</span>}
          </div>
          <div className="mt-2 flex flex-col gap-1 border-t border-edge-soft pt-2">
            <TipRow label={t("Role")} value={player.starter ? t("Starter") : t("Bench")} />
            <TipRow label={t("Goals")} value={String(goals)} />
            {yellow > 0 && <TipRow label={t("Yellow")} value={String(yellow)} />}
            {red > 0 && <TipRow label={t("Red")} value={String(red)} />}
            {sub && (
              <TipRow label={t("Change")} value={sub === "in" ? t("Came on") : t("Came off")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
