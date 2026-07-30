import type { LocalEntry } from "@/lib/local-library";

/**
 * Shared, stable-identity props for every local card. Selection is passed as a
 * per-card boolean rather than the Set, so replacing the Set on each toggle
 * doesn't defeat React.memo across the whole grid.
 */
export type LocalCardProps = {
  selectMode: boolean;
  onToggleSelect: (ids: string[], range?: boolean) => void;
  onFixMatch: (entries: LocalEntry | LocalEntry[]) => void;
  onExport: (entries: LocalEntry | LocalEntry[]) => void;
  onOpenDetail: (entry: LocalEntry) => void;
};

export function CardIconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={title}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas/70 text-ink opacity-0 shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-opacity duration-200 hover:bg-canvas/90 group-hover:opacity-100"
    >
      {children}
    </button>
  );
}
