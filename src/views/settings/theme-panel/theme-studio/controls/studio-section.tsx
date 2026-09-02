import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

export function StudioSection({
  title,
  action,
  hint,
  collapsible = false,
  defaultOpen = true,
  children,
}: {
  title: string;
  action?: ReactNode;
  hint?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const body = (
    <>
      {hint && <p className="mt-1 text-[12.5px] leading-snug text-ink-subtle">{hint}</p>}
      <div className="mt-3">{children}</div>
    </>
  );

  if (collapsible) {
    return (
      <section className="pb-6">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-full items-center gap-2 rounded-md text-start outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-subtle">{title}</span>
          {action}
          <ChevronDown
            size={16}
            strokeWidth={2.4}
            className={`shrink-0 text-ink-subtle/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && body}
      </section>
    );
  }

  return (
    <section className="pb-6">
      <div className="flex h-9 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-subtle">{title}</span>
        {action}
      </div>
      {body}
    </section>
  );
}
