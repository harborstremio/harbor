import { Smartphone } from "lucide-react";
import { QR_DARK, QR_LIGHT, type HandoffQr } from "@/lib/tv-handoff/handoff-qr";
import type { TvHandoffPhase } from "@/lib/tv-handoff/use-tv-handoff";
import { useBpT } from "../bp-i18n";

const SIDE = "clamp(130px,19.5vh,240px)";

/**
 * The QR is not focusable and never the only way through. Every phase keeps the
 * frame's own primary, "Type it on this TV instead", one press away.
 */
export function BpHandoffPanel({
  phase,
  qr,
  codeDisplay,
  url,
}: {
  phase: TvHandoffPhase;
  qr: HandoffQr | null;
  codeDisplay: string | null;
  url: string | null;
}) {
  const t = useBpT();
  const live = qr !== null && codeDisplay !== null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-[clamp(14px,1.8vw,34px)]">
      <div
        key={codeDisplay ?? "idle"}
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] [animation:bp-code-in_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
        style={{ width: SIDE, height: SIDE, background: live ? QR_LIGHT : "var(--bp-panel)" }}
      >
        {live && qr ? (
          <svg
            viewBox={qr.viewBox}
            role="img"
            aria-label={t("Setup QR code")}
            className="h-full w-full"
            shapeRendering="crispEdges"
          >
            <rect x="0" y="0" width={qr.extent} height={qr.extent} fill={QR_LIGHT} />
            <path d={qr.path} fill={QR_DARK} />
          </svg>
        ) : (
          <Smartphone size={38} strokeWidth={1.8} className="text-ink-subtle" />
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-[clamp(7px,0.9vh,14px)]">
        {codeDisplay ? (
          <span className="font-display text-[clamp(24px,3.7vh,50px)] font-semibold leading-none tracking-[0.1em] text-ink">
            {codeDisplay}
          </span>
        ) : (
          <span className="text-[clamp(11px,1.5vh,17px)] font-semibold text-ink-subtle">
            {waitingLabel(t, phase)}
          </span>
        )}
        {url && (
          <code className="max-w-[min(34ch,30vw)] truncate rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)] px-[clamp(10px,1vw,18px)] py-[clamp(6px,0.8vh,12px)] text-[clamp(10px,1.3vh,15px)] font-semibold text-ink">
            {url}
          </code>
        )}
      </div>
    </div>
  );
}

function waitingLabel(t: (k: string) => string, phase: TvHandoffPhase): string {
  if (phase === "starting") return t("Getting a code ready…");
  if (phase === "noAddress") return t("No network address");
  if (phase === "servingOff") return t("Phone setup is off");
  if (phase === "serveFailed") return t("Could not start serving");
  return t("Phone setup unavailable");
}

export function handoffNote(
  t: (k: string, v?: Record<string, string | number>) => string,
  phase: TvHandoffPhase,
): string {
  switch (phase) {
    case "noAddress":
      return t(
        "Harbor cannot find this TV's network address, so the phone hand-off is unavailable here.",
      );
    case "servingOff":
      return t("This opens Harbor to devices on your Wi-Fi. You can turn it off again in Settings.");
    case "serveFailed":
      return t("Harbor could not open its web server. Try again, or set this up on the TV.");
    case "stalled":
      return t(
        "Nothing has connected yet. Your phone may be on a guest network, or this TV may be on a different network from your phone.",
      );
    case "claimed":
      return t("Your phone is connected. Keep going there.");
    case "complete":
      return t("All set. Everything below came over from your phone.");
    case "waiting":
      return t("Your phone needs to be on the same Wi-Fi as this TV.");
    default:
      return t("Setting up the hand-off…");
  }
}
