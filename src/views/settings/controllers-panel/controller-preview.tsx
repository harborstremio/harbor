import { useEffect, useState } from "react";
import { Gamepad2, Square } from "lucide-react";
import { useT } from "@/lib/i18n";
import { setGamepadCapture, useGamepadCapture } from "@/lib/gamepad/capture";
import { useLiveButtons } from "@/lib/gamepad/live";
import { useGamepads } from "@/lib/gamepad/store";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { Segmented } from "../shared";
import { S_LABEL, SButton, SSection } from "../ui";
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
      if (!isBackKey(e)) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      setGamepadCapture(false);
    };
    window.addEventListener("keydown", stop, true);
    return () => window.removeEventListener("keydown", stop, true);
  }, [testing]);

  useEffect(() => {
    if (!active && testing) setGamepadCapture(false);
  }, [active, testing]);

  const exitHeld = !!buttons.guide || !!buttons.east || !!buttons.start;
  useEffect(() => {
    if (!testing || !exitHeld) return;
    const id = window.setTimeout(() => setGamepadCapture(false), HOLD_TO_EXIT_MS);
    return () => window.clearTimeout(id);
  }, [testing, exitHeld]);

  const hint = !enabled
    ? t("Turn on controller support to light up your inputs here.")
    : !connected
      ? t("Connect a controller: every press and stick move shows up here, live.")
      : testing
        ? `${t("Test mode: your controller only moves this diagram. Press Esc to stop.")} ${t(
            "On the pad, hold {button} to stop.",
            { button: layout === "ps" ? "Circle" : "B" },
          )}`
        : t("Press buttons and move the sticks. This mirrors your controller in real time.");

  return (
    <SSection
      label={t("Live preview")}
      action={
        active ? (
          <span
            className={`${S_LABEL} flex items-center gap-2`}
            style={{ color: "var(--color-accent)" }}
          >
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />
            {testing ? t("Testing") : t("Live")}
          </span>
        ) : undefined
      }
    >
      <div
        className={`flex flex-col gap-4 rounded-[10px] border bg-elevated p-5 transition-colors duration-200 ${
          testing ? "border-accent" : "border-edge-soft"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <Segmented
            value={layout}
            options={[
              { value: "xbox" as Layout, label: "Xbox" },
              { value: "ps" as Layout, label: "PlayStation" },
            ]}
            onChange={(v) => setPinned(v)}
          />
          <SButton
            variant={testing ? "primary" : "secondary"}
            disabled={!active}
            onClick={() => setGamepadCapture(!testing)}
          >
            {testing ? <Square size={15} strokeWidth={2.6} /> : <Gamepad2 size={17} strokeWidth={2} />}
            {testing ? t("Stop test") : t("Test controller")}
          </SButton>
        </div>
        <div
          className={`mx-auto w-full max-w-[460px] transition-opacity duration-300 ${
            active ? "" : "opacity-55"
          }`}
        >
          <ControllerSvg layout={layout} />
        </div>
        <p
          className={`mx-auto max-w-[66ch] text-center text-[15.5px] font-normal leading-[22px] ${
            testing ? "text-accent" : "text-ink-muted"
          }`}
        >
          {hint}
        </p>
      </div>
    </SSection>
  );
}
