import { ChevronDown, EyeOff } from "lucide-react";
import { useState, type ReactNode, type Ref } from "react";
import { hideMangaRow, useMangaHiddenRows } from "./manga-row-visibility";

function readOpen(key: string): boolean {
  try {
    return localStorage.getItem(key) !== "0";
  } catch {
    return true;
  }
}

export function CollapsibleSection({
  storageKey,
  title,
  leading,
  trailing,
  className,
  rootRef,
  hideKey,
  children,
}: {
  storageKey: string;
  title: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  rootRef?: Ref<HTMLElement>;
  hideKey?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(storageKey));
  const hiddenRows = useMangaHiddenRows();

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        void 0;
      }
      return next;
    });
  };

  if (hideKey && hiddenRows.has(hideKey)) return null;

  return (
    <section ref={rootRef} className={`flex flex-col gap-3 ${className ?? ""}`}>
      <div className="group/section flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="group flex items-center gap-2.5 text-start active:scale-[0.99] motion-reduce:active:scale-100"
        >
          <ChevronDown
            size={18}
            strokeWidth={2.4}
            className={`shrink-0 text-ink-subtle transition-transform duration-300 ease-out group-hover:text-ink-muted motion-reduce:transition-none ${
              open ? "" : "-rotate-90"
            }`}
          />
          {leading}
          <h2 className="text-[18px] font-semibold tracking-tight text-ink">{title}</h2>
        </button>
        {trailing}
        {hideKey && (
          <button
            type="button"
            onClick={() => hideMangaRow(hideKey)}
            aria-label={`Hide ${title}`}
            className="ms-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-subtle opacity-0 transition-[opacity,background-color,color] hover:bg-elevated/60 hover:text-ink focus-visible:opacity-100 group-hover/section:opacity-100 motion-reduce:transition-none"
          >
            <EyeOff size={15} strokeWidth={2.2} />
          </button>
        )}
      </div>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3 pt-0.5">{children}</div>
        </div>
      </div>
    </section>
  );
}
