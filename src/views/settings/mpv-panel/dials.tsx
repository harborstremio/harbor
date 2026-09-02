import { fillStyle } from "@/components/slider";
import { Contrast, RotateCcw, SlidersHorizontal, Sun, Wand2 } from "lucide-react";
import { useId } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { useSampleArtwork } from "@/lib/sample-artwork";
import { Section, ToggleRow } from "../shared";
import { SettingRow } from "../kit";

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
  const slider = (
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
      className="harbor-slider min-w-0 flex-1"
        style={fillStyle(value, min, max)}
      />
  );
  const readout = (
    <span
      className={`shrink-0 text-end tabular-nums ${compact ? "w-10 text-[12.5px]" : "w-11 text-[12.5px]"} ${active ? "text-ink" : "text-ink-subtle"}`}
    >
      {fmt ? fmt(value) : value}
    </span>
  );
  const reset = active ? (
    <button
      onClick={() => setTweak(mpvKey, null)}
      className={`shrink-0 text-[12.5px] font-semibold text-ink-subtle transition-colors hover:text-ink ${compact ? "" : "w-[46px] text-end"}`}
    >
      {t("Reset")}
    </button>
  ) : (
    <span className={`shrink-0 ${compact ? "w-7" : "w-[46px]"}`} />
  );
  if (compact) {
    return (
      <div className="flex items-center gap-2.5 px-1 py-1.5">
        <span className="w-[76px] shrink-0 text-[12.5px] font-medium text-ink">{label}</span>
        {slider}
        {readout}
        {reset}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3.5 py-[7px]">
      <span className="w-[118px] shrink-0 text-[12.5px] font-medium leading-tight text-ink">
        {label}
      </span>
      {slider}
      {readout}
      {reset}
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

function tweakNumber(tweaks: Record<string, string>, key: string): number {
  const raw = tweaks[key];
  if (raw == null || raw === "") return 0;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : 0;
}

function matchesLook(tweaks: Record<string, string>, patch: Record<string, string | null>): boolean {
  const set = PICTURE_KEYS.filter((k) => tweaks[k] != null && tweaks[k] !== "");
  const wanted = Object.keys(patch).filter((k) => patch[k] !== null);
  if (set.length !== wanted.length) return false;
  return wanted.every((k) => tweaks[k] === patch[k]);
}

function PicturePreview({ tweaks }: { tweaks: Record<string, string> }) {
  const t = useT();
  const art = useSampleArtwork();
  const rawId = useId();
  const filterId = `harbor-mpv-eq-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const brightness = tweakNumber(tweaks, "brightness");
  const contrast = tweakNumber(tweaks, "contrast");
  const saturation = tweakNumber(tweaks, "saturation");
  const gamma = tweakNumber(tweaks, "gamma");
  const sharpen = tweakNumber(tweaks, "sharpen");
  const exponent = Math.pow(2, -gamma / 50);
  const edge = sharpen * 0.4;
  const kernel = [0, -edge, 0, -edge, 1 + 4 * edge, -edge, 0, -edge, 0]
    .map((n) => n.toFixed(4))
    .join(" ");
  const usesSvg = gamma !== 0 || sharpen > 0;
  const filter = [
    `brightness(${(1 + brightness / 100).toFixed(3)})`,
    `contrast(${(1 + contrast / 100).toFixed(3)})`,
    `saturate(${(1 + saturation / 100).toFixed(3)})`,
    usesSvg ? `url(#${filterId})` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex w-[228px] shrink-0 flex-col gap-1.5">
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-canvas">
        <img
          src={art.background ?? art.poster}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
          style={{ filter }}
        />
      </div>
      <span className="text-[11.5px] font-medium text-ink-subtle">{t("Live preview")}</span>
      <svg aria-hidden className="pointer-events-none absolute h-0 w-0" focusable="false">
        <filter id={filterId} colorInterpolationFilters="sRGB">
          {sharpen > 0 && <feConvolveMatrix order="3" preserveAlpha="true" kernelMatrix={kernel} />}
          {gamma !== 0 && (
            <feComponentTransfer>
              <feFuncR type="gamma" exponent={exponent} />
              <feFuncG type="gamma" exponent={exponent} />
              <feFuncB type="gamma" exponent={exponent} />
            </feComponentTransfer>
          )}
        </filter>
      </svg>
    </div>
  );
}

export function PictureDialsSection() {
  const t = useT();
  const { tweaks, setTweak, applyPatch, applyPreset } = useTweaks();
  const anyActive = PICTURE_KEYS.some((k) => tweaks[k] != null && tweaks[k] !== "");
  const activeLook = PICTURE_TEMPLATES.find((tpl) => matchesLook(tweaks, tpl.patch));
  return (
    <Section
      title={t("Picture adjustments")}
      subtitle={t("Nudge the image to taste. Start with a one-tap look below, then fine-tune with the dials. Everything resets cleanly, so you can't break anything.")}
    >
      <SettingRow
        wide
        label={t("One-tap looks")}
        desc={t("A starting point for the dials. Hover one to see what it changes.")}
        icon={<Wand2 size={16} />}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {PICTURE_TEMPLATES.map((tpl) => {
            const on = activeLook?.label === tpl.label;
            return (
              <button
                key={tpl.label}
                type="button"
                title={t(tpl.sub)}
                onClick={() => applyPreset(PICTURE_KEYS, tpl.patch)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  on ? "bg-ink text-canvas" : "bg-canvas text-ink-muted hover:text-ink"
                }`}
              >
                {t(tpl.label)}
              </button>
            );
          })}
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
      </SettingRow>

      <SettingRow
        wide
        label={t("Fine tuning")}
        desc={t("Drag a dial and watch the still update. Each dial resets on its own.")}
        icon={<SlidersHorizontal size={16} />}
      >
        <div className="flex w-full flex-wrap items-start gap-5">
          <PicturePreview tweaks={tweaks} />
          <div className="flex min-w-[300px] flex-1 flex-col">
            <TweakSlider tweaks={tweaks} setTweak={setTweak} mpvKey="brightness" label={t("Brightness")} min={-50} max={50} step={1} def={0} />
            <TweakSlider tweaks={tweaks} setTweak={setTweak} mpvKey="contrast" label={t("Contrast")} min={-50} max={50} step={1} def={0} />
            <TweakSlider tweaks={tweaks} setTweak={setTweak} mpvKey="saturation" label={t("Saturation")} min={-50} max={50} step={1} def={0} />
            <TweakSlider tweaks={tweaks} setTweak={setTweak} mpvKey="gamma" label={t("Gamma (midtones)")} min={-50} max={50} step={1} def={0} />
            <TweakSlider tweaks={tweaks} setTweak={setTweak} mpvKey="sharpen" label={t("Sharpen")} min={0} max={2} step={0.05} def={0} fmt={(v) => v.toFixed(2)} />
          </div>
        </div>
      </SettingRow>
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

const TONE_PEAK = 2.5;

function mobiusAt(v: number, j: number): number {
  if (v <= j) return v;
  const a = (-j * j * (TONE_PEAK - 1)) / (j * j - 2 * j + TONE_PEAK);
  const b = (j * j - 2 * j * TONE_PEAK + TONE_PEAK) / Math.max(TONE_PEAK - 1, 1e-6);
  const scale = (b * b + 2 * b * j + j * j) / (b - a);
  return (scale * (v + a)) / (v + b);
}

function toneCurveY(kind: string, u: number): number {
  const v = u * TONE_PEAK;
  if (kind === "reinhard") return v / (v + 1) / (TONE_PEAK / (TONE_PEAK + 1));
  if (kind === "hable") {
    const f = (n: number) =>
      (n * (0.15 * n + 0.05) + 0.004) / (n * (0.15 * n + 0.5) + 0.06) - 0.02 / 0.3;
    return f(v) / f(TONE_PEAK);
  }
  if (kind === "mobius") return mobiusAt(v, 0.3);
  if (kind === "spline") return mobiusAt(v, 0.15);
  return mobiusAt(v, 0.5);
}

function ToneCurve({ kind, selected }: { kind: string; selected: boolean }) {
  const points = Array.from({ length: 33 }, (_, i) => {
    const u = i / 32;
    const y = Math.max(0, Math.min(1, toneCurveY(kind, u)));
    return `${(u * 100).toFixed(2)},${(100 - y * 100).toFixed(2)}`;
  }).join(" ");
  return (
    <span
      className={`block h-[34px] w-full overflow-hidden rounded-md ${
        selected ? "bg-canvas" : "bg-canvas"
      }`}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
        <polyline
          points="0,100 100,0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
          className={selected ? "text-canvas/40" : "text-ink-subtle/35"}
        />
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={selected ? "text-canvas" : "text-ink-muted"}
        />
      </svg>
    </span>
  );
}

export function ColorHdrSection() {
  const t = useT();
  const { tweaks, setTweak } = useTweaks();
  const current = tweaks["tone-mapping"] ?? "";
  return (
    <Section
      title={t("Color & HDR")}
      subtitle={t("How Harbor squeezes HDR movies onto a normal screen. Auto is right for almost everyone; the curves below just change the look (punchy vs soft). Only matters on HDR sources.")}
    >
      <SettingRow
        wide
        label={t("Tone-mapping curve")}
        desc={t("Each curve shows how much of the bright range it keeps before rolling off.")}
        tip={t("The dotted line is a flat squeeze of the whole range. A curve that stays high keeps midtones punchy and compresses the highlights late; a lower curve rolls off early and looks gentler.")}
        icon={<Contrast size={16} />}
      >
        <div className="grid w-full gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {TONEMAP.map((o) => {
            const selected = current === o.value;
            return (
              <button
                key={o.value || "auto"}
                type="button"
                onClick={() => setTweak("tone-mapping", o.value || null)}
                className={`flex flex-col items-stretch gap-2 rounded-md p-2.5 text-start transition-colors ${
                  selected ? "bg-ink text-canvas" : "bg-canvas text-ink-muted hover:text-ink"
                }`}
              >
                <ToneCurve kind={o.value} selected={selected} />
                <span className="text-[11.5px] font-semibold leading-tight">{t(o.label)}</span>
              </button>
            );
          })}
        </div>
      </SettingRow>
      <ToggleRow
        label={t("Boost SDR video toward HDR")}
        sub={t("On an HDR display, stretches normal (non-HDR) movies to use the extra brightness range. Leave off on a regular screen; it can look washed out.")}
        leading={<Sun size={16} className="text-ink-muted" />}
        value={tweaks["inverse-tone-mapping"] === "yes"}
        onChange={(on) => setTweak("inverse-tone-mapping", on ? "yes" : null)}
      />
    </Section>
  );
}
