import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { SFX } from "@/lib/sfx";
import { BpKeyboard } from "./bp-keyboard";
import { useBpT } from "./bp-i18n";
import { currentBpFocus, setBpFocus } from "./use-bp-focus";

// [data-bp-row] carries the page gutter as padding plus a matching negative
// margin, which would push the query row outside the dialog panel.
const QUERY_SCOPE = { paddingInline: 0, marginInline: 0, containIntrinsicSize: "auto 76px" } as const;

export function BpLibrarySearch({
  query,
  onChange,
  onClose,
}: {
  query: string;
  onChange: (next: string) => void;
  onClose: () => void;
}) {
  const t = useBpT();
  const doneRef = useRef<HTMLButtonElement | null>(null);

  // The route level autofocus pass stops after its settle window, so a dialog
  // opened later seeds itself and hands focus back on close.
  useEffect(() => {
    const previous = currentBpFocus(document.querySelector<HTMLElement>("[data-bp-root]"));
    if (doneRef.current) setBpFocus(doneRef.current, { silent: true });
    return () => {
      if (previous?.isConnected) setBpFocus(previous, { silent: true });
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-label={t("Search your library")}
      data-bp-dialog
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_82%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div className="flex w-[min(90vw,900px)] flex-col gap-[clamp(14px,1.9vh,26px)] rounded-[var(--bp-r-lg)] bg-[var(--bp-panel)] p-[clamp(22px,2.6vw,42px)]">
        <div data-bp-row style={QUERY_SCOPE}>
        <div data-bp-scroll-x className="flex items-center gap-[clamp(9px,0.9vw,16px)]">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--bp-r-md)] bg-[var(--bp-panel-2)] px-[clamp(16px,1.4vw,26px)] py-[clamp(10px,1.2vh,18px)]">
            <Search size={19} strokeWidth={2.2} className="shrink-0 text-ink-subtle" />
            <span
              className={`min-w-0 flex-1 truncate text-[clamp(16px,2.4vh,30px)] font-semibold ${
                query ? "text-ink" : "text-ink-subtle"
              }`}
            >
              {query || t("Search title")}
            </span>
          </div>
          <button
            ref={doneRef}
            type="button"
            data-bp-focusable
            data-bp-chip
            onClick={() => {
              SFX.close();
              onClose();
            }}
            className="h-[clamp(48px,5.6vh,66px)] shrink-0 rounded-full bg-[var(--bp-on)] px-[clamp(22px,2vw,38px)] text-[clamp(14px,1.95vh,22px)] font-bold text-ink"
          >
            {t("Done")}
          </button>
        </div>
        </div>

        <BpKeyboard
          onChar={(c) => onChange(query.length >= 60 ? query : query + c)}
          onBackspace={() => onChange(query.slice(0, -1))}
          onClear={() => onChange("")}
        />
      </div>
    </div>
  );
}
