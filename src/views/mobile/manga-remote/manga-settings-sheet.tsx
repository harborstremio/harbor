import { ArrowLeftRight, Check, Sun } from "lucide-react";
import { useMobileRemote } from "../mobile-remote";
import { useRegisterSheet } from "../mobile-sheet-lock";
import { SHEET_EXIT_CSS, useSheetDrag, useSheetPresence } from "../remote-extras";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { RemoteMangaState } from "@/lib/remote/protocol";

type Fit = RemoteMangaState["fit"];
type Bg = RemoteMangaState["bg"];

const FITS: Array<{ v: Fit; label: string }> = [
  { v: "width", label: "Fit width" },
  { v: "height", label: "Fit height" },
  { v: "original", label: "Original" },
];

const BGS: Array<{ v: Bg; label: string; color: string }> = [
  { v: "dark", label: "Dark", color: "#0b0b0d" },
  { v: "gray", label: "Dim", color: "#404040" },
  { v: "light", label: "Light", color: "#f5f5f5" },
];

export function MangaSettingsSheet({
  open,
  onClose,
  showPreview,
  onTogglePreview,
}: {
  open: boolean;
  onClose: () => void;
  showPreview: boolean;
  onTogglePreview: (v: boolean) => void;
}) {
  const { snapshot, sendCommand } = useMobileRemote();
  const manga = snapshot.manga;
  const reduce = useReducedMotion();
  const t = useT();
  const { render, leaving } = useSheetPresence(open);
  const { handleProps, panelStyle } = useSheetDrag(onClose);
  useRegisterSheet(open);

  if (!render || !manga) return null;

  return (
    <div
      className={`fixed inset-0 z-[70] flex flex-col justify-end bg-black/60 backdrop-blur-sm ${leaving ? "harbor-sheet-scrim-out" : reduce ? "" : "animate-fade-in"}`}
      onClick={onClose}
    >
      <style>{SHEET_EXIT_CSS}</style>
      <div
        className={`flex max-h-[78vh] flex-col overflow-y-auto rounded-t-2xl border-t border-edge-soft/60 bg-elevated ${leaving ? "harbor-sheet-panel-out" : reduce ? "" : "animate-in slide-in-from-bottom-4 duration-300"}`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)", ...panelStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        <div {...handleProps} className="shrink-0 cursor-grab touch-none active:cursor-grabbing">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-ink/20" />
          <div className="flex items-center gap-2 px-5 pb-3 pt-4">
            <Sun size={18} className="text-accent" />
            <h3 className="text-[16px] font-semibold text-ink">{t("Reader settings")}</h3>
          </div>
        </div>

        <div className="flex flex-col gap-5 px-4 pb-2">
          <section className="flex flex-col gap-2">
            <span className="px-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
              {t("Direction")}
            </span>
            <div className="flex gap-2">
              <OptionButton
                active={!manga.rtl}
                label={t("Left to right")}
                onPick={() => sendCommand({ action: "mangaSetRtl", rtl: false })}
              />
              <OptionButton
                active={manga.rtl}
                label={t("Right to left")}
                onPick={() => sendCommand({ action: "mangaSetRtl", rtl: true })}
              />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <span className="px-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
              {t("Fit")}
            </span>
            <div className="flex gap-2">
              {FITS.map(({ v, label }) => (
                <OptionButton
                  key={v}
                  active={manga.fit === v}
                  label={t(label)}
                  onPick={() => sendCommand({ action: "mangaSetFit", fit: v })}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <span className="px-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
              {t("Brightness")}
            </span>
            <div className="flex gap-2">
              {BGS.map(({ v, label, color }) => {
                const active = manga.bg === v;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-label={t(label)}
                    aria-pressed={active}
                    onClick={() => sendCommand({ action: "mangaSetBg", bg: v })}
                    className={`flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold transition-transform active:scale-[0.97] ${
                      active
                        ? "bg-accent text-canvas"
                        : "bg-surface text-ink-muted ring-1 ring-edge-soft/60"
                    }`}
                  >
                    <span
                      className="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/20"
                      style={{ background: color }}
                    />
                    {t(label)}
                    {active && <Check size={16} strokeWidth={2.8} />}
                  </button>
                );
              })}
            </div>
          </section>

          <p className="flex items-center gap-1.5 px-1 text-[12px] leading-snug text-ink-subtle">
            <ArrowLeftRight size={13} className="shrink-0" />
            {t("Changes apply to your computer instantly, and stay in sync both ways.")}
          </p>

          <section className="flex flex-col gap-2">
            <span className="px-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
              {t("Strip preview")}
            </span>
            <div className="flex gap-2">
              <OptionButton
                active={showPreview}
                label={t("Show pages")}
                onPick={() => onTogglePreview(true)}
              />
              <OptionButton
                active={!showPreview}
                label={t("Hide pages")}
                onPick={() => onTogglePreview(false)}
              />
            </div>
            <p className="px-1 text-[12px] leading-snug text-ink-subtle">
              {t("Hidden strips scroll numbered pages with the same sync.")}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function OptionButton({
  active,
  label,
  onPick,
}: {
  active: boolean;
  label: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      className={`flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl px-2 text-[14px] font-semibold transition-transform active:scale-[0.97] ${
        active ? "bg-accent text-canvas" : "bg-surface text-ink-muted ring-1 ring-edge-soft/60"
      }`}
    >
      {active && <Check size={16} strokeWidth={2.8} />}
      <span className="truncate">{label}</span>
    </button>
  );
}
