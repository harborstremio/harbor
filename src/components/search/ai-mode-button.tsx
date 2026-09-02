import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AI_MODELS, GROQ_MODELS, PROVIDER_NAME, providerForModel } from "@/lib/ai-models";
import { pruneToCatalog, useGroqCatalog, useOpenRouterCatalog } from "@/lib/ai-live-models";
import { ProviderLogo } from "@/components/ai-provider-logo";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";

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
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const heldRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const provider = providerForModel(currentModel);
  const orCatalog = useOpenRouterCatalog();
  const groqCatalog = useGroqCatalog(settings.aiGroqKey);
  const allModels = [
    ...(settings.aiGroqKey.trim() ? pruneToCatalog(GROQ_MODELS, groqCatalog) : []),
    ...pruneToCatalog(AI_MODELS, orCatalog),
  ];

  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const place = () => {
      const el = wrapRef.current;
      if (el) setRect(el.getBoundingClientRect());
    };
    place();
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!wrapRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const clearHold = () => {
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    heldRef.current = false;
    holdTimer.current = window.setTimeout(() => {
      heldRef.current = true;
      setOpen(true);
    }, 320);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    clearHold();
    if (!heldRef.current && !open) onToggle();
  };
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    clearHold();
    setOpen(true);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <HoverTooltip label={t("Hold or right-click for models")} side="top" align="center">
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={clearHold}
          onContextMenu={onContextMenu}
          onKeyDown={onKeyDown}
          aria-haspopup="menu"
          aria-expanded={open}
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
      {open &&
        rect &&
        createPortal(
        <div
          ref={menuRef}
          className="animate-ai-entrance fixed z-[300] w-80 overflow-hidden rounded-2xl border border-edge-soft bg-canvas py-1.5 shadow-2xl"
          style={{ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) }}
        >
          <div className="px-3.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {t("AI model")}
          </div>
          <div className="max-h-[min(320px,70vh)] overflow-y-auto">
            {allModels.map((m) => {
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
        </div>,
          document.body,
        )}
    </div>
  );
}
