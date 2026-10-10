import { Check, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

export function Tab({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold transition-colors disabled:opacity-40 ${
        active
          ? "bg-elevated text-ink ring-1 ring-edge"
          : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function Count({ value }: { value: number }) {
  return <span className="text-[11.5px] tabular-nums text-ink-subtle">{value}</span>;
}

export function ToggleChip({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={hint}
      className={`flex h-6 items-center rounded-full px-2 text-[11px] font-semibold transition-colors ${
        active ? "bg-accent text-canvas" : "bg-raised text-ink-muted hover:bg-elevated"
      }`}
    >
      {label}
    </button>
  );
}

export function ImportBanner({ name }: { name: string }) {
  const tr = useT();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className={`mx-2 mt-2 flex items-center gap-3 overflow-hidden rounded-xl border border-accent/35 bg-accent/10 px-3.5 py-2.5 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        shown ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-[0.97] opacity-0"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-canvas shadow-[0_0_18px_-2px_var(--color-accent)]">
        <Check size={16} strokeWidth={3} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-semibold text-ink">{name}</span>
        <span className="text-[11px] font-medium text-accent">{tr("Imported and now playing")}</span>
      </div>
      <Sparkles size={15} className="ms-auto shrink-0 text-accent" />
    </div>
  );
}

export function EmptyState({ searchSettled, veryNewMovie }: { searchSettled: boolean; veryNewMovie: boolean }) {
  const tr = useT();
  if (!searchSettled) {
    return (
      <div className="flex items-center gap-2.5 px-5 py-6 text-[13.5px] text-ink-muted">
        <Loader2 size={14} className="animate-spin text-ink-subtle" />
        {tr("Looking for subtitles…")}
      </div>
    );
  }
  if (veryNewMovie) {
    return (
      <div className="flex flex-col gap-1.5 px-5 py-6 text-[13.5px] leading-snug text-ink-muted">
        <span className="text-[14px] font-semibold text-ink">{tr("Movie's too new")}</span>
        <span>{tr("Subtitles haven't been published yet. Try search below or check back in a few days.")}</span>
      </div>
    );
  }
  return (
    <p className="px-5 py-6 text-[13.5px] text-ink-muted">
      {tr("No subtitles found yet. Try the search at the bottom.")}
    </p>
  );
}
