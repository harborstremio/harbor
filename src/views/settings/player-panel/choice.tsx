import type { ReactNode } from "react";

export function Tag({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${
        accent ? "bg-accent-soft text-accent" : "bg-canvas text-ink-muted"
      }`}
    >
      {text}
    </span>
  );
}

export function ChoiceBlock({
  id,
  selected,
  onClick,
  label,
  sub,
  tags,
}: {
  id?: string;
  selected: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
  tags?: ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex scroll-mt-28 items-start gap-3.5 rounded-md px-4 py-3.5 text-start transition-colors ${
        selected ? "bg-raised" : "bg-elevated hover:bg-raised"
      }`}
    >
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors ${
          selected ? "bg-accent" : "bg-canvas"
        }`}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-canvas" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-medium leading-snug text-ink">{label}</span>
          {tags}
        </span>
        {sub && <span className="text-[12.5px] leading-relaxed text-ink-subtle">{sub}</span>}
      </span>
    </button>
  );
}

export { Nested } from "../kit";

export function Anchored({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-28">
      {children}
    </div>
  );
}
