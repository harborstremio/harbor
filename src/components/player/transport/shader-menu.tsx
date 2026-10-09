import { Check, Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ANIME4K_MODES } from "@/lib/player/anime4k-modes";
import { SHADER_CATALOG } from "@/lib/player/shader-catalog";
import type { Anime4kChoice } from "@/views/player/hooks/use-anime4k";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { useMenuSide } from "../menu-side";
import { Tooltip } from "./tooltip";
import { watchOutsideMouseDown } from "@/lib/player/overlay-dismiss";

const A4K_OPTIONS: Array<{ id: Anime4kChoice; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "off", label: "Off" },
  ...ANIME4K_MODES.map((m) => ({ id: m.id as Anime4kChoice, label: m.label })),
];

export function ShaderMenu({
  mode,
  onMode,
  anime4kAvailable,
  onOpenChange,
  iconUrl,
}: {
  mode: Anime4kChoice;
  onMode: (m: Anime4kChoice) => void;
  anime4kAvailable: boolean;
  onOpenChange?: (open: boolean) => void;
  iconUrl?: string;
}) {
  const t = useT();
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { measure } = useMenuSide(wrap, 340);

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

  const shaderMap = settings.playerShaders ?? {};
  const installed = SHADER_CATALOG.filter((e) => shaderMap[e.id]?.dir);

  if (!anime4kAvailable && installed.length === 0) return null;

  const a4kActive = mode !== "auto" && mode !== "off";
  const activeCount = (a4kActive ? 1 : 0) + installed.filter((e) => shaderMap[e.id]?.enabled).length;
  const accent = open || activeCount > 0;

  const toggleShader = (id: string) => {
    const cur = shaderMap[id];
    update({ playerShaders: { ...shaderMap, [id]: { ...cur, enabled: !cur?.enabled } } });
  };

  return (
    <div ref={wrap} className="relative">
      <Tooltip label={t("Shaders")}>
        <button
          onClick={() => {
            if (!open) measure();
            setOpen((o) => !o);
          }}
          aria-label={t("Shaders")}
          className={`flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 transition-[background-color,color] ${
            accent ? "bg-white/22 text-white hover:bg-white/30" : "text-white/85 hover:bg-white/10 hover:text-white"
          }`}
        >
          {iconUrl ? (
            <img src={iconUrl} alt="" className="h-[22px] w-[22px] shrink-0 select-none object-contain" draggable={false} />
          ) : (
            <Layers size={19} strokeWidth={1.9} />
          )}
          {activeCount > 0 ? <span className="text-[11px] font-bold tracking-wider">{activeCount}</span> : null}
        </button>
      </Tooltip>
      {open && (
        <div
          className="fixed end-14 bottom-[150px] max-h-[calc(100vh-174px)] w-[340px] max-w-[calc(100vw-72px)] overflow-y-auto rounded-md bg-elevated shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] animate-menu-pop"
        >
          <div className="p-2">
            {anime4kAvailable && (
              <>
                <div className="px-3 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                  {t("Anime4K")}
                </div>
                <div className="mb-1 flex flex-col gap-0.5">
                  {A4K_OPTIONS.map((o) => {
                    const sel = o.id === mode;
                    return (
                      <button
                        key={o.id}
                        onClick={() => onMode(o.id)}
                        className={`flex h-9 w-full items-center justify-between rounded-lg px-3 text-start text-[13.5px] transition-colors ${
                          sel ? "bg-elevated text-ink ring-1 ring-edge" : "text-ink-muted hover:bg-canvas/55 hover:text-ink"
                        }`}
                      >
                        <span className={sel ? "font-medium" : ""}>{t(o.label)}</span>
                        {sel && <Check size={15} strokeWidth={2.6} className="text-accent" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {installed.length > 0 ? (
              <>
                <div className="px-3 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                  {t("Installed shaders")}
                </div>
                <div className="flex flex-col gap-0.5">
                  {installed.map((e) => {
                    const st = shaderMap[e.id];
                    const on = !!st?.enabled;
                    const variantLabel =
                      e.variants?.find((v) => v.id === st?.variant)?.label ?? e.variants?.[0]?.label;
                    return (
                      <button
                        key={e.id}
                        onClick={() => toggleShader(e.id)}
                        className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-[13.5px] transition-colors ${
                          on ? "bg-elevated text-ink ring-1 ring-edge" : "text-ink-muted hover:bg-canvas/55 hover:text-ink"
                        }`}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className={on ? "font-medium" : ""}>{t(e.name)}</span>
                          {variantLabel && (
                            <span className="truncate text-[10.5px] text-ink-subtle">{t(variantLabel)}</span>
                          )}
                        </span>
                        <span
                          className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                            on ? "justify-end bg-accent" : "justify-start bg-canvas/70"
                          }`}
                        >
                          <span className="h-4 w-4 rounded-full bg-white" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="px-3 py-2 text-[11.5px] leading-snug text-ink-subtle">
                {t("Install more shaders in Settings, Shaders to switch between them here.")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
