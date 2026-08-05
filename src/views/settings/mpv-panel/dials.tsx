import { RotateCcw } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "../shared";

export function useTweaks() {
  const { settings, update } = useSettings();
  const tweaks = settings.mpvTweaks ?? {};
  const setTweak = (key: string, value: string | null) => {
    const next = { ...tweaks };
    if (value === null) delete next[key];
    else next[key] = value;
    update({ mpvTweaks: next });
  };
  const applyPatch = (patch: Record<string, string | null>) => {
    const next = { ...tweaks };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete next[k];
      else next[k] = v;
    }
    update({ mpvTweaks: next });
  };
  const applyPreset = (resetKeys: string[], patch: Record<string, string | null>) => {
    const next = { ...tweaks };
    for (const k of resetKeys) delete next[k];
    for (const [k, v] of Object.entries(patch)) {
      if (v !== null) next[k] = v;
    }
    update({ mpvTweaks: next });
  };
  return { tweaks, setTweak, applyPatch, applyPreset };
}

export function TweakSlider({
  tweaks,
  setTweak,
  mpvKey,
  label,
  min,
  max,
  step,
  def,
  fmt,
  compact = false,
}: {
  tweaks: Record<string, string>;
  setTweak: (k: string, v: string | null) => void;
  mpvKey: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
  fmt?: (v: number) => string;
  compact?: boolean;
}) {
  const t = useT();
  const raw = tweaks[mpvKey];
  const value = raw != null && raw !== "" ? parseFloat(raw) : def;
  const active = raw != null && raw !== "" && parseFloat(raw) !== def;
  return (
    <div className={`flex items-center px-1 py-1.5 ${compact ? "gap-2.5" : "gap-4"}`}>
      <span className={`shrink-0 font-medium text-ink ${compact ? "w-[76px] text-[12.5px]" : "w-36 text-[13.5px]"}`}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          setTweak(mpvKey, v === def ? null : String(v));
        }}
        className="h-1 min-w-0 flex-1 appearance-none rounded-full bg-edge-soft accent-ink"
      />
      <span
        className={`shrink-0 text-end tabular-nums ${compact ? "w-10 text-[12px]" : "w-16 text-[13px]"} ${active ? "text-ink" : "text-ink-subtle"}`}
      >
        {fmt ? fmt(value) : value}
      </span>
      {active ? (
        <button
          onClick={() => setTweak(mpvKey, null)}
          className="shrink-0 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
        >
          {t("Reset")}
        </button>
      ) : (
        <span className={`shrink-0 ${compact ? "w-7" : "w-[34px]"}`} />
      )}
    </div>
  );
}

export const PICTURE_TEMPLATES: Array<{ label: string; sub: string; patch: Record<string, string | null> }> = [
  {
    label: "Brighten dark movies",
    sub: "Lifts shadows so the pitch-black scenes are actually watchable.",
    patch: { gamma: "12", brightness: "4" },
  },
  {
    label: "Punchier color",
    sub: "Richer, more vivid picture with a touch more contrast.",
    patch: { saturation: "15", contrast: "8" },
  },
  {
    label: "Easy on the eyes",
    sub: "Softer and dimmer, kinder for late-night watching.",
    patch: { brightness: "-4", gamma: "-6", saturation: "-5" },
  },
  {
    label: "Crisp (anime & cartoons)",
    sub: "Sharper lines and a little more pop.",
    patch: { sharpen: "0.6", saturation: "8" },
  },
];

export const PICTURE_KEYS = ["brightness", "contrast", "saturation", "gamma", "sharpen"];

export function PictureDialsSection() {
  const t = useT();
  const { tweaks, setTweak, applyPatch, applyPreset } = useTweaks();
  const anyActive = PICTURE_KEYS.some((k) => tweaks[k] != null && tweaks[k] !== "");
  return (
    <Section
      title={t("Picture adjustments")}
      subtitle={t("Nudge the image to taste. Start with a one-tap look below, then fine-tune with the dials. Everything resets cleanly, so you can't break anything.")}
    >
      <div className="flex flex-wrap gap-2">
        {PICTURE_TEMPLATES.map((tpl) => (
          <button
            key={tpl.label}
            type="button"
            title={t(tpl.sub)}
            onClick={() => applyPreset(PICTURE_KEYS, tpl.patch)}
            className="rounded-full border border-edge-soft bg-canvas/40 px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            {t(tpl.label)}
          </button>
        ))}
        {anyActive && (
          <button
            type="button"
            onClick={() => applyPatch(Object.fromEntries(PICTURE_KEYS.map((k) => [k, null])))}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-ink-subtle transition-colors hover:text-ink"
          >
            <RotateCcw size={12} strokeWidth={2.4} />
            {t("Reset picture")}
          </button>
        )}
      </div>

      <div className="mt-1 flex flex-col">
        <TweakSlider tweaks={tweaks} setTweak={setTweak} mpvKey="brightness" label={t("Brightness")} min={-50} max={50} step={1} def={0} />
        <TweakSlider tweaks={tweaks} setTweak={setTweak} mpvKey="contrast" label={t("Contrast")} min={-50} max={50} step={1} def={0} />
        <TweakSlider tweaks={tweaks} setTweak={setTweak} mpvKey="saturation" label={t("Saturation")} min={-50} max={50} step={1} def={0} />
        <TweakSlider tweaks={tweaks} setTweak={setTweak} mpvKey="gamma" label={t("Gamma (midtones)")} min={-50} max={50} step={1} def={0} />
        <TweakSlider tweaks={tweaks} setTweak={setTweak} mpvKey="sharpen" label={t("Sharpen")} min={0} max={2} step={0.05} def={0} fmt={(v) => v.toFixed(2)} />
      </div>
    </Section>
  );
}

const TONEMAP: Array<{ value: string; label: string }> = [
  { value: "", label: "Auto (recommended)" },
  { value: "bt.2390", label: "Reference (bt.2390)" },
  { value: "hable", label: "Filmic (Hable)" },
  { value: "mobius", label: "Balanced (Mobius)" },
  { value: "reinhard", label: "Soft (Reinhard)" },
  { value: "spline", label: "Modern (Spline)" },
];

export function ColorHdrSection() {
  const t = useT();
  const { tweaks, setTweak } = useTweaks();
  return (
    <Section
      title={t("Color & HDR")}
      subtitle={t("How Harbor squeezes HDR movies onto a normal screen. Auto is right for almost everyone; the curves below just change the look (punchy vs soft). Only matters on HDR sources.")}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {t("Tone-mapping curve")}
        </span>
        <Dropdown
          value={tweaks["tone-mapping"] ?? ""}
          onChange={(v) => setTweak("tone-mapping", v || null)}
          options={TONEMAP.map((o) => ({ value: o.value, label: t(o.label) }))}
          className="w-full max-w-[340px]"
        />
      </div>
      <ToggleRow
        label={t("Boost SDR video toward HDR")}
        sub={t("On an HDR display, stretches normal (non-HDR) movies to use the extra brightness range. Leave off on a regular screen; it can look washed out.")}
        value={tweaks["inverse-tone-mapping"] === "yes"}
        onChange={(on) => setTweak("inverse-tone-mapping", on ? "yes" : null)}
      />
    </Section>
  );
}
