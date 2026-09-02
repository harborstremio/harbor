import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CROP_PRESETS } from "@/views/player/hooks/use-video-fill";
import { PICTURE_KEYS, PICTURE_TEMPLATES, TweakSlider, useTweaks } from "@/views/settings/mpv-panel/dials";
import { useT } from "@/lib/i18n";
import { useMenuSide } from "../menu-side";
import { Tooltip } from "./tooltip";
import { watchOutsideMouseDown } from "@/lib/player/overlay-dismiss";

export function AspectMenu({
  mode,
  onMode,
  onOpenChange,
  iconUrl,
}: {
  mode: string;
  onMode: (id: string) => void;
  onOpenChange?: (open: boolean) => void;
  iconUrl?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { measure } = useMenuSide(wrap, 360);
  const { tweaks, setTweak, applyPatch, applyPreset } = useTweaks();
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    return watchOutsideMouseDown(close);
  }, [open]);
  const aspectActive = mode !== "fit";
  const pictureActive = PICTURE_KEYS.some((k) => tweaks[k] != null && tweaks[k] !== "");
  const accent = open || aspectActive || pictureActive;
  const current = CROP_PRESETS.find((m) => m.id === mode);
  return (
    <div ref={wrap} className="relative">
      <Tooltip label={t("Picture")}>
        <button
          onClick={() => {
            if (!open) measure();
            setOpen((o) => !o);
          }}
          aria-label={t("Picture")}
          className={`flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 transition-[background-color,color] ${
            accent ? "bg-white/22 text-white hover:bg-white/30" : "text-white/85 hover:bg-white/10 hover:text-white"
          }`}
        >
          {iconUrl ? (
            <img src={iconUrl} alt="" className="h-[22px] w-[22px] shrink-0 select-none object-contain" draggable={false} />
          ) : (
            <SlidersHorizontal size={21} strokeWidth={1.9} />
          )}
          {aspectActive && current ? (
            <span className="text-[11px] font-bold tabular-nums tracking-wider">{current.label}</span>
          ) : null}
        </button>
      </Tooltip>
      {open && (
        <div className="fixed end-14 bottom-[150px] flex max-h-[calc(100vh-174px)] w-[360px] max-w-[calc(100vw-72px)] flex-col overflow-y-auto rounded-md bg-elevated shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] animate-menu-pop">
          <div className="p-3">
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                {t("Picture")}
              </span>
              {pictureActive && (
                <button
                  type="button"
                  onClick={() => applyPatch(Object.fromEntries(PICTURE_KEYS.map((k) => [k, null])))}
                  className="flex items-center gap-1 text-[11.5px] font-semibold text-ink-subtle transition-colors hover:text-ink"
                >
                  <RotateCcw size={11} strokeWidth={2.4} />
                  {t("Reset")}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 px-1">
              {PICTURE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  title={t(tpl.sub)}
                  onClick={() => applyPreset(PICTURE_KEYS, tpl.patch)}
                  className="rounded-full border border-edge-soft bg-canvas/40 px-3 py-1.5 text-[12px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
                >
                  {t(tpl.label)}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-col">
              <TweakSlider compact tweaks={tweaks} setTweak={setTweak} mpvKey="brightness" label={t("Brightness")} min={-50} max={50} step={1} def={0} />
              <TweakSlider compact tweaks={tweaks} setTweak={setTweak} mpvKey="contrast" label={t("Contrast")} min={-50} max={50} step={1} def={0} />
              <TweakSlider compact tweaks={tweaks} setTweak={setTweak} mpvKey="saturation" label={t("Saturation")} min={-50} max={50} step={1} def={0} />
              <TweakSlider compact tweaks={tweaks} setTweak={setTweak} mpvKey="gamma" label={t("Gamma")} min={-50} max={50} step={1} def={0} />
              <TweakSlider compact tweaks={tweaks} setTweak={setTweak} mpvKey="sharpen" label={t("Sharpen")} min={0} max={2} step={0.05} def={0} fmt={(v) => v.toFixed(2)} />
            </div>
          </div>
          <div className="border-t border-edge-soft/60 p-2">
            <div className="px-3 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
              {t("Aspect ratio")}
            </div>
            <div className="flex flex-col gap-0.5">
              {CROP_PRESETS.map((m) => {
                const sel = m.id === mode;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      onMode(m.id);
                      setOpen(false);
                    }}
                    className={`flex h-10 w-full items-center justify-between rounded-lg px-3 text-start text-[14px] transition-colors ${
                      sel ? "bg-elevated text-ink ring-1 ring-edge" : "text-ink-muted hover:bg-canvas/55 hover:text-ink"
                    }`}
                  >
                    <span className={sel ? "font-medium" : ""}>{t(m.label)}</span>
                    {m.id === "fit" && (
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                        {t("default")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
