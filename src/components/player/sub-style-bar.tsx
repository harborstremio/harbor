import { useT } from "@/lib/i18n";
import { closeStyleBar, useStyleBarOpen } from "@/lib/player/sub-presets";
import { useSettings } from "@/lib/settings";
import { X } from "lucide-react";
import { useEffect } from "react";

import { AdvancedMenu } from "./sub-style-bar/advanced-menu";
import { BoldToggle, ColorRow, FontMenu, SizeStepper } from "./sub-style-bar/controls";
import { LooksCluster } from "./sub-style-bar/looks-cluster";

const IDLE_MS = 7000;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const GROUP = "flex h-11 items-center overflow-hidden rounded-[12px] bg-raised";

export function SubStyleBar() {
  const t = useT();
  const open = useStyleBarOpen();
  const { settings, update } = useSettings();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeStyleBar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let timer = window.setTimeout(closeStyleBar, IDLE_MS);
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(closeStyleBar, IDLE_MS);
    };
    window.addEventListener("pointermove", bump);
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", bump);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-7 pt-[68px] animate-in fade-in slide-in-from-top-2 duration-200">
      <div
        role="toolbar"
        aria-label={t("Subtitle appearance")}
        className="pointer-events-auto flex max-w-[calc(100vw-56px)] flex-wrap items-center justify-center gap-2 rounded-[16px] border border-edge bg-elevated px-2 py-2 shadow-[0_18px_44px_-22px_rgba(0,0,0,0.85)]"
      >
        <div className={GROUP}>
          <FontMenu
            value={settings.subFontFamily}
            fonts={settings.customFonts}
            onChange={(f) => update({ subFontFamily: f })}
          />
          <span aria-hidden className="h-6 w-px bg-edge-soft" />
          <SizeStepper value={settings.subFontSize} onChange={(n) => update({ subFontSize: clamp(n, 16, 120) })} />
          <span aria-hidden className="h-6 w-px bg-edge-soft" />
          <BoldToggle on={settings.subBold} onToggle={() => update({ subBold: !settings.subBold })} />
        </div>

        <div className={GROUP}>
          <ColorRow value={settings.subFontColor} onChange={(c) => update({ subFontColor: c })} />
        </div>

        <div className={GROUP}>
          <LooksCluster settings={settings} update={update} />
        </div>

        <AdvancedMenu />

        <button
          type="button"
          onClick={closeStyleBar}
          aria-label={t("Done")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
