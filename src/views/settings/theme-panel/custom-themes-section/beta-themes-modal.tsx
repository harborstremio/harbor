import { ArrowLeft, Check, FlaskConical, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { BETA_THEMES, type ThemePreset } from "@/lib/theme";

export function BetaThemesCard({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl border border-edge-soft bg-surface text-start transition-all hover:border-edge"
    >
      <div className="relative flex h-40 w-full items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_28%_18%,#3574fc_0%,transparent_55%),radial-gradient(ellipse_70%_60%_at_82%_92%,#775bf4_0%,transparent_60%),linear-gradient(135deg,#0c0c0c,#111827)]" />
        <span className="relative flex items-center gap-1.5 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
          <FlaskConical size={12} strokeWidth={2.4} /> Beta
        </span>
        <div className="absolute bottom-0 left-0 right-0 flex h-2">
          <span className="flex-1 bg-[#3574fc]" />
          <span className="flex-1 bg-[#775bf4]" />
          <span className="flex-1 bg-[#111827]" />
        </div>
      </div>
      <div className="flex flex-col gap-1 p-4">
        <span className="text-[16px] font-semibold tracking-tight text-ink">Beta themes</span>
        <span className="text-[12.5px] leading-relaxed text-ink-muted">
          {count} experimental 1:1 ports. Click to explore.
        </span>
      </div>
    </button>
  );
}

export function BetaThemesModal({
  open,
  activeId,
  onActivate,
  onClose,
}: {
  open: boolean;
  activeId: string;
  onActivate: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[215] flex flex-col bg-canvas/95 backdrop-blur-md"
      role="dialog"
      aria-label="Beta themes"
    >
      <header
        data-tauri-drag-region
        className="flex shrink-0 items-center justify-between gap-4 border-b border-edge-soft bg-surface/40 px-10 py-5"
      >
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center gap-2 rounded-full border border-edge-soft bg-canvas/60 px-4 text-[13px] font-semibold text-ink-muted transition-all hover:-translate-x-0.5 hover:border-edge hover:text-ink"
          >
            <ArrowLeft size={15} strokeWidth={2.2} />
            Back
          </button>
          <div data-tauri-drag-region className="flex flex-col">
            <h1 className="pointer-events-none flex items-center gap-2 text-[24px] font-semibold tracking-tight text-ink">
              Beta themes
              <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
                Beta
              </span>
            </h1>
            <p className="pointer-events-none text-[13px] text-ink-subtle">
              Experimental 1:1 ports of other apps. Rough edges expected.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-10 py-10">
        <div className="mx-auto grid max-w-[900px] gap-5 sm:grid-cols-2">
          {BETA_THEMES.map((t) => (
            <BetaCard
              key={t.id}
              theme={t}
              active={activeId === t.id}
              onActivate={() => onActivate(t.id)}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BetaCard({
  theme,
  active,
  onActivate,
}: {
  theme: ThemePreset;
  active: boolean;
  onActivate: () => void;
}) {
  const hasImage = !!theme.previewImage;
  const bg =
    theme.background?.image ?? `linear-gradient(135deg, ${theme.swatch[0]}, ${theme.swatch[1]})`;
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border transition-all ${
        active
          ? "border-accent shadow-[0_0_0_2px_var(--color-accent-soft),0_18px_40px_-22px_rgba(0,0,0,0.35)]"
          : "border-edge-soft bg-surface hover:border-edge"
      }`}
    >
      <div
        className="relative h-48 w-full"
        style={
          hasImage
            ? {
                backgroundImage: `url(${theme.previewImage})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundColor: theme.swatch[0],
              }
            : { background: bg }
        }
      >
        {active && (
          <span className="absolute end-3 top-3 flex h-7 items-center gap-1.5 rounded-full bg-accent px-2.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-canvas">
            <Check size={11} strokeWidth={3} /> Active
          </span>
        )}
        <div className="absolute bottom-0 left-0 right-0 flex h-2">
          {theme.swatch.map((c, i) => (
            <span key={i} className="flex-1" style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[16px] font-semibold tracking-tight text-ink">{theme.name}</span>
          {theme.blurb && (
            <span className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">
              {theme.blurb}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onActivate}
          disabled={active}
          className={`h-10 rounded-xl text-[13px] font-semibold transition-opacity ${
            active
              ? "bg-elevated/70 text-ink ring-1 ring-edge"
              : "bg-ink text-canvas hover:opacity-90"
          }`}
        >
          {active ? "Active" : "Apply"}
        </button>
      </div>
    </div>
  );
}
