import { ArrowLeft, Check, FlaskConical, X } from "../../icons";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useEscape, useModalExit } from "@/components/modal-shell";
import { BETA_THEMES, type ThemePreset } from "@/lib/theme";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { useT } from "@/lib/i18n";
import { ROW_TITLE } from "../../shared";

const BADGE =
  "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

export function BetaThemesCard({ count, onClick }: { count: number; onClick: () => void }) {
  const t = useT();
  const preview = BETA_THEMES.slice(0, 8);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-md bg-surface text-start transition-colors hover:bg-elevated"
    >
      <div className="relative h-40 w-full overflow-hidden bg-canvas p-4">
        <div
          className="grid h-full w-full gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${preview.length <= 2 ? preview.length : preview.length <= 6 ? 2 : 4}, minmax(0, 1fr))`,
          }}
        >
          {preview.map((p) => (
            <span key={p.id} className="flex overflow-hidden rounded-[3px]">
              {p.swatch.map((c, i) => (
                <span key={i} className="flex-1" style={{ background: c }} />
              ))}
            </span>
          ))}
        </div>
        <span className={`absolute end-3 top-3 bg-surface text-ink-muted ${BADGE}`}>
          <FlaskConical size={14} strokeWidth={2.4} /> {t("Beta")}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-4">
        <span className={ROW_TITLE}>{t("Beta themes")}</span>
        <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
          {count === 1 ? t("1 experimental port") : t("{count} experimental ports", { count })}
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
  const t = useT();
  const { closing, close } = useModalExit(onClose, open);
  useEscape(close, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, close]);

  if (!open) return null;

  return createPortal(
    <div
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[250] flex flex-col bg-canvas/95 backdrop-blur-md`}
      role="dialog"
      aria-label={t("Beta themes")}
    >
      <header
        data-tauri-drag-region
        className="flex shrink-0 items-center justify-between gap-4 border-b border-edge-soft bg-surface px-10 py-5"
      >
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={close}
            className="flex h-11 items-center gap-2 rounded-full bg-canvas px-4 text-[15.5px] font-semibold text-ink-muted transition hover:bg-surface hover:text-ink"
          >
            <ArrowLeft size={18} strokeWidth={2.2} />
            {t("Back")}
          </button>
          <div data-tauri-drag-region className="flex flex-col">
            <h1 className="pointer-events-none flex items-center gap-2 text-[24px] font-semibold tracking-tight text-ink">
              {t("Beta themes")}
              <span className={`bg-accent-soft text-accent ${BADGE}`}>
                {t("Beta")}
              </span>
            </h1>
            <p className="pointer-events-none max-w-[70ch] text-[15.5px] leading-[22px] text-ink-subtle">
              {t("Experimental 1:1 ports of other apps. Rough edges expected.")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t("Close")}
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-10 py-10">
        <div className="mx-auto grid max-w-[900px] gap-5 sm:grid-cols-2">
          {BETA_THEMES.map((theme) => (
            <BetaCard
              key={theme.id}
              theme={theme}
              blurb={theme.blurb ? t(theme.blurb) : undefined}
              active={activeId === theme.id}
              onActivate={() => onActivate(theme.id)}
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
  blurb,
  active,
  onActivate,
}: {
  theme: ThemePreset;
  blurb?: string;
  active: boolean;
  onActivate: () => void;
}) {
  const t = useT();
  const hasImage = !!theme.previewImage;
  const bg =
    theme.background?.image ?? `linear-gradient(135deg, ${theme.swatch[0]}, ${theme.swatch[1]})`;
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-[4px] border transition ${
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
          <span className={`absolute end-3 top-3 bg-accent text-canvas ${BADGE}`}>
            <Check size={14} strokeWidth={3} /> {t("Active")}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 flex h-2">
          {theme.swatch.map((c, i) => (
            <span key={i} className="flex-1" style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={ROW_TITLE}>{theme.name}</span>
          {blurb && (
            <span className="line-clamp-2 max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
              {blurb}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onActivate}
          disabled={active}
          className={`h-11 rounded-sm text-[15.5px] font-semibold transition-opacity ${
            active ? "bg-elevated text-ink ring-1 ring-edge" : "bg-ink text-canvas hover:opacity-90"
          }`}
        >
          {active ? t("Active") : t("Apply")}
        </button>
      </div>
    </div>
  );
}
