import { useEffect, useRef, useState } from "react";
import { useBpT } from "./bp-i18n";

type Kind = "dualsense" | "xbox" | "generic";

// Read off gamepad.id, which carries the vendor and product for a web pad and the
// device name for a native gilrs one. Xbox is tested first because a wireless Xbox
// pad also reads as a "wireless controller".
function classify(name: string): Kind {
  const n = name.toLowerCase();
  if (/xbox|xinput|045e|microsoft/.test(n)) return "xbox";
  if (/dualsense|dualshock|playstation|sony|054c|0ce6|09cc|05c4|ps5|ps4/.test(n)) return "dualsense";
  return "generic";
}

// The shared silhouette. Both pads are a batwing body with two grips; only the
// button geometry and the one accent differ, so the body is drawn once.
const BODY =
  "M64 15 C 41 15 35 17 29 23 C 21 31 9 52 8 66 C 6 79 16 84 27 80 C 37 77 45 67 55 65 C 61 64 68 64 74 65 C 84 67 92 77 102 80 C 113 84 123 79 121 66 C 120 52 108 31 100 23 C 94 17 88 15 64 15 Z";

function BpControllerArt({ kind }: { kind: Kind }) {
  const stick = (cx: number, cy: number) => (
    <circle cx={cx} cy={cy} r="8" fill="var(--bp-void)" stroke="var(--bp-edge-2)" strokeWidth="2" />
  );
  const dot = (cx: number, cy: number, fill: string) => <circle cx={cx} cy={cy} r="3.4" fill={fill} />;

  return (
    <svg
      viewBox="0 0 128 92"
      role="img"
      aria-hidden
      className="h-[clamp(52px,6vh,82px)] w-auto shrink-0"
    >
      <path d={BODY} fill="var(--bp-panel-2)" stroke="var(--bp-edge-2)" strokeWidth="2.5" />

      {kind === "xbox" ? (
        <>
          {stick(43, 40)}
          {stick(78, 60)}
          {/* D-pad lower left */}
          <rect x="36" y="55" width="16" height="6" rx="2" fill="var(--bp-void)" />
          <rect x="41" y="50" width="6" height="16" rx="2" fill="var(--bp-void)" />
          {/* ABXY upper right */}
          {dot(92, 33, "var(--bp-void)")}
          {dot(101, 42, "var(--bp-void)")}
          {dot(83, 42, "var(--bp-void)")}
          {dot(92, 51, "var(--bp-void)")}
          {/* Guide, the one saturated mark */}
          <circle cx="64" cy="34" r="6" fill="var(--bp-live)" />
        </>
      ) : kind === "dualsense" ? (
        <>
          {/* Touchpad with the light-bar accent */}
          <rect x="49" y="21" width="30" height="19" rx="4" fill="var(--bp-panel)" stroke="var(--bp-touch)" strokeWidth="2" />
          {stick(51, 63)}
          {stick(77, 63)}
          {/* D-pad left */}
          <rect x="26" y="43" width="15" height="6" rx="2" fill="var(--bp-void)" />
          <rect x="30.5" y="38.5" width="6" height="15" rx="2" fill="var(--bp-void)" />
          {/* Face buttons right */}
          {dot(99, 38, "var(--bp-void)")}
          {dot(108, 46, "var(--bp-void)")}
          {dot(90, 46, "var(--bp-void)")}
          {dot(99, 54, "var(--bp-void)")}
        </>
      ) : (
        <>
          {stick(51, 60)}
          {stick(77, 60)}
          <rect x="26" y="42" width="15" height="6" rx="2" fill="var(--bp-void)" />
          <rect x="30.5" y="37.5" width="6" height="15" rx="2" fill="var(--bp-void)" />
          {dot(99, 37, "var(--bp-void)")}
          {dot(108, 45, "var(--bp-void)")}
          {dot(90, 45, "var(--bp-void)")}
          {dot(99, 53, "var(--bp-void)")}
        </>
      )}
    </svg>
  );
}

function label(kind: Kind, t: (s: string) => string): string {
  if (kind === "xbox") return t("Xbox controller connected");
  if (kind === "dualsense") return t("DualSense connected");
  return t("Controller connected");
}

// A pad connecting is a moment, not a state, so this slides a card up from the
// floor, holds it, and drops it. It listens to the browser's own connect event
// rather than the app's gamepad store, so it fires even when controller-as-input
// is switched off in settings, and reads DualSense and Xbox alike off gamepad.id.
export function BpControllerToast() {
  const t = useBpT();
  const seqRef = useRef(0);
  const [pad, setPad] = useState<{ kind: Kind; key: number } | null>(null);
  const [shown, setShown] = useState(false);

  // Chromium withholds gamepadconnected until the pad sends its first input, a
  // privacy gate no path here can skip, so a freshly plugged pad announces on its
  // first press rather than the instant it is seated.
  useEffect(() => {
    const onConnect = (e: GamepadEvent) => {
      seqRef.current += 1;
      setPad({ kind: classify(e.gamepad.id), key: seqRef.current });
    };
    window.addEventListener("gamepadconnected", onConnect);
    return () => window.removeEventListener("gamepadconnected", onConnect);
  }, []);

  // In, hold, out, unmount, restarted whenever a newer pad supersedes this one.
  // Under reduced motion the token sheet flattens the transition to a cut, so the
  // card still appears and the timers still retire it, without the travel.
  useEffect(() => {
    if (!pad) return;
    setShown(false);
    const raise = window.setTimeout(() => setShown(true), 30);
    const drop = window.setTimeout(() => setShown(false), 3000);
    const end = window.setTimeout(() => setPad(null), 3360);
    return () => {
      window.clearTimeout(raise);
      window.clearTimeout(drop);
      window.clearTimeout(end);
    };
  }, [pad?.key]);

  if (!pad) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[85] flex justify-center pb-[clamp(72px,9vh,120px)]"
    >
      <div
        className={`flex items-center gap-[clamp(14px,1.4vw,22px)] rounded-[var(--bp-r-lg)] border border-[var(--bp-edge-2)] bg-[color-mix(in_oklab,var(--bp-panel)_92%,var(--bp-void))] px-[clamp(20px,1.8vw,32px)] py-[clamp(14px,1.5vh,22px)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)] transition-[transform,opacity] duration-[var(--bp-dur)] ease-[var(--bp-ease)] motion-reduce:transition-none ${
          shown ? "translate-y-0 opacity-100" : "translate-y-[130%] opacity-0"
        }`}
      >
        <BpControllerArt kind={pad.kind} />
        <div className="flex flex-col gap-[2px] pe-[clamp(4px,0.5vw,10px)]">
          <span className="text-[clamp(15px,1.9vh,24px)] font-semibold text-ink">
            {label(pad.kind, t)}
          </span>
          <span className="text-[clamp(11.5px,1.4vh,17px)] font-medium text-ink-subtle">
            {t("Ready to play")}
          </span>
        </div>
      </div>
    </div>
  );
}
