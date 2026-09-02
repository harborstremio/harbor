import { Check } from "lucide-react";
import type { ReactNode } from "react";
import type { HandoffQr } from "@/lib/tv-handoff/handoff-qr";

/**
 * Type scale for the ten-foot setup surfaces.
 *
 * The floors matter more than the vh terms here. A television lays out on a
 * 1080x607 canvas, so every vh term in Big Picture's shared clamps falls to its
 * px floor, and those floors were chosen for a narrow desktop window. Sized off
 * the floor upward instead, so the page reads from a sofa rather than resolving
 * to desktop body copy.
 */
export const TITLE =
  "font-display text-[clamp(34px,4.6vh,46px)] font-semibold leading-tight tracking-[-0.01em] text-ink";
export const BODY = "text-[clamp(16px,2.2vh,21px)] font-medium leading-snug";
const CARD =
  "rounded-[var(--bp-r-lg)] bg-[var(--bp-panel)] p-[clamp(16px,2.2vh,28px)]";

const QR_SIDE = "clamp(190px,30vh,250px)";

/**
 * The phone route, stated as one card.
 *
 * No URL chip. The address used to print here as a truncated monospace string
 * beside the code, which on a television is an instruction to go and find a
 * laptop, set in the least legible type on the screen. The QR carries the same
 * address and a phone camera reads it from the sofa.
 *
 * grid, never flex-wrap: at 1140 the code column has only a few px of slack, and
 * a locale that widens either half used to drop the text under the QR and take
 * the page's height with it.
 */
export function BpConnectQr({
  qr,
  codeDisplay,
  note,
  idleLabel,
  icon,
  light,
  dark,
  qrLabel,
}: {
  qr: HandoffQr | null;
  codeDisplay: string | null;
  note: string;
  idleLabel: string;
  icon: ReactNode;
  light: string;
  dark: string;
  qrLabel: string;
}) {
  const live = qr !== null && codeDisplay !== null;
  return (
    <div
      className={`${CARD} grid shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-[clamp(14px,1.6vw,28px)]`}
    >
      <div
        key={codeDisplay ?? "idle"}
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--bp-r-md)] [animation:bp-code-in_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
        style={{
          width: QR_SIDE,
          height: QR_SIDE,
          background: live ? light : "var(--bp-panel-2)",
        }}
      >
        {live && qr ? (
          <svg
            viewBox={qr.viewBox}
            role="img"
            aria-label={qrLabel}
            className="h-full w-full"
            shapeRendering="crispEdges"
          >
            <rect x="0" y="0" width={qr.extent} height={qr.extent} fill={light} />
            <path d={qr.path} fill={dark} />
          </svg>
        ) : (
          icon
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-[clamp(8px,1.2vh,16px)]">
        {codeDisplay ? (
          <span className="font-display text-[clamp(34px,4.4vh,48px)] font-semibold leading-none tracking-[0.09em] text-ink">
            {codeDisplay}
          </span>
        ) : (
          <span className={`${BODY} text-ink`}>{idleLabel}</span>
        )}
        <p className={`${BODY} max-w-[26ch] text-ink-subtle`}>{note}</p>
      </div>
    </div>
  );
}

export function BpConnectStatus({
  label,
  value,
  on,
}: {
  label: string;
  value: string;
  on: boolean;
}) {
  const side = "clamp(44px,5.2vh,52px)";
  return (
    <div className="flex items-center gap-[clamp(13px,1.2vw,22px)]">
      <span
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: side,
          height: side,
          background: on
            ? "color-mix(in oklab, var(--bp-live) 24%, var(--bp-void))"
            : "var(--bp-panel-2)",
        }}
      >
        {on ? (
          <Check size={22} strokeWidth={3} style={{ color: "var(--bp-live)" }} />
        ) : (
          <span
            className="rounded-full bg-[var(--bp-edge-2)]"
            style={{ width: "clamp(10px,1.3vh,14px)", height: "clamp(10px,1.3vh,14px)" }}
          />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[clamp(22px,2.9vh,28px)] font-semibold leading-tight text-ink">
          {label}
        </span>
        <span className="truncate text-[clamp(16px,2.2vh,20px)] font-medium text-ink-subtle">
          {value}
        </span>
      </span>
    </div>
  );
}
