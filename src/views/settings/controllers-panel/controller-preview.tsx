import { useEffect, useState } from "react";
import { Gamepad2, Square } from "lucide-react";
import { useT } from "@/lib/i18n";
import { setGamepadCapture, useGamepadCapture } from "@/lib/gamepad/capture";
import { useLiveButtons } from "@/lib/gamepad/live";
import { useGamepads } from "@/lib/gamepad/store";
import { ControllerSvg, detectLayout, type Layout } from "./controller-svg";

const HOLD_TO_EXIT_MS = 900;

export function ControllerPreview({ enabled }: { enabled: boolean }) {
  const t = useT();
  const [pinned, setPinned] = useState<Layout | null>(null);
  const buttons = useLiveButtons();
  const gamepads = useGamepads();
  const testing = useGamepadCapture();
  const connected = gamepads.length > 0;
  const layout = pinned ?? detectLayout(gamepads.map((p) => p.name)) ?? "xbox";
  const active = enabled && connected;

  useEffect(() => () => setGamepadCapture(false), []);

  useEffect(() => {
    if (!testing) return;
    const stop = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.isTrusted) setGamepadCapture(false);
    };
    window.addEventListener("keydown", stop, true);
    return () => window.removeEventListener("keydown", stop, true);
  }, [testing]);

  useEffect(() => {
    if (!active && testing) setGamepadCapture(false);
  }, [active, testing]);

  const guideHeld = !!buttons.guide;
  useEffect(() => {
    if (!testing || !guideHeld) return;
    const id = window.setTimeout(() => setGamepadCapture(false), HOLD_TO_EXIT_MS);
    return () => window.clearTimeout(id);
  }, [testing, guideHeld]);

  const hint = !enabled
    ? t("Turn on controller support to light up your inputs here.")
    : !connected
      ? t("Connect a controller: every press and stick move shows up here, live.")
      : testing
        ? t("Test mode: your controller only moves this diagram. Press Esc to stop.")
        : t("Press buttons and move the sticks. This mirrors your controller in real time.");

  return (
    <div
      className={`rounded-md border bg-canvas/40 p-5 transition-colors duration-200 ${
        testing ? "border-accent/45" : "border-edge-soft"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {t("Live preview")}
          {active && (
            <span className="flex items-center gap-1.5 text-[10.5px] font-medium normal-case tracking-normal text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              {testing ? t("Testing") : t("Live")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!active}
            onClick={() => setGamepadCapture(!testing)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 ${
              testing
                ? "bg-accent text-canvas hover:brightness-95"
                : "bg-white/[0.06] text-ink hover:bg-white/[0.10]"
            }`}
          >
            {testing ? <Square size={12} strokeWidth={2.6} /> : <Gamepad2 size={14} strokeWidth={2} />}
            {testing ? t("Stop test") : t("Test controller")}
          </button>
          <div className="flex rounded-full bg-elevated p-0.5 ring-1 ring-edge-soft">
            {(["xbox", "ps"] as Layout[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPinned(m)}
                className={`rounded-full px-3.5 py-1 text-[12px] font-semibold transition-colors ${
                  layout === m ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
                }`}
              >
                {m === "xbox" ? t("Xbox") : t("PlayStation")}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        className={`mx-auto max-w-[460px] transition-opacity duration-300 ${active ? "" : "opacity-55"}`}
      >
        <ControllerSvg layout={layout} />
      </div>
      <p
        className={`mt-1 text-center text-[12.5px] ${testing ? "text-accent" : "text-ink-subtle"}`}
      >
        {hint}
      </p>
    </div>
  );
}
