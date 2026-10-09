import { useEffect, useRef } from "react";
import { AWARD_CATALOG } from "@/lib/awards-catalog";
import type { AwardEntry, AwardType } from "@/lib/providers/wikidata";
import { SFX } from "@/lib/sfx";
import { pushBpBack } from "../bp-back";
import { BpAwardMark } from "../bp-award-mark";
import { useBpT } from "../bp-i18n";
import { currentBpFocus, setBpFocus } from "../use-bp-focus";

function byYear(a: AwardEntry, b: AwardEntry): number {
  return (b.year ?? 0) - (a.year ?? 0);
}

// Every line is a focusable. centerScroll only ever drives a [data-bp-scroll-y]
// in response to focus landing inside it, so a scroller whose only focusable is
// the Close button below it can never be moved: on an Oscar-heavy film every
// category past the first 80vh was unreachable with a remote. The lines do
// nothing on Enter; they exist so Down can walk the list and carry the view.
function BpAwardLine({ id, year, text }: { id: string; year?: number; text: string }) {
  return (
    <span
      role="listitem"
      tabIndex={-1}
      data-bp-focusable
      data-bp-restore-key={`bp-award-line:${id}`}
      className="flex min-h-[44px] items-center gap-[clamp(8px,0.8vw,16px)] rounded-[var(--bp-r-xs)] px-[clamp(8px,0.7vw,14px)] py-[clamp(5px,0.6vh,9px)] text-[clamp(13px,1.8vh,21px)] text-ink outline-none transition-colors duration-[var(--bp-dur-fast)] data-[bp-focus=true]:bg-[var(--bp-glass)] data-[bp-focus=true]:ring-1 data-[bp-focus=true]:ring-[var(--bp-edge-2)] motion-reduce:transition-none"
    >
      {year != null && <span className="shrink-0 tabular-nums text-ink-subtle">{year}</span>}
      <span className="line-clamp-2">{text}</span>
    </span>
  );
}

function BpAwardLines({ label, entries }: { label: string; entries: AwardEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div role="list" className="flex flex-col gap-[clamp(2px,0.3vh,5px)]">
      <p className="pb-[clamp(3px,0.4vh,7px)] text-[clamp(10px,1.25vh,14px)] font-bold uppercase tracking-[0.16em] text-ink-subtle">
        {label}
      </p>
      {entries.map((e, i) => (
        <BpAwardLine
          key={`${e.category ?? e.awardName}-${e.year ?? i}`}
          id={`${e.category ?? e.awardName}-${e.year ?? i}`}
          year={e.year ?? undefined}
          text={e.category || e.awardName}
        />
      ))}
    </div>
  );
}

export function BpAwardDetailDialog({
  type,
  entries,
  onClose,
}: {
  type: AwardType;
  entries: AwardEntry[];
  onClose: () => void;
}) {
  const t = useBpT();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const title = AWARD_CATALOG[type]?.title ?? t("Awards");

  useEffect(() => {
    const prev = currentBpFocus(document.querySelector<HTMLElement>("[data-bp-root]"));
    // The first line, not Close: the list is the content and Down has to walk it
    // downward to drive the scroller, with Close as the last stop.
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

  const wins = entries.filter((e) => e.result === "won").sort(byYear);
  const noms = entries.filter((e) => e.result === "nominated").sort(byYear);

  return (
    <div
      role="dialog"
      aria-label={title}
      data-bp-dialog
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_78%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div className="flex max-h-[80vh] w-[min(88vw,860px)] flex-col gap-[clamp(16px,2.2vh,30px)] rounded-[var(--bp-r-lg)] border border-[var(--bp-edge-2)] bg-[var(--bp-panel)] p-[clamp(26px,3vw,46px)]">
        <div className="flex items-center gap-[clamp(14px,1.4vw,26px)]">
          <BpAwardMark type={type} size="clamp(54px, 7vh, 96px)" />
          <h2 className="font-display text-[clamp(20px,2.9vh,35px)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            {title}
          </h2>
        </div>

        <div
          ref={listRef}
          data-bp-scroll-y
          className="flex flex-col gap-[clamp(16px,2vh,28px)] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <BpAwardLines label={t("{n} wins", { n: wins.length })} entries={wins} />
          <BpAwardLines label={t("{n} nominations", { n: noms.length })} entries={noms} />
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
