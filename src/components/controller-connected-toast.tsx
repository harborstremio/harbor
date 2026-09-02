import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGamepads, type GamepadInfo } from "@/lib/gamepad/store";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { ControllerSvg, detectLayout } from "@/views/settings/controllers-panel/controller-svg";

const SHOW_MS = 4200;

function trimName(name: string): string {
  return name.replace(/\s*\((?:STANDARD GAMEPAD\s*)?Vendor:.*$/i, "").trim() || name;
}

export function ControllerConnectedToast() {
  const t = useT();
  const { settings } = useSettings();
  const pads = useGamepads();
  const [pad, setPad] = useState<GamepadInfo | null>(null);
  const [shown, setShown] = useState(false);
  const seen = useRef<Set<number> | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const ids = new Set(pads.map((p) => p.id));
    if (seen.current === null) {
      seen.current = ids;
      return;
    }
    const fresh = pads.find((p) => !seen.current?.has(p.id));
    seen.current = ids;
    if (!fresh) return;
    setPad(fresh);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShown(false), SHOW_MS);
  }, [pads]);

  useEffect(() => {
    if (!pad) return;
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [pad]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!pad || !settings.controllerSupportEnabled) return null;
  const layout = detectLayout([pad.name]) ?? "xbox";

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-8 z-[9998] flex justify-center px-6"
      onTransitionEnd={() => {
        if (!shown) setPad(null);
      }}
    >
      <div
        className={`flex items-center gap-4 rounded-lg bg-elevated px-5 py-3.5 ring-1 ring-edge shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}
      >
        <span className="w-[78px] shrink-0">
          <ControllerSvg layout={layout} compact />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[13.5px] font-semibold text-ink">{t("Controller connected")}</span>
          <span className="max-w-[260px] truncate text-[12px] text-ink-subtle">
            {trimName(pad.name)}
          </span>
        </span>
      </div>
    </div>,
    document.body,
  );
}
