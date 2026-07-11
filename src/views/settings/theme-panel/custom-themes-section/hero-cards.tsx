import { ArrowRight, FileDown, Library, Palette } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

export function HeroCards({
  onOpenLibrary,
  onOpenStudio,
  onImport,
  libraryCount,
  importedNotice,
}: {
  onOpenLibrary: () => void;
  onOpenStudio: () => void;
  onImport: () => void;
  libraryCount: number;
  importedNotice?: string | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <HeroCard
        icon={<Library size={28} strokeWidth={2} />}
        title="Theme Library"
        body={`Browse all ${libraryCount} themes. Apply with one click.`}
        cta="Open library"
        onClick={onOpenLibrary}
        accent
        badge={importedNotice}
      />
      <HeroCard
        icon={<Palette size={28} strokeWidth={2} />}
        title="Build a Theme"
        body="Pick a layout, set colors and fonts. No code needed."
        cta="Open studio"
        onClick={onOpenStudio}
      />
      <HeroCard
        icon={<FileDown size={28} strokeWidth={2} />}
        title="Import a Theme"
        body="Got a theme a friend shared? Drop it in."
        cta="Choose file"
        onClick={onImport}
      />
    </div>
  );
}

function HeroCard({
  icon,
  title,
  body,
  cta,
  onClick,
  accent,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
  accent?: boolean;
  badge?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex h-full min-h-[200px] flex-col items-start justify-between overflow-hidden rounded-2xl border p-6 text-start transition-all hover:-translate-y-0.5 ${
        accent
          ? "border-accent/40 hover:border-accent"
          : "border-edge-soft bg-surface hover:border-edge hover:bg-canvas/55"
      }`}
      style={
        accent
          ? {
              background:
                "linear-gradient(160deg, var(--color-accent-soft) 0%, var(--color-surface) 55%, var(--color-surface) 100%)",
            }
          : undefined
      }
    >
      {accent && (
        <span
          aria-hidden
          className="pointer-events-none absolute -end-16 -top-16 h-52 w-52 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
          style={{ background: "var(--color-accent)" }}
        />
      )}
      {badge && <ImportBadge name={badge} />}
      <span
        className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${
          accent ? "text-canvas" : "border border-edge-soft bg-canvas/40 text-ink-muted"
        }`}
        style={accent ? { background: "var(--color-accent)" } : undefined}
      >
        {icon}
      </span>
      <div className="relative flex flex-col gap-1.5">
        <span className="text-[20px] font-semibold tracking-tight text-ink">{title}</span>
        <span className="max-w-[28ch] text-[13.5px] leading-relaxed text-ink-muted">{body}</span>
      </div>
      <span
        className={`relative inline-flex items-center gap-1.5 text-[13px] font-semibold transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 ${
          accent ? "text-accent" : "text-ink"
        }`}
      >
        {cta}
        <ArrowRight size={14} strokeWidth={2.2} className="dir-icon" />
      </span>
    </button>
  );
}

function ImportBadge({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<{ top: number; right: number } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setTip({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  };
  return (
    <span ref={ref} className="absolute end-3 top-3 z-20" onMouseEnter={show} onMouseLeave={() => setTip(null)}>
      <span
        className="flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-accent text-[14px] font-bold leading-none text-canvas shadow-[0_3px_10px_-2px_var(--color-accent)] ring-2 ring-[var(--color-surface)]"
        aria-label={`${name} imported to your library`}
      >
        !
      </span>
      {tip &&
        createPortal(
          <div
            style={{ position: "fixed", top: tip.top, right: tip.right, zIndex: 9999 }}
            className="pointer-events-none w-max max-w-[260px] rounded-lg border border-edge bg-elevated px-3 py-2 text-start text-[12.5px] leading-snug text-ink shadow-[0_18px_44px_-16px_rgba(0,0,0,0.75)]"
          >
            <span className="font-semibold text-accent">{name}</span> imported to your library
          </div>,
          document.body,
        )}
    </span>
  );
}
