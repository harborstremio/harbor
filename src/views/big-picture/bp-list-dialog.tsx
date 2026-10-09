import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { SFX } from "@/lib/sfx";
import {
  toggleInList,
  useCustomLists,
  useListsContaining,
  type ListItemInput,
} from "@/lib/custom-lists";
import { pushBpBack } from "./bp-back";
import { useBpT } from "./bp-i18n";
import { currentBpFocus, setBpFocus } from "./use-bp-focus";

export function BpListDialog({ item, onClose }: { item: ListItemInput; onClose: () => void }) {
  const t = useBpT();
  const lists = useCustomLists();
  const containing = useListsContaining(item.id);
  const seedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const prev = currentBpFocus(document.querySelector<HTMLElement>("[data-bp-root]"));
    if (seedRef.current) setBpFocus(seedRef.current, { silent: true });
    return () => {
      if (prev?.isConnected) setBpFocus(prev, { silent: true });
    };
  }, []);

  useEffect(
    () =>
      pushBpBack(() => {
        onClose();
        return true;
      }),
    [onClose],
  );

  return (
    <div
      role="dialog"
      aria-label={t("Add to list")}
      data-bp-dialog
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_78%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div className="flex max-h-[76vh] w-[min(88vw,760px)] flex-col gap-[clamp(16px,2.2vh,30px)] rounded-[var(--bp-r-lg)] bg-[var(--bp-panel)] p-[clamp(26px,3vw,46px)]">
        <h2 className="font-display text-[clamp(20px,2.9vh,35px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
          {t("Add to list")}
        </h2>

        {lists.length === 0 ? (
          <p className="text-[clamp(13px,1.8vh,20px)] leading-relaxed text-ink-subtle">
            {t("No lists yet")}
          </p>
        ) : (
          <div
            data-bp-scroll-y
            className="flex flex-col gap-[clamp(7px,0.8vh,13px)] overflow-y-auto pt-[6px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {lists.map((l, i) => {
              const on = containing.has(l.id);
              return (
                <button
                  key={l.id}
                  ref={i === 0 ? seedRef : undefined}
                  type="button"
                  data-bp-focusable
                  data-bp-chip
                  aria-pressed={on}
                  onClick={() => {
                    SFX.click();
                    toggleInList(l.id, item);
                  }}
                  className={`flex h-[clamp(56px,6.2vh,78px)] shrink-0 items-center justify-between gap-4 rounded-[var(--bp-r-sm)] px-[clamp(16px,1.4vw,28px)] text-start text-[clamp(14px,1.95vh,23px)] font-bold transition-colors duration-[var(--bp-dur-fast)] ${
                    on
                      ? "bg-[var(--bp-on)] text-ink"
                      : "border border-[var(--bp-edge-2)] text-ink"
                  }`}
                >
                  <span className="line-clamp-1">{l.name}</span>
                  <span className="shrink-0 text-[clamp(12px,1.6vh,19px)] font-semibold opacity-70">
                    {on ? <Check size={22} strokeWidth={2.6} /> : l.items.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <button
          ref={lists.length === 0 ? seedRef : undefined}
          type="button"
          data-bp-focusable
          data-bp-chip
          onClick={() => {
            SFX.close();
            onClose();
          }}
          className="h-[clamp(48px,5.6vh,66px)] shrink-0 rounded-[var(--bp-r-xs)] border border-[var(--bp-edge-2)] text-[clamp(14px,1.95vh,22px)] font-bold text-ink"
        >
          {t("Close")}
        </button>
      </div>
    </div>
  );
}
