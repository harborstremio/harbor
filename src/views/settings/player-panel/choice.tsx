import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { RowDesc, RowText, RowTitle, useRegisterRowTitle } from "../shared";

export const BADGE_BASE =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

export function Tag({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <span
      className={`${BADGE_BASE} ${accent ? "bg-accent-soft text-accent" : "bg-elevated text-ink-subtle"}`}
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
  useRegisterRowTitle(label);
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-interactive=""
      className="hset-row scroll-mt-28"
    >
      <RowText>
        <RowTitle>
          <span className="min-w-0">{label}</span>
          {tags}
        </RowTitle>
        {sub && <RowDesc>{sub}</RowDesc>}
      </RowText>
      <span
        aria-hidden
        className="hset-row-control flex min-h-11 min-w-0 items-center justify-end"
      >
        <Check
          size={20}
          strokeWidth={2.6}
          className={`shrink-0 text-accent transition-opacity duration-150 ${
            selected ? "opacity-100" : "opacity-0"
          }`}
        />
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
