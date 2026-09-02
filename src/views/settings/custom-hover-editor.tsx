import { fillStyle } from "@/components/slider";
import { useModalExit } from "@/components/modal-shell";
import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
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
      <div className="flex max-h-[86vh] w-[min(640px,100%)] overflow-hidden rounded-md bg-surface harbor-float">
        <div className="hidden w-[200px] shrink-0 flex-col items-center justify-center gap-3 bg-canvas p-5 sm:flex">
          <div className="w-[150px]">
            <div className={`group ${PREVIEW_SCOPE} relative aspect-[2/3] w-full rounded-md bg-elevated ${customHoverPosterProps(draft, true).className}`} style={customHoverPosterProps(draft, true).style}>
              {sample?.poster && (
                <img src={sample.poster} alt="" draggable={false} className="absolute inset-0 h-full w-full rounded-md object-cover" />
              )}
              {sample && <CustomHoverOverlay config={draft} meta={sample} onPlay={() => {}} preview />}
            </div>
          </div>
          <span className="text-[11.5px] text-ink-subtle">{t("Live preview")}</span>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5">
            <h2 className="min-w-0 text-[17px] font-semibold text-ink">{initial ? t("Edit hover style") : t("New hover style")}</h2>
            <button onClick={close} aria-label={t("Close")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink">
              <X size={16} />
            </button>
          </div>

          <div className="flex min-h-0 grow flex-col overflow-y-auto px-5 pt-4 [scrollbar-width:thin]">
            <input
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={t("Style name")}
              className="mb-4 h-10 w-full rounded-md bg-canvas px-3 text-[13.5px] text-ink outline-none placeholder:text-ink-subtle focus:ring-1 focus:ring-inset focus:ring-ink-subtle"
            />

            <div className="flex flex-col gap-3.5">
              <Slider label={t("Zoom")} value={draft.scale} min={100} max={122} suffix="%" onChange={(v) => set({ scale: v })} />
              <Slider label={t("Blur")} value={draft.blur} min={0} max={14} suffix="px" onChange={(v) => set({ blur: v })} />
              <Slider label={t("Dim")} value={draft.dim} min={0} max={70} suffix="%" onChange={(v) => set({ dim: v })} />
              <Toggle label={t("Accent glow")} value={draft.glow} onChange={(v) => set({ glow: v })} />
              <Segmented
                label={t("Overlay")}
                value={draft.overlay}
                options={[
                  { v: "none", label: t("None") },
                  { v: "gradient", label: t("Gradient") },
                  { v: "panel", label: t("Panel") },
                ]}
                onChange={(v) => set({ overlay: v as CustomHoverConfig["overlay"] })}
              />
              <Toggle label={t("Show title")} value={draft.showTitle} onChange={(v) => set({ showTitle: v })} />
              <Toggle label={t("Show rating")} value={draft.showMeta} onChange={(v) => set({ showMeta: v })} />
              <Toggle label={t("Show play button")} value={draft.showPlay} onChange={(v) => set({ showPlay: v })} />
            </div>

            <div className="mt-4 flex flex-col gap-1.5 pb-5">
              <span className="text-[13px] text-ink">{t("Custom CSS")}</span>
              <span className="text-[11.5px] leading-snug text-ink-subtle">
                {t("Advanced. Target .harbor-custom-hover for the poster, .group:hover for the hover state. Shows live in the preview.")}
              </span>
              <textarea
                value={draft.css}
                onChange={(e) => set({ css: e.target.value })}
                spellCheck={false}
                rows={5}
                placeholder={".group:hover .harbor-custom-hover img { transform: rotate(2deg) scale(1.08); }"}
                className="mt-1 w-full rounded-md bg-canvas p-2.5 font-mono text-[11.5px] leading-relaxed text-ink outline-none placeholder:text-ink-subtle focus:ring-1 focus:ring-inset focus:ring-ink-subtle [scrollbar-width:thin]"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 px-5 pb-5">
            {initial ? (
              <button
                onClick={() => {
                  deleteCustomHover(initial.id);
                  onDeleted();
                  close();
                }}
                className="flex h-9 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold text-danger transition-colors hover:bg-danger/25"
              >
                <Trash2 size={14} />
                {t("Delete")}
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button onClick={close} className="h-9 rounded-md bg-elevated px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink">
                {t("Cancel")}
              </button>
              <button onClick={save} className="h-9 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90">
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
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-[13px] text-ink">
        {label}
        <span className="font-mono text-[12.5px] tabular-nums text-ink-muted">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="harbor-slider w-full"
        style={fillStyle(value, min, max)}
      />
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex items-center justify-between text-start">
      <span className="text-[13px] text-ink">{label}</span>
      <span
        aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${value ? "bg-ink" : "bg-edge"}`}
      >
        <span
          className={`absolute start-[2px] top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform ${
            value ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ v: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-ink">{label}</span>
      <div className="flex items-center rounded-md bg-canvas p-0.5">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`rounded-md px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${
              value === o.v ? "bg-elevated text-ink" : "text-ink-subtle hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
