import { ProviderLogo } from "@/components/ai-provider-logo";
import { AiModel, PROVIDER_NAME } from "@/lib/ai-models";
import { useT } from "@/lib/i18n";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function AiModelSelect({
  value,
  onChange,
  models,
  defaultModel,
}: {
  value: string;
  onChange: (v: string) => void;
  models: AiModel[];
  defaultModel: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  const current = models.find((m) => m.id === value) ?? models.find((m) => m.id === defaultModel);
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="shrink-0 text-[12px] text-ink-subtle">{t("Model")}</span>
      <div ref={ref} className="relative flex-1">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-start transition-colors ${
            open ? "border-edge bg-elevated" : "border-edge-soft bg-canvas/60 hover:border-edge"
          }`}
        >
          {current ? (
            <>
              <ProviderLogo provider={current.provider} />
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate text-[13px] font-medium text-ink">{current.label}</span>
                <span className="shrink-0 text-[11px] text-ink-subtle">{PROVIDER_NAME[current.provider]}</span>
              </span>
            </>
          ) : (
            <span className="flex-1 truncate font-mono text-[12px] text-ink-muted">{value || t("Choose a model")}</span>
          )}
          <ChevronDown
            size={14}
            className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="absolute inset-x-0 top-[calc(100%+6px)] z-30 flex max-h-[320px] flex-col overflow-y-auto rounded-2xl border border-edge bg-canvas py-1.5 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl">
            {models.map((m) => {
              const sel = m.id === value;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-3.5 py-2 text-start transition-colors ${
                    sel ? "bg-elevated" : "hover:bg-elevated/60"
                  }`}
                >
                  <ProviderLogo provider={m.provider} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className={`truncate text-[13px] text-ink ${sel ? "font-semibold" : ""}`}>{m.label}</span>
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
                  {sel && <Check size={14} className="shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
