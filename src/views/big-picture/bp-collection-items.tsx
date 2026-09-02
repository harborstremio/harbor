import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { SFX } from "@/lib/sfx";
import { pushBigPicture } from "@/lib/big-picture";
import { publishBpMeta } from "./bp-focus-meta";
import { pushBpBack } from "./bp-back";
import { bpFocusables, markBpInteracted, setBpFocus } from "./use-bp-focus";
import { BpGridScroller } from "./bp-grid";
import { BpCollectionEmpty, BpCollectionGrid } from "./bp-collection-shell";
import { BpTile } from "./bp-tile";
import { useBpT } from "./bp-i18n";
import type { BpCollectionOpen } from "./use-bp-collection-feed";

type ItemsOpen = Extract<BpCollectionOpen, { kind: "items" }>;

// [data-bp-row] carries the page gutter as padding plus a matching negative
// margin, and this panel already pays its own gutter.
const HEADER_SCOPE = { paddingInline: 0, marginInline: 0 } as const;

function toMeta(item: { id: string; type: string; name: string; poster?: string }): Meta {
  return {
    id: item.id,
    type: item.type === "series" ? "series" : "movie",
    name: item.name,
    poster: item.poster,
  } as Meta;
}

export function BpCollectionItems({
  open,
  restoreKey,
  onClose,
}: {
  open: ItemsOpen;
  restoreKey: string;
  onClose: () => void;
}) {
  const t = useBpT();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const metas = useMemo(() => open.items.map(toMeta), [open.items]);

  useEffect(() => pushBpBack(() => {
    onClose();
    return true;
  }), [onClose]);

  useEffect(() => {
    markBpInteracted();
    const frame = window.requestAnimationFrame(() => {
      const first = bpFocusables(boxRef.current)[0];
      if (first) setBpFocus(first, { silent: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      const back = document.querySelector<HTMLElement>(
        `[data-bp-restore-key="${CSS.escape(restoreKey)}"]`,
      );
      if (back) setBpFocus(back, { silent: true });
    };
  }, [restoreKey]);

  const select = (m: Meta) => {
    publishBpMeta(m);
    pushBigPicture({ kind: "detail", metaId: `${m.type}:${m.id}` });
  };

  return (
    <div
      ref={boxRef}
      data-bp-dialog
      role="dialog"
      aria-label={open.name}
      className="absolute inset-0 z-30 flex flex-col gap-[clamp(11px,1.4vh,22px)] bg-[var(--bp-void)] px-[var(--bp-gutter)] pb-[var(--bp-hint-h)] pt-[var(--bp-page-top)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
    >
      <div data-bp-row className="shrink-0" style={HEADER_SCOPE}>
      <div data-bp-scroll-x className="flex items-start gap-[clamp(12px,1.4vw,28px)]">
        <div className="flex min-w-0 flex-1 flex-col gap-[clamp(5px,0.7vh,11px)]">
          <span className="text-[clamp(11px,1.5vh,17px)] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {open.byline ?? t("My collection")}
          </span>
          <h1 className="text-[clamp(24px,4.4vh,54px)] font-bold leading-[1.05] tracking-[-0.02em] text-ink">
            {open.name}
          </h1>
          <span className="text-[clamp(11.5px,1.55vh,18px)] font-semibold text-ink-muted">
            {t("{count} items", { count: open.items.length + open.hidden })}
          </span>
          {open.hidden > 0 && (
            <span className="text-[clamp(11.5px,1.55vh,18px)] font-medium text-ink-subtle">
              {t("{count} manga items are not shown in Big Picture.", { count: open.hidden })}
            </span>
          )}
        </div>
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          onClick={() => {
            SFX.close();
            onClose();
          }}
          aria-label={t("Close")}
          className="flex h-[clamp(44px,5vh,58px)] shrink-0 items-center gap-2 rounded-full border border-[var(--bp-edge)] px-[clamp(14px,1.2vw,22px)] text-[clamp(12.5px,1.78vh,20px)] font-semibold text-ink-subtle transition-colors duration-[var(--bp-dur-fast)]"
        >
          <X size={17} strokeWidth={2.2} />
          {t("Close")}
        </button>
      </div>
      </div>

      <BpGridScroller>
        {metas.length > 0 ? (
          <BpCollectionGrid>
            {metas.map((m, i) => (
              <BpTile key={`${m.id}-${i}`} meta={m} onSelect={select} />
            ))}
          </BpCollectionGrid>
        ) : (
          <BpCollectionEmpty text={t("This collection is empty.")} />
        )}
      </BpGridScroller>
    </div>
  );
}
