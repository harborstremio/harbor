import { Check, ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { advanceFocus } from "@/lib/keyboard-navigation";
import { getDirection, isBackKey } from "@/lib/keyboard-navigation/geometry";

export type DropdownOption = { value: string; label: string; left?: ReactNode };

const MENU_MAX = 320;
const GAP = 6;
const EDGE = 8;

type MenuBox = {
  top: number;
  left: number;
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
  up: boolean;
};

export function Dropdown({
  value,
  options,
  onChange,
  placeholder,
  className = "",
  size = "md",
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<MenuBox | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.find((o) => o.value === value) ?? null;

  const holdsFocus = () => !!listRef.current?.contains(document.activeElement);

  const close = (restore: boolean) => {
    setOpen(false);
    const trigger = btnRef.current;
    if (restore && trigger) advanceFocus(trigger);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || listRef.current?.contains(t)) return;
      close(holdsFocus());
    };
    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close(true);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const menu = listRef.current;
      const maxWidth = Math.min(MENU_MAX, window.innerWidth - EDGE * 2);
      const minWidth = Math.min(r.width, maxWidth);
      const width = Math.min(maxWidth, Math.max(minWidth, menu?.offsetWidth ?? minWidth));
      const natural = menu?.offsetHeight ?? options.length * (size === "sm" ? 36 : 40) + 8;
      const below = window.innerHeight - r.bottom - GAP - EDGE;
      const above = r.top - GAP - EDGE;
      const up = natural > below && above > below;
      const maxHeight = Math.max(120, Math.min(360, window.innerHeight * 0.6, up ? above : below));
      const top = up ? Math.max(EDGE, r.top - GAP - Math.min(natural, maxHeight)) : r.bottom + GAP;
      const rtl = getComputedStyle(el).direction === "rtl";
      const anchored = rtl ? r.right - width : r.left;
      const left = Math.min(Math.max(EDGE, anchored), Math.max(EDGE, window.innerWidth - width - EDGE));
      setBox({ top, left, minWidth, maxWidth, maxHeight, up });
    };
    place();
    let raf = 0;
    const reflow = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        place();
      });
    };
    window.addEventListener("resize", reflow);
    window.addEventListener("scroll", reflow, true);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", reflow);
      window.removeEventListener("scroll", reflow, true);
    };
  }, [open, options.length, size]);

  const placed = box != null;
  useLayoutEffect(() => {
    if (!open || !placed) return;
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, placed]);

  const entered = useRef(false);
  useEffect(() => {
    if (!open) {
      entered.current = false;
      return;
    }
    if (!placed || entered.current) return;
    entered.current = true;
    const at = options.findIndex((o) => o.value === value);
    const el = optionRefs.current[at < 0 ? 0 : at];
    if (el) advanceFocus(el);
  }, [open, placed, options, value]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = getDirection(e.nativeEvent);
    const edge = e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : null;
    if (edge === null && dir !== "up" && dir !== "down") return;
    e.preventDefault();
    const from = optionRefs.current.indexOf(e.target as HTMLButtonElement);
    if (from < 0) return;
    const at = edge ?? from + (dir === "down" ? 1 : -1);
    const el = optionRefs.current[at];
    if (!el || at === from) return;
    advanceFocus(el, at > from ? "down" : "up");
  };

  const chevRef = useRef<HTMLSpanElement>(null);
  const spinChevron = (next: boolean) => {
    const chev = chevRef.current;
    if (!chev) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const from = next ? 0 : 180;
    const to = next ? 180 : 0;
    chev.animate(
      [
        { transform: `rotate(${from}deg) scale(1, 1)` },
        { transform: `rotate(${(from + to) / 2}deg) scale(1.2, 0.8)`, offset: 0.42 },
        { transform: `rotate(${to + (next ? 12 : -12)}deg) scale(0.94, 1.08)`, offset: 0.72 },
        { transform: `rotate(${to}deg) scale(1, 1)` },
      ],
      { duration: 400, easing: "ease-in-out" },
    );
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          spinChevron(!open);
          if (open) close(holdsFocus());
          else setOpen(true);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 rounded-md outline-none transition-colors ${
          size === "sm" ? "h-9 px-3 text-[12.5px]" : "h-11 px-3.5 text-[13.5px]"
        } ${open ? "bg-raised" : "bg-canvas hover:bg-elevated"}`}
      >
        <span className={`flex min-w-0 items-center gap-2 ${selected ? "text-ink" : "text-ink-subtle"}`}>
          {selected?.left}
          <span className="truncate">{selected?.label ?? placeholder ?? ""}</span>
        </span>
        <span
          ref={chevRef}
          aria-hidden
          className="shrink-0 text-ink-subtle"
          style={{ display: "inline-flex", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <ChevronDown size={16} strokeWidth={2} />
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            data-dropdown-menu
            onKeyDown={onMenuKeyDown}
            style={{
              position: "fixed",
              top: box ? box.top : -9999,
              left: box ? box.left : -9999,
              minWidth: box?.minWidth,
              maxWidth: box?.maxWidth ?? MENU_MAX,
              maxHeight: box?.maxHeight,
              visibility: box ? "visible" : "hidden",
            }}
            className={`z-[9999] w-max overflow-y-auto overscroll-contain rounded-md bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] ${
              box ? (box.up ? "animate-menu-in-up" : "animate-menu-in") : ""
            }`}
          >
            {options.map((o, i) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  ref={(el) => {
                    optionRefs.current[i] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-selected={active}
                  onClick={() => {
                    onChange(o.value);
                    close(true);
                  }}
                  style={{ animationDelay: `${Math.min(i, 8) * 22}ms` }}
                  className={`animate-item-in flex w-full items-center justify-between gap-3 rounded-[4px] px-3 text-start outline-none transition-colors ${
                    size === "sm" ? "h-9 text-[12.5px]" : "h-10 text-[13.5px]"
                  } ${
                    active
                      ? "bg-ink font-semibold text-canvas"
                      : "text-ink-muted hover:bg-raised hover:text-ink focus:bg-raised focus:text-ink"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {o.left}
                    <span className="truncate">{o.label}</span>
                  </span>
                  {active && (
                    <Check size={15} strokeWidth={2.4} className="animate-badge-pop shrink-0" />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
