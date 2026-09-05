import { Check, ChevronDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { advanceFocus } from "@/lib/keyboard-navigation";
import { getDirection, isBackKey } from "@/lib/keyboard-navigation/geometry";
import { useT } from "@/lib/i18n";
import { AiModel, PROVIDER_NAME } from "@/lib/ai-models";
import { ProviderLogo } from "@/components/ai-provider-logo";
import { AnchoredMenu } from "@/components/anchored-menu";

const TAG =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] bg-accent-soft px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-accent";

const PROVIDER_TAG =
  "shrink-0 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-ink-subtle";

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
  const ref = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const current =
    models.find((m) => m.id === value) ??
    (value ? undefined : models.find((m) => m.id === defaultModel));

  const enterMenu = useCallback((el: HTMLDivElement | null) => {
    listRef.current = el;
    if (!el) return;
    const target =
      el.querySelector<HTMLElement>('[data-selected="true"]') ??
      el.querySelector<HTMLElement>('[role="option"]');
    if (target) advanceFocus(target);
  }, []);

  const close = (restore: boolean) => {
    setOpen(false);
    const trigger = ref.current;
    if (restore && trigger) advanceFocus(trigger);
  };

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isBackKey(e.nativeEvent)) {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    const dir = getDirection(e.nativeEvent);
    if (dir !== "up" && dir !== "down") return;
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    if (!items.length) return;
    e.preventDefault();
    const from = items.indexOf(e.target as HTMLElement);
    const next = items[from < 0 ? 0 : from + (dir === "down" ? 1 : -1)];
    if (!next) return;
    advanceFocus(next, dir);
  };

  return (
    <div className="flex items-center gap-2.5">
      <span className="harbor-settings-label shrink-0">{t("Model")}</span>
      <div className="relative min-w-0 flex-1">
        <button
          ref={ref}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-11 w-full items-center gap-2.5 rounded-[8px] border px-3 text-start transition-colors ${
            open ? "border-edge bg-elevated" : "border-edge-soft bg-canvas hover:border-edge"
          }`}
        >
          {current ? (
            <>
              <ProviderLogo provider={current.family ?? current.provider} />
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate text-[15.5px] font-medium text-ink">{current.label}</span>
                <span className={PROVIDER_TAG}>
                  {PROVIDER_NAME[current.family ?? current.provider]}
                </span>
              </span>
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate font-mono text-[15.5px] text-ink-muted">
              {value || t("Choose a model")}
            </span>
          )}
          <ChevronDown
            size={18}
            className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <AnchoredMenu
          anchorRef={ref}
          open={open}
          onClose={() => close(!!listRef.current?.contains(document.activeElement))}
        >
          <div
            ref={enterMenu}
            role="listbox"
            onKeyDown={onMenuKeyDown}
            className="flex max-h-[320px] flex-col overflow-y-auto rounded-md bg-elevated py-1.5 harbor-float"
          >
            {models.map((m) => {
              const sel = m.id === value;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  data-selected={sel}
                  onClick={() => {
                    onChange(m.id);
                    close(true);
                  }}
                  className={`flex min-h-11 items-center gap-2.5 px-3.5 py-2.5 text-start transition-colors ${
                    sel ? "bg-raised" : "hover:bg-raised"
                  }`}
                >
                  <ProviderLogo provider={m.family ?? m.provider} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span
                      className={`truncate text-[15.5px] text-ink ${sel ? "font-semibold" : ""}`}
                    >
                      {m.label}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {m.recommended && <span className={TAG}>{t("Recommended")}</span>}
                      {m.free && (
                        <span className={TAG}>
                          {m.provider === "groq" ? t("Free tier") : t("Free")}
                        </span>
                      )}
                      <span className={PROVIDER_TAG}>
                        {PROVIDER_NAME[m.family ?? m.provider]}
                      </span>
                    </span>
                  </span>
                  {sel && <Check size={18} className="shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
        </AnchoredMenu>
      </div>
    </div>
  );
}
