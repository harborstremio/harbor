import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { BrowseCatalog } from "@/lib/catalog-browse";
import { ModalButton, SettingsModal } from "@/views/settings/kit";
import {
  arrange,
  clearOrder,
  readOrder,
  withHidden,
  withMove,
  writeOrder,
  type SectionOrder,
} from "./section-order";

const BTN =
  "flex h-7 w-7 items-center justify-center text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:cursor-default disabled:opacity-25";

/** The two steps as one control.
 *
 * Two separate circles put a border each a few pixels apart, which on a dark background reads as one
 * smudge rather than as two buttons. A single outline with a hairline between them reads as one
 * thing you move up and down, which is what it is. */
function Stepper({
  name,
  first,
  last,
  onUp,
  onDown,
  upLabel,
  downLabel,
}: {
  name: string;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  upLabel: string;
  downLabel: string;
}) {
  return (
    <span className="flex shrink-0 items-center overflow-hidden rounded-full border border-edge-soft">
      <button
        type="button"
        onClick={onUp}
        disabled={first}
        aria-label={`${upLabel} ${name}`}
        className={`${BTN} border-e border-edge-soft`}
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={last}
        aria-label={`${downLabel} ${name}`}
        className={BTN}
      >
        <ChevronDown size={14} />
      </button>
    </span>
  );
}

/** The handle a row is picked up by.
 *
 * A native drag was tried first and refused every drop here, showing the crossed-out circle the
 * whole way. So the row is moved by pointer instead: the press is caught, the pointer is captured so
 * the moves keep arriving after it leaves the handle, and the row under the pointer is what the drop
 * means. The handle is the only part that starts a move, so the row's own buttons stay ordinary
 * buttons. `touch-none` keeps a press on it from being read as a scroll and, more importantly, from
 * being taken away by the browser as a pan before the pointer is captured. */
function Grip({
  label,
  onDown,
  onMove,
  onUp,
}: {
  label: string;
  onDown: (e: ReactPointerEvent<HTMLSpanElement>) => void;
  onMove: (e: ReactPointerEvent<HTMLSpanElement>) => void;
  onUp: () => void;
}) {
  return (
    <span
      role="presentation"
      aria-label={label}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className="flex shrink-0 cursor-grab touch-none select-none items-center text-ink-subtle/50 active:cursor-grabbing"
    >
      <GripVertical size={14} />
    </span>
  );
}

/** What the panel lists: every row, hidden ones included, because a row that vanished when it was
 * turned off could never be turned back on from here. What the tab shows is the same list with the
 * hidden ones taken out, so the panel is that list plus a mark on the ones the tab is not showing. */
function listedIn(groups: [string, BrowseCatalog[]][], order: SectionOrder) {
  return arrange(groups, { ...order, hidden: [] });
}

type Placed = { plugin: string; key: string | null };

/** How long a row takes to slide into the place it was moved to. */
const SLIDE_MS = 170;

/** The row that follows the pointer while one is being moved.
 *
 * It is drawn in a portal on the body because the panel scrolls and has ancestors with their own
 * stacking: a ghost inside it would be clipped at the panel's edge and would jump when the panel
 * scrolled under it. It is placed from the pointer and corrected by its own size, so the grab point
 * holds wherever on the handle it was picked up. */
function DragGhost({
  grab,
  label,
  hint,
}: {
  grab: { x: number; y: number; dx: number; dy: number } | null;
  label: string;
  hint: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // Measured rather than assumed: the label decides the width.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    setSize((prev) =>
      prev && prev.w === box.width && prev.h === box.height ? prev : { w: box.width, h: box.height },
    );
  }, [label]);

  if (!grab) return null;
  return createPortal(
    <div
      ref={ref}
      data-drag-ghost
      style={{
        left: grab.x - (size?.w ?? 0) / 2,
        top: grab.y - (size?.h ?? 0) / 2,
      }}
      className="pointer-events-none fixed z-[300] flex items-center gap-2 rounded-md border border-edge-soft bg-raised px-2 py-1 text-[13.5px] text-ink shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]"
    >
      <GripVertical size={14} className="shrink-0 text-ink-subtle/50" />
      <span className="max-w-[280px] truncate">{label}</span>
      <span className="shrink-0 text-[11.5px] text-ink-subtle">{hint}</span>
    </div>,
    document.body,
  );
}

export function PluginArrange({
  groups,
  onClose,
  onChanged,
}: {
  groups: [string, BrowseCatalog[]][];
  onClose: () => void;
  onChanged: (order: SectionOrder) => void;
}) {
  const t = useT();
  const [order, setOrder] = useState<SectionOrder>(() => readOrder());
  const [held, setHeld] = useState<Placed | null>(null);
  const [grab, setGrab] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const apply = useCallback(
    (next: SectionOrder) => {
      setOrder(next);
      writeOrder(next);
      onChanged(next);
    },
    [onChanged],
  );

  const listed = listedIn(groups, order);
  const rowId = (plugin: string, key: string | null) => `${plugin}::${key ?? ""}`;
  // Every row is also held as a pair, because a plugin name is free text and reading one back out of
  // a string would be guessing where the name ended and the key began.
  const byId = useMemo(() => {
    const map = new Map<string, Placed>();
    for (const [plugin, rows] of listed) {
      map.set(rowId(plugin, null), { plugin, key: null });
      for (const row of rows) map.set(rowId(plugin, row.key), { plugin, key: row.key });
    }
    return map;
  }, [listed]);

  /* Rows slide to where they were moved to rather than appearing there.
   *
   * The panel redraws in the new order one render after the move, so the old and new places are
   * measured there and each row is started from the difference and released. Naming the transition
   * and removing it on the next frame is what makes the row move rather than be teleported, and it
   * is removed rather than never added so that opening the panel does not slide everything into
   * place. A layout effect so the start position is set before anything is painted. */
  const places = useRef(new Map<string, DOMRect>());
  const slides = useRef(new Set<string>());
  const measured = held ? null : listed.map(([, rows]) => rows.map((r) => r.key).join("|")).join("@");

  useLayoutEffect(() => {
    const host = scrollRef.current;
    if (!host || held) return;
    const next = new Map<string, DOMRect>();
    for (const node of host.querySelectorAll<HTMLElement>("[data-arrange-row]")) {
      const id = node.dataset.arrangeRow;
      if (!id) continue;
      const box = node.getBoundingClientRect();
      next.set(id, box);
      const was = places.current.get(id);
      if (!was || node.animate === undefined) continue;
      const dy = was.top - box.top;
      if (!dy) continue;
      slides.current.add(id);
      const slide = node.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
        duration: SLIDE_MS,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      });
      slide.addEventListener("finish", () => slides.current.delete(id));
    }
    places.current = next;
  }, [measured, held]);

  // A wheel over the panel scrolls it. The rows are pointer-interactive, so the browser leaves them
  // alone, and scrolling while an item is held is the only way to reach a place off-screen.
  useEffect(() => {
    const host = scrollRef.current;
    if (!host) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      host.scrollTop += e.deltaY;
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, []);

  const beginDrag = (e: ReactPointerEvent<HTMLSpanElement>, at: Placed) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const box = e.currentTarget.getBoundingClientRect();
    setHeld(at);
    // How far into the handle it was picked up, so the ghost keeps that point under the pointer.
    setGrab({
      x: e.clientX,
      y: e.clientY,
      dx: e.clientX - (box.left + box.width / 2),
      dy: e.clientY - (box.top + box.height / 2),
    });
    setOver(rowId(at.plugin, at.key));
  };

  // The event target is always the captured handle, so the row being pointed at is read from the
  // coordinates instead.
  const hoverDrag = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!held) return;
    setGrab((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-arrange-row]");
    const id = under instanceof HTMLElement ? under.dataset.arrangeRow ?? null : null;
    setOver((prev) => (prev === id ? prev : id));
  };

  const dropOn = (from: Placed, to: Placed) => {
    if (from.key === null) {
      const names = listed.map(([name]) => name);
      const at = names.indexOf(from.plugin);
      const target = names.indexOf(to.plugin);
      if (at >= 0 && target >= 0 && at !== target) {
        apply(withMove(order, listed, from.plugin, null, target - at));
      }
      return;
    }
    // A row only moves inside its own plugin: it is listed under that plugin's name, and moving it
    // to another would put it somewhere the tab has no heading for it.
    if (to.plugin !== from.plugin) return;
    const keys = listed.find(([name]) => name === from.plugin)?.[1].map((r) => r.key) ?? [];
    const at = keys.indexOf(from.key);
    const target = to.key === null ? keys.length - 1 : keys.indexOf(to.key);
    if (at >= 0 && target >= 0 && at !== target) {
      apply(withMove(order, listed, from.plugin, from.key, target - at));
    }
  };

  const endDrag = () => {
    const target = over ? byId.get(over) : undefined;
    if (held && target) dropOn(held, target);
    setHeld(null);
    setGrab(null);
    setOver(null);
  };

  const heldLabel = held
    ? held.key === null
      ? held.plugin
      : (listed.find(([name]) => name === held.plugin)?.[1].find((r) => r.key === held.key)?.name ??
        held.key)
    : "";

  const reset = () => {
    clearOrder();
    setOrder({ plugins: [], rows: {}, hidden: [] });
    onChanged({ plugins: [], rows: {}, hidden: [] });
  };

  return (
    <>
      <SettingsModal
        open
        onClose={onClose}
        title={t("Arrange the plugin tab")}
        sub={t("This arranges the All plugins page. A single plugin still lists its own rows as it reports them.")}
        width={560}
        actions={
          <>
            <ModalButton ghost onClick={reset}>
              <span className="flex items-center gap-2">
                <RotateCcw size={14} />
                {t("Reset")}
              </span>
            </ModalButton>
            <ModalButton onClick={onClose}>{t("Done")}</ModalButton>
          </>
        }
      >
        <div ref={scrollRef} data-arrange-scroll className="max-h-[62vh] overflow-y-auto">
          {listed.length === 0 ? (
            <p className="py-4 text-[14px] leading-[20px] text-ink-subtle">
              {t("No plugin has any rows to arrange.")}
            </p>
          ) : (
            listed.map(([plugin, rows], pi) => (
              <section key={plugin} className="flex flex-col gap-0.5 py-2">
                <div
                  data-arrange-row={rowId(plugin, null)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1 ${
                    held?.key === null && held.plugin === plugin
                      ? "opacity-45"
                      : over === rowId(plugin, null)
                        ? "bg-elevated/70"
                        : ""
                  }`}
                >
                  <Grip
                    label={plugin}
                    onDown={(e) => beginDrag(e, { plugin, key: null })}
                    onMove={hoverDrag}
                    onUp={endDrag}
                  />
                  <span className="flex-1 truncate text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">
                    {plugin}
                  </span>
                  <Stepper
                    name={plugin}
                    first={pi === 0}
                    last={pi === listed.length - 1}
                    onUp={() => apply(withMove(order, listed, plugin, null, -1))}
                    onDown={() => apply(withMove(order, listed, plugin, null, 1))}
                    upLabel={t("Move up")}
                    downLabel={t("Move down")}
                  />
                </div>
                {rows.map((row, ri) => {
                  const name = row.name || row.id;
                  const hidden = order.hidden.includes(row.key);
                  const id = rowId(plugin, row.key);
                  const isHeld = held?.key === row.key && held.plugin === plugin;
                  return (
                    <div
                      key={row.key}
                      data-arrange-row={id}
                      className={`flex items-center gap-2 rounded-md py-0.5 pe-2 ps-7 ${
                        isHeld ? "opacity-45" : over === id ? "bg-elevated/70" : ""
                      } ${hidden ? "opacity-55" : ""}`}
                    >
                      <Grip
                        label={name}
                        onDown={(e) => beginDrag(e, { plugin, key: row.key })}
                        onMove={hoverDrag}
                        onUp={endDrag}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{name}</span>
                      {hidden && (
                        <span className="shrink-0 text-[11.5px] text-ink-subtle">{t("Hidden")}</span>
                      )}
                      <Stepper
                        name={name}
                        first={ri === 0}
                        last={ri === rows.length - 1}
                        onUp={() => apply(withMove(order, listed, plugin, row.key, -1))}
                        onDown={() => apply(withMove(order, listed, plugin, row.key, 1))}
                        upLabel={t("Move up")}
                        downLabel={t("Move down")}
                      />
                      <button
                        type="button"
                        onClick={() => apply(withHidden(order, row.key, !hidden))}
                        aria-label={`${hidden ? t("Show") : t("Hide")} ${name}`}
                        aria-pressed={!hidden}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                      >
                        {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </div>
      </SettingsModal>
      <DragGhost
        grab={grab}
        label={heldLabel}
        hint={t("Release to place")}
      />
    </>
  );
}
