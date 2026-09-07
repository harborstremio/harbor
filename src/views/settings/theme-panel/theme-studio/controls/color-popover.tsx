import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { captureFocusReturn, tvFocus } from "@/lib/keyboard-navigation";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { useT } from "@/lib/i18n";
import { CustomColorPanel } from "@/views/settings/color-picker";

const PANEL_W = 280;
const GAP = 8;
const FALLBACK_H = 300;

function clipBox(el: HTMLElement | null) {
  let box = { top: GAP, bottom: window.innerHeight - GAP, left: GAP, right: window.innerWidth - GAP };
  let node = el?.parentElement ?? null;
  while (node) {
    const s = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(`${s.overflowY} ${s.overflowX}`)) {
      const r = node.getBoundingClientRect();
      box = {
        top: Math.max(box.top, r.top + GAP),
        bottom: Math.min(box.bottom, r.bottom - GAP),
        left: Math.max(box.left, r.left + GAP),
        right: Math.min(box.right, r.right - GAP),
      };
    }
    node = node.parentElement;
  }
  return box;
}

export function ColorPopover({
  label,
  value,
  onChange,
  align = "start",
  direction = "down",
  className = "",
  children,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  align?: "start" | "end";
  direction?: "up" | "down";
  className?: string;
  children: (open: boolean) => ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      if (document.querySelector("[data-search-editing]")) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const placed = pos !== null;
  useEffect(() => {
    if (!open || !placed) return;
    const restore = captureFocusReturn();
    const field = panelRef.current?.querySelector("input");
    if (field) tvFocus(field);
    return restore;
  }, [open, placed]);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    let frame = 0;
    const place = () => {
      const wrap = wrapRef.current;
      const r = wrap?.getBoundingClientRect();
      if (!r) return;
      const box = clipBox(wrap);
      const height = panelRef.current?.offsetHeight || FALLBACK_H;

      const rtl = getComputedStyle(document.documentElement).direction === "rtl";
      const fromEndEdge = (align === "end") !== rtl;
      const raw = fromEndEdge ? r.right - PANEL_W : r.left;
      const maxLeft = Math.max(box.left, box.right - PANEL_W);
      const left = Math.min(Math.max(box.left, raw), maxLeft);

      const roomBelow = box.bottom - (r.bottom + GAP);
      const roomAbove = r.top - GAP - box.top;
      let up = direction === "up";
      if (up && roomAbove < height && roomBelow > roomAbove) up = false;
      if (!up && roomBelow < height && roomAbove > roomBelow) up = true;

      const top = up
        ? Math.max(box.top + height, Math.min(r.top - GAP, box.bottom))
        : Math.max(box.top, Math.min(r.bottom + GAP, box.bottom - height));

      setPos({ top, left, up });
    };
    place();
    frame = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, direction]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={t("Edit {label} color", { label })}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="relative block h-full min-h-11 w-full text-start outline-none"
      >
        {children(open)}
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[310]"
              onMouseDown={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-label={t("{label} color", { label })}
              aria-modal="true"
              onBlur={(e) => {
                const next = e.relatedTarget as Node | null;
                if (!next) return;
                if (panelRef.current?.contains(next) || wrapRef.current?.contains(next)) return;
                setOpen(false);
              }}
              className="animate-nudge-in fixed z-[320] w-[280px] rounded-md bg-surface p-3 harbor-float"
              style={{
                top: pos.top,
                left: pos.left,
                ...(pos.up ? { transform: "translateY(-100%)" } : null),
              }}
            >
              <CustomColorPanel value={value} onChange={onChange} />
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
