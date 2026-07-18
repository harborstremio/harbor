import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FileText, Film, X } from "lucide-react";
import { useT } from "@/lib/i18n";

export type ScanMode = "tmdb" | "nfo";

export function ScanModeModal({
  isOpen,
  nfoCount,
  onPick,
  onClose,
}: {
  isOpen: boolean;
  nfoCount: number;
  onPick: (mode: ScanMode) => void;
  onClose: () => void;
}) {
  const t = useT();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-[460px] flex-col gap-6 rounded-[24px] border border-edge-soft bg-elevated/95 px-8 py-8 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)] animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">
              {t("How should we import this folder?")}
            </h2>
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              {nfoCount > 0
                ? t("Found {n} .nfo file in this folder.", { n: nfoCount })
                : t("No .nfo files detected. TMDB matching is recommended.")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas/40 text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
            aria-label={t("Cancel")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <ModeButton
            icon={<Film size={18} strokeWidth={2} />}
            title={t("Match with TMDB")}
            sub={t("Identify every file by its name and pull fresh titles and artwork from TMDB.")}
            onClick={() => onPick("tmdb")}
          />
          <ModeButton
            icon={<FileText size={18} strokeWidth={2} />}
            title={t("Import from .nfo files")}
            sub={t(
              "Read titles, ids, and any poster/logo/backdrop already saved next to your files. Missing images are filled from TMDB.",
            )}
            disabled={nfoCount === 0}
            disabledHint={t("No .nfo files here")}
            onClick={() => onPick("nfo")}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ModeButton({
  icon,
  title,
  sub,
  onClick,
  disabled = false,
  disabledHint,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex items-start gap-3.5 rounded-2xl border border-edge-soft bg-canvas/40 px-4 py-3.5 text-start transition-colors hover:border-edge hover:bg-canvas/60 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-edge-soft disabled:hover:bg-canvas/40"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-elevated text-ink-muted ring-1 ring-edge-soft group-hover:text-ink">
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-ink">{title}</span>
        <span className="text-[12px] leading-snug text-ink-muted">
          {disabled && disabledHint ? disabledHint : sub}
        </span>
      </span>
    </button>
  );
}
