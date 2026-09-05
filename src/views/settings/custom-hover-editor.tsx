import { fillStyle } from "@/components/slider";
import { useModalExit } from "@/components/modal-shell";
import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { captureFocusReturn } from "@/lib/keyboard-navigation";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { topMovies, type Meta } from "@/lib/cinemeta";
import { CustomHoverOverlay, customHoverPosterProps } from "@/components/pick-card/custom-hover";
import {
  DEFAULT_CUSTOM,
  deleteCustomHover,
  listCustomHovers,
  newCustomHoverId,
  scopeHoverCss,
  upsertCustomHover,
  type CustomHoverConfig,
} from "@/lib/custom-hover";

const PREVIEW_SCOPE = "harbor-ch-editing";
const EDITOR_STYLE_ID = "harbor-ch-editor-css";
import { useT } from "@/lib/i18n";
import { Segmented as SharedSegmented, ToggleRow } from "./shared";
import { ROW_ACTION, ROW_ACTION_DANGER, ROW_ACTION_PRIMARY, SettingRow } from "./kit";

export function CustomHoverEditor({
  initial,
  onClose,
  onSaved,
  onDeleted,
}: {
  initial: CustomHoverConfig | null;
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const { closing, close } = useModalExit(onClose);
  const t = useT();
  const [draft, setDraft] = useState<CustomHoverConfig>(() =>
    initial ? { ...DEFAULT_CUSTOM, ...initial } : { id: "", name: "", ...DEFAULT_CUSTOM },
  );
  const [sample, setSample] = useState<Meta | null>(null);
  useEffect(() => {
    let alive = true;
    topMovies()
      .then((l) => alive && l[0] && setSample(l[0]))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => captureFocusReturn(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => isBackKey(e) && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    const css = (draft.css ?? "").trim();
    let el = document.getElementById(EDITOR_STYLE_ID) as HTMLStyleElement | null;
    if (!css) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement("style");
      el.id = EDITOR_STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = scopeHoverCss(css, PREVIEW_SCOPE);
    return () => {
      document.getElementById(EDITOR_STYLE_ID)?.remove();
    };
  }, [draft.css]);

  const set = (patch: Partial<CustomHoverConfig>) => setDraft((d) => ({ ...d, ...patch }));
  const save = () => {
    const name = draft.name.trim() || t("Custom style");
    const id = draft.id || newCustomHoverId(name, listCustomHovers().length);
    upsertCustomHover({ ...draft, id, name });
    onSaved(id);
    close();
  };

  return createPortal(
    <div
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[240] flex items-center justify-center p-4 animate-in fade-in duration-150`}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[86vh] w-[min(640px,100%)] overflow-hidden rounded-md bg-surface harbor-float"
      >
        <div className="hidden w-[200px] shrink-0 flex-col items-center justify-center gap-3 bg-canvas p-5 sm:flex">
          <div className="w-[150px]">
            <div className={`group ${PREVIEW_SCOPE} relative aspect-[2/3] w-full rounded-md bg-elevated ${customHoverPosterProps(draft, true).className}`} style={customHoverPosterProps(draft, true).style}>
              {sample?.poster && (
                <img src={sample.poster} alt="" draggable={false} className="absolute inset-0 h-full w-full rounded-md object-cover" />
              )}
              {sample && <CustomHoverOverlay config={draft} meta={sample} onPlay={() => {}} preview />}
            </div>
          </div>
          <span className="text-[15.5px] leading-[22px] text-ink-subtle">{t("Live preview")}</span>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5">
            <h2 className="min-w-0 text-[19px] font-semibold leading-[26px] tracking-tight text-ink">{initial ? t("Edit hover style") : t("New hover style")}</h2>
            <button onClick={close} aria-label={t("Close")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-ink-subtle transition-colors hover:bg-elevated hover:text-ink">
              <X size={18} />
            </button>
          </div>

          <div className="flex min-h-0 grow flex-col overflow-y-auto px-5 pt-4 [scrollbar-width:thin]">
            <input
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={t("Style name")}
              className="mb-4 h-11 w-full rounded-[8px] bg-canvas px-3 text-[16.5px] text-ink outline-none placeholder:text-ink-subtle focus:ring-1 focus:ring-inset focus:ring-ink-subtle"
            />

            <div className="harbor-settings-group">
              <Slider label={t("Zoom")} value={draft.scale} min={100} max={122} suffix="%" onChange={(v) => set({ scale: v })} />
              <Slider label={t("Blur")} value={draft.blur} min={0} max={14} suffix="px" onChange={(v) => set({ blur: v })} />
              <Slider label={t("Dim")} value={draft.dim} min={0} max={70} suffix="%" onChange={(v) => set({ dim: v })} />
              <ToggleRow label={t("Accent glow")} value={draft.glow} onChange={(v) => set({ glow: v })} />
              <SettingRow wide label={t("Overlay")}>
                <SharedSegmented
                  value={draft.overlay}
                  options={[
                    { value: "none", label: t("None") },
                    { value: "gradient", label: t("Gradient") },
                    { value: "panel", label: t("Panel") },
                  ]}
                  onChange={(v) => set({ overlay: v as CustomHoverConfig["overlay"] })}
                />
              </SettingRow>
              <ToggleRow label={t("Show title")} value={draft.showTitle} onChange={(v) => set({ showTitle: v })} />
              <ToggleRow label={t("Show rating")} value={draft.showMeta} onChange={(v) => set({ showMeta: v })} />
              <ToggleRow label={t("Show play button")} value={draft.showPlay} onChange={(v) => set({ showPlay: v })} />
              <SettingRow
                wide
                label={t("Custom CSS")}
                desc={t("Advanced. Target .harbor-custom-hover for the poster, .group:hover for the hover state. Shows live in the preview.")}
              >
                <textarea
                  value={draft.css}
                  onChange={(e) => set({ css: e.target.value })}
                  spellCheck={false}
                  rows={5}
                  placeholder={".group:hover .harbor-custom-hover img { transform: rotate(2deg) scale(1.08); }"}
                  className="w-full rounded-[8px] bg-canvas p-3 font-mono text-[15.5px] leading-[22px] text-ink outline-none placeholder:text-ink-subtle focus:ring-1 focus:ring-inset focus:ring-ink-subtle [scrollbar-width:thin]"
                />
              </SettingRow>
            </div>
            <div className="pb-5" />
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 px-5 pb-5">
            {initial ? (
              <button
                onClick={() => {
                  deleteCustomHover(initial.id);
                  onDeleted();
                  close();
                }}
                className={ROW_ACTION_DANGER}
              >
                <Trash2 size={18} strokeWidth={1.9} />
                {t("Delete")}
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button onClick={close} className={ROW_ACTION}>
                {t("Cancel")}
              </button>
              <button onClick={save} className={ROW_ACTION_PRIMARY}>
                {t("Save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Slider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <SettingRow wide label={label}>
      <span className="flex w-full min-w-0 items-center gap-4">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="harbor-slider min-w-0 flex-1"
          style={fillStyle(value, min, max)}
        />
        <span className="w-[64px] shrink-0 text-end font-mono text-[15.5px] tabular-nums text-ink-muted">
          {value}
          {suffix}
        </span>
      </span>
    </SettingRow>
  );
}
