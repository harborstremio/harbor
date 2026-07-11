import { ProviderLogo } from "@/components/ai-provider-logo";
import { HoverTooltip } from "@/components/hover-tooltip";
import { AI_MODELS, GROQ_MODELS, PROVIDER_NAME, providerForModel } from "@/lib/ai-models";
import { useT } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";

const ALL_MODELS = [...GROQ_MODELS, ...AI_MODELS];

export function AiModeButton({
  active,
  currentModel,
  onToggle,
  onSelectModel,
}: {
  active: boolean;
  currentModel: string;
  onToggle: () => void;
  onSelectModel: (id: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const heldRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const provider = providerForModel(currentModel);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const clearHold = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };
  const onDown = () => {
    heldRef.current = false;
    holdTimer.current = window.setTimeout(() => {
      heldRef.current = true;
      setOpen(true);
    }, 320);
  };
  const onUp = () => {
    clearHold();
    if (!heldRef.current && !open) onToggle();
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <HoverTooltip label={t("Hold for more")} side="top" align="center">
        <button
          type="button"
          onMouseDown={onDown}
          onMouseUp={onUp}
          onMouseLeave={clearHold}
          aria-label={t("AI search")}
          className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
            active
              ? "border-accent/60 bg-accent/15 shadow-[0_0_0_3px_var(--color-accent-soft)]"
              : "border-edge-soft bg-canvas/60 hover:border-edge"
          }`}
        >
          <ProviderLogo provider={provider} size={20} round />
        </button>
      </HoverTooltip>
      {open && (
        <div className="animate-ai-entrance absolute end-0 top-12 z-[210] w-80 overflow-hidden rounded-2xl border border-edge-soft bg-canvas py-1.5 shadow-2xl">
          <div className="px-3.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {t("AI model")}
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {ALL_MODELS.map((m) => {
              const on = m.id === currentModel;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onSelectModel(m.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-2.5 px-3.5 py-2 text-start transition-colors ${
                    on ? "bg-ink/10" : "hover:bg-elevated/60"
                  }`}
                >
                  <ProviderLogo provider={m.provider} size={18} round />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[13px] font-medium text-ink">{m.label}</span>
                    <span className="flex flex-wrap items-center gap-1">
                      {m.recommended && (
                        <span className="shrink-0 rounded-[5px] bg-accent/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-accent">
                          {t("Recommended")}
                        </span>
                      )}
                      {m.free && (
                        <span className="shrink-0 rounded-[5px] bg-accent/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-accent">
                          {m.provider === "groq" ? t("Free tier") : t("Free")}
                        </span>
                      )}
                      <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
                        {PROVIDER_NAME[m.provider]}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
