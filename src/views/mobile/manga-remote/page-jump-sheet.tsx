import { useEffect, useRef, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { useMobileRemote } from "../mobile-remote";
import { useRegisterSheet } from "../mobile-sheet-lock";
import { SHEET_EXIT_CSS, useSheetPresence } from "../remote-extras";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const clampPage = (p: number, total: number) => Math.min(total, Math.max(1, p));

export function PageJumpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snapshot, sendCommand } = useMobileRemote();
  const manga = snapshot.manga;
  const reduce = useReducedMotion();
  const t = useT();
  const { render, leaving } = useSheetPresence(open);
  useRegisterSheet(open);
  const total = Math.max(1, manga?.pageCount ?? 1);
  const [page, setPage] = useState((manga?.pageIndex ?? 0) + 1);

  useEffect(() => {
    if (open) setPage(clampPage((manga?.pageIndex ?? 0) + 1, total));
  }, [open]);

  if (!render || !manga) return null;

  const paged2 = manga.mode === "book" || manga.mode === "double";
  const start = page % 2 === 1 ? page : page - 1;
  const pairEnd = Math.min(start + 1, total);
  const isPair = paged2 && pairEnd > start;
  const pageDisp = isPair ? `${start}-${pairEnd}` : String(page);

  const commit = (p: number) => {
    const target = paged2 ? (p % 2 === 1 ? p : p - 1) : p;
    sendCommand({ action: "mangaSetPage", page: clampPage(Math.round(target), total) - 1 });
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-[82] flex flex-col justify-end bg-black/60 backdrop-blur-sm ${leaving ? "harbor-sheet-scrim-out" : reduce ? "" : "animate-fade-in"}`}
      onClick={onClose}
    >
      <style>{SHEET_EXIT_CSS}</style>
      <div
        className={`flex flex-col gap-6 rounded-t-2xl border-t border-edge-soft/60 bg-elevated px-5 pt-4 ${leaving ? "harbor-sheet-panel-out" : reduce ? "" : "animate-in slide-in-from-bottom-4 duration-300"}`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/20" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            {isPair ? t("Jump to spread") : t("Jump to page")}
          </span>
          <span
            className={`font-bold leading-none tabular-nums text-ink ${isPair ? "text-[34px]" : "text-[44px]"}`}
          >
            {pageDisp}
            <span className="text-[20px] font-semibold text-ink-subtle"> / {total}</span>
          </span>
        </div>
        <PageScrubber page={page} total={total} onChange={setPage} reduce={reduce} />
        <div className="flex items-center gap-3">
          <Stepper
            label={t("Previous page")}
            onPress={() => setPage((p) => clampPage(p - 1, total))}
          >
            <Minus size={20} strokeWidth={2.4} />
          </Stepper>
          <button
            type="button"
            onClick={() => commit(page)}
            className="h-12 flex-1 rounded-full bg-accent text-[15px] font-semibold text-canvas transition-transform active:scale-[0.97]"
          >
            {isPair
              ? t("Go to pages {pages}", { pages: pageDisp })
              : t("Go to page {page}", { page })}
          </button>
          <Stepper label={t("Next page")} onPress={() => setPage((p) => clampPage(p + 1, total))}>
            <Plus size={20} strokeWidth={2.4} />
          </Stepper>
        </div>
      </div>
    </div>
  );
}

function PageScrubber({
  page,
  total,
  onChange,
  reduce,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
  reduce: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [drag, setDrag] = useState(false);
  const pct = total > 1 ? (page - 1) / (total - 1) : 0;
  const still = reduce || drag;
  const fromEvent = (clientX: number) => {
    const el = ref.current;
    if (!el) return page;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)));
    return Math.min(total, Math.max(1, Math.round(1 + f * (total - 1))));
  };
  return (
    <div
      ref={ref}
      className="relative h-11 touch-none select-none"
      onPointerDown={(e) => {
        dragging.current = true;
        setDrag(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(fromEvent(e.clientX));
      }}
      onPointerMove={(e) => {
        if (dragging.current) onChange(fromEvent(e.clientX));
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        setDrag(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        setDrag(false);
      }}
    >
      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full rounded-full bg-accent"
          style={{
            width: `${pct * 100}%`,
            transition: still ? "none" : "width 120ms var(--ease-out)",
          }}
        />
      </div>
      <div
        className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_4px_12px_-4px_rgba(0,0,0,0.6)] ring-4 ring-canvas"
        style={{ left: `${pct * 100}%`, transition: still ? "none" : "left 120ms var(--ease-out)" }}
      />
    </div>
  );
}

function Stepper({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onPress}
      className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-raised text-ink transition-transform active:scale-90"
    >
      {children}
    </button>
  );
}
