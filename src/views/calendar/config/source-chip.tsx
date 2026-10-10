import type { ReactNode } from "react";

export function SourceChip({
  label,
  selected,
  onToggle,
  leading,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`relative inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 transition-colors before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        selected
          ? "bg-accent-soft text-accent ring-accent"
          : "bg-surface text-ink-muted ring-edge-soft hover:text-ink hover:ring-edge"
      }`}
    >
      {leading}
      {label}
    </button>
  );
}

export function CountryFlag({ code }: { code: string }) {
  return (
    <img
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      alt=""
      loading="lazy"
      className="h-3.5 w-[21px] shrink-0 rounded-[2px] object-cover"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
