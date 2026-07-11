import { useT } from "@/lib/i18n";
import { ANIME4K_MODES } from "@/lib/player/anime4k-modes";
import type { Anime4kChoice } from "@/views/player/hooks/use-anime4k";
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useMenuSide } from "../menu-side";
import { Tooltip } from "./tooltip";

const OPTIONS: Array<{ id: Anime4kChoice; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "off", label: "Off" },
  ...ANIME4K_MODES.map((m) => ({ id: m.id as Anime4kChoice, label: m.label })),
];

export function Anime4kMenu({
  mode,
  onMode,
  onOpenChange,
}: {
  mode: Anime4kChoice;
  onMode: (m: Anime4kChoice) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { side, measure } = useMenuSide(wrap, 320);
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const active = mode !== "auto" && mode !== "off";
  const accent = open || active;
  const current = OPTIONS.find((o) => o.id === mode);
  const sub = ANIME4K_MODES.find((m) => m.id === mode)?.sub;
  return (
    <div ref={wrap} className="relative">
      <Tooltip label={t("Anime4K upscaling")}>
        <button
          onClick={() => {
            if (!open) measure();
            setOpen((o) => !o);
          }}
          aria-label={t("Anime4K upscaling")}
          className={`flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 transition-[background-color,color] ${
            accent ? "bg-white/22 text-white hover:bg-white/30" : "text-white/85 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Sparkles size={20} strokeWidth={1.9} />
          {active && current ? (
            <span className="text-[11px] font-bold tracking-wider">{current.label.replace("Mode ", "")}</span>
          ) : null}
        </button>
      </Tooltip>
      {open && (
        <div
          className={`absolute bottom-[calc(100%+10px)] ${side === "start" ? "start-0" : "end-0"} w-[320px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_24px_60px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl`}
        >
          <div className="p-2">
            <div className="px-3 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
              {t("Anime4K")}
            </div>
            <div className="px-3 pb-1.5 pt-0.5 text-[11px] leading-snug text-ink-subtle">
              {sub ? t(sub) : t("Real-time anime upscaling. GPU-intensive.")}
            </div>
            <div className="flex flex-col gap-0.5">
              {OPTIONS.map((o) => {
                const sel = o.id === mode;
                return (
                  <button
                    key={o.id}
                    onClick={() => {
                      onMode(o.id);
                      setOpen(false);
                    }}
                    className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-start text-[13.5px] transition-colors ${
                      sel ? "bg-elevated text-ink ring-1 ring-edge" : "text-ink-muted hover:bg-canvas/55 hover:text-ink"
                    }`}
                  >
                    <span className={sel ? "font-medium" : ""}>{t(o.label)}</span>
                    {o.id === "auto" && (
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
