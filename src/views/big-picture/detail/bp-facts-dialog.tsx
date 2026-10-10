import { useEffect, useRef } from "react";
import type { TmdbDetail } from "@/lib/providers/tmdb/tmdb-details";
import { SFX } from "@/lib/sfx";
import { pushBpBack } from "../bp-back";
import { bpFactRows } from "../bp-facts";
import { useBpT } from "../bp-i18n";
import { currentBpFocus, setBpFocus } from "../use-bp-focus";

// Every line is a focusable, for the reason bp-award-detail-dialog.tsx:14-18
// records: centerScroll only drives a [data-bp-scroll-y] in response to focus
// landing inside it, so a list whose only focusable is the Close button under it
// can never be scrolled with a remote. The lines do nothing on Enter. They exist
// so Down can walk the list and carry the view with it.
function BpFactLine({ label, value }: { label: string; value: string }) {
  return (
    <span
      role="listitem"
      tabIndex={-1}
      data-bp-focusable
      data-bp-restore-key={`bp-fact:${label}`}
      className="flex min-h-[44px] items-baseline gap-[clamp(12px,1.4vw,28px)] rounded-[var(--bp-r-xs)] px-[clamp(8px,0.7vw,14px)] py-[clamp(6px,0.7vh,11px)] outline-none transition-colors duration-[var(--bp-dur-fast)] data-[bp-focus=true]:bg-[var(--bp-glass)] data-[bp-focus=true]:ring-1 data-[bp-focus=true]:ring-[var(--bp-edge-2)] motion-reduce:transition-none"
    >
      <span className="w-[clamp(140px,15vw,260px)] shrink-0 text-[clamp(11px,1.45vh,17px)] font-bold uppercase tracking-[0.15em] text-ink-subtle">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-[clamp(14px,2vh,24px)] font-semibold leading-snug text-ink">
        {value}
      </span>
    </span>
  );
}

export function BpFactsDialog({
  detail,
  title,
  onClose,
}: {
  detail: TmdbDetail;
  title: string;
  onClose: () => void;
}) {
  const t = useBpT();
  const listRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const rows = bpFactRows(detail, t);

  useEffect(() => {
    const prev = currentBpFocus(document.querySelector<HTMLElement>("[data-bp-root]"));
    const first = listRef.current?.querySelector<HTMLElement>("[data-bp-focusable]");
    const seed = first ?? closeRef.current;
    if (seed) setBpFocus(seed, { silent: true });
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
      aria-label={t("Details")}
      data-bp-dialog
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_78%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div className="flex max-h-[80vh] w-[min(88vw,980px)] flex-col gap-[clamp(14px,2vh,28px)] rounded-[var(--bp-r-lg)] border border-[var(--bp-edge-2)] bg-[var(--bp-panel)] p-[clamp(24px,2.8vw,44px)]">
        <div className="flex min-w-0 flex-col gap-[clamp(2px,0.4vh,6px)]">
          <p className="text-[clamp(10.5px,1.35vh,15px)] font-bold uppercase tracking-[0.18em] text-ink-subtle">
            {t("Details")}
          </p>
          <h2 className="line-clamp-1 font-display text-[clamp(20px,2.9vh,35px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            {title}
          </h2>
        </div>

        <div
          ref={listRef}
          role="list"
          data-bp-scroll-y
          className="flex flex-col gap-[clamp(2px,0.3vh,5px)] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {rows.map(([label, value]) => (
            <BpFactLine key={label} label={label} value={value} />
          ))}
        </div>

        <button
          ref={closeRef}
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
