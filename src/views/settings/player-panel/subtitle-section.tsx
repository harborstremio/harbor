import { fillStyle, SliderReset } from "@/components/slider";
import { DEFAULT } from "@/lib/settings/defaults";
import { Plus, RotateCcw, X } from "../icons";
import { useEffect, useRef, useState } from "react";
import subtitleStill from "@/assets/settings-preview/steamboat-willie.webp";
import { sfntFamilyName } from "@/lib/font-family-name";
import { saveFontData } from "@/lib/font-storage";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { advanceFocus, captureFocusReturn } from "@/lib/keyboard-navigation";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { ColorPopoverTrigger } from "../color-picker";
import { Segmented, ToggleRow } from "../shared";
import { ROW_ACTION, ROW_ACTION_DANGER, ROW_DESC, SettingGroup, SettingRow, SettingsWorkbench } from "../kit";
import { usePageActions } from "../page-actions";
import { ChoiceBlock } from "./choice";
import { previewFamily } from "./internals";

const SLIDER_WRAP = "flex h-11 w-full max-w-[520px] items-center gap-4";
const SLIDER_VALUE = "w-[64px] shrink-0 text-end text-[15.5px] tabular-nums text-ink-muted";

const PRESET_COLORS = [
  "#ffffff",
  "#000000",
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#5ac8fa",
  "#007aff",
  "#af52de",
  "#ff2d92",
];

function ColorField({
  value,
  fallback,
  onChange,
}: {
  value: string;
  fallback: string;
  onChange: (hex: string) => void;
}) {
  const t = useT();
  const current = (value || fallback).toUpperCase();
  const atDefault = current === fallback.toUpperCase();
  return (
    <div className="flex w-full flex-wrap items-center gap-2.5">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c.toUpperCase()}
          aria-pressed={current === c.toUpperCase()}
          className={`h-11 w-11 shrink-0 rounded-[10px] border-2 transition ${
            current === c.toUpperCase() ? "border-ink" : "border-edge-soft hover:border-edge"
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
      <ColorPopoverTrigger
        portal
        value={value || fallback}
        onChange={onChange}
        label={current}
        highlighted={!PRESET_COLORS.includes(current.toLowerCase())}
        direction="up"
      />
      <button
        type="button"
        onClick={atDefault ? undefined : () => onChange(fallback)}
        aria-disabled={atDefault}
        className={`${ROW_ACTION}${atDefault ? " pointer-events-none opacity-45" : ""}`}
      >
        {t("Reset")}
      </button>
    </div>
  );
}

export function SubtitleStylePanel() {
  const { settings, update } = useSettings();
  const t = useT();

  const styles: Array<{ id: "shadow" | "outline" | "box"; label: string; sub: string }> = [
    {
      id: "shadow",
      label: t("Drop shadow"),
      sub: t("Soft halo around the text. Cleanest on most content."),
    },
    {
      id: "outline",
      label: t("Outline"),
      sub: t("Hard stroke around each letter. High contrast."),
    },
    {
      id: "box",
      label: t("Black bar"),
      sub: t("Rounded background panel behind the text. Most readable."),
    },
  ];

  const assModes: Array<{ id: "no" | "scale" | "force"; label: string; sub: string }> = [
    {
      id: "no",
      label: t("Keep original"),
      sub: t(
        "Styled (ASS) subs keep their own font, color, and size. Truest to the release, but the size can vary a lot between files.",
      ),
    },
    {
      id: "scale",
      label: t("Resize only"),
      sub: t(
        "Keep the original look, scaled by your size. It multiplies the built-in size, so different releases can still differ.",
      ),
    },
    {
      id: "force",
      label: t("Use my style"),
      sub: t(
        "Force your size, font, and color onto styled subs so every file looks consistent. Best fix if embedded sizes keep changing, or for Arabic and subs showing boxes. Can affect karaoke and signs.",
      ),
    },
  ];

  const isDefault =
    settings.subStyle === "shadow" &&
    settings.subFontFamily === "inter" &&
    settings.subFontSize === 32 &&
    settings.subFontColor.toUpperCase() === "#FFFFFF" &&
    settings.subBorderColor.toUpperCase() === "#000000" &&
    settings.subBorderSize === 0 &&
    settings.subMarginY === 12 &&
    settings.subAlignX === "center" &&
    (settings.subBoxOpacity ?? 0.6) === 0.6 &&
    (settings.subBoxColor || "#000000").toUpperCase() === "#000000" &&
    (settings.subOpacity ?? 1) === 1 &&
    !settings.subBold;

  const resetDefaults = () => {
    if (isDefault) return;
    update({
      subStyle: "shadow",
      subFontFamily: "inter",
      subFontSize: 32,
      subFontColor: "#FFFFFF",
      subBorderColor: "#000000",
      subBorderSize: 0,
      subMarginY: 12,
      subAlignX: "center",
      subBoxOpacity: 0.6,
      subBoxColor: "#000000",
      subOpacity: 1,
      subBold: false,
    });
  };

  const opacityPct = Math.round((settings.subOpacity ?? 1) * 100);
  const boxOpacityPct = Math.round(settings.subBoxOpacity * 100);

  usePageActions(
    [
      {
        id: "subtitle-style-reset",
        label: "Reset subtitle style",
        tone: "danger",
        onSelect: resetDefaults,
        icon: <RotateCcw size={16} strokeWidth={2.4} />,
      },
    ],
    isDefault
      ? "Subtitle style is at the Harbor default."
      : "Puts every subtitle option back to the Harbor default.",
  );

  return (
    <SettingsWorkbench preview={<SubtitlePreview />}>
      <SettingGroup label={t("Background")}>
        {styles.map((s) => (
          <ChoiceBlock
            key={s.id}
            selected={settings.subStyle === s.id}
            onClick={() => update({ subStyle: s.id })}
            label={s.label}
            sub={s.sub}
          />
        ))}
        {settings.subStyle === "box" && (
          <SettingRow
            wide
            label={t("Background opacity")}
            desc={t("How solid the panel behind the text looks over the video.")}
          >
            <div className={SLIDER_WRAP}>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={settings.subBoxOpacity}
                onChange={(e) => update({ subBoxOpacity: parseFloat(e.target.value) })}
                aria-label={t("Background opacity")}
                className="harbor-slider h-11 min-w-0 flex-1"
                style={fillStyle(settings.subBoxOpacity, 0.2, 1, 0.05)}
              />
              <span className={SLIDER_VALUE}>{`${boxOpacityPct}%`}</span>
              <SliderReset show={settings.subBoxOpacity !== DEFAULT.subBoxOpacity} onReset={() => update({ subBoxOpacity: DEFAULT.subBoxOpacity })} />
            </div>
          </SettingRow>
        )}
        {settings.subStyle === "outline" && (
          <SettingRow
            wide
            label={t("Outline thickness")}
            desc={t("How heavy the stroke around each letter is.")}
          >
            <div className={SLIDER_WRAP}>
              <input
                type="range"
                min={1}
                max={6}
                step={0.5}
                value={Math.max(1, settings.subBorderSize)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) update({ subBorderSize: Math.min(6, Math.max(1, v)) });
                }}
                aria-label={t("Outline thickness")}
                className="harbor-slider h-11 min-w-0 flex-1"
                style={fillStyle(Math.max(1, settings.subBorderSize), 1, 6, 0.5)}
              />
              <span className={SLIDER_VALUE}>{`${Math.max(1, settings.subBorderSize)}px`}</span>
              <SliderReset show={settings.subBorderSize !== DEFAULT.subBorderSize} onReset={() => update({ subBorderSize: DEFAULT.subBorderSize })} />
            </div>
          </SettingRow>
        )}
        {settings.subStyle === "box" && (
          <SettingRow
            wide
            label={t("Box color")}
            desc={t("The color of the panel behind the text.")}
          >
            <ColorField
              value={settings.subBoxColor}
              fallback="#000000"
              onChange={(hex) => update({ subBoxColor: hex })}
            />
          </SettingRow>
        )}
      </SettingGroup>

      <SettingGroup label={t("Text")}>
        <SettingRow
          wide
          label={t("Size")}
          desc={t("How large subtitles are drawn on the video, at any window size.")}
        >
          <div className={SLIDER_WRAP}>
            <input
              type="range"
              min={16}
              max={120}
              step={1}
              value={settings.subFontSize}
              onChange={(e) => update({ subFontSize: parseInt(e.target.value, 10) })}
              aria-label={t("Size")}
              className="harbor-slider h-11 min-w-0 flex-1"
              style={fillStyle(settings.subFontSize, 16, 120)}
            />
            <span className={SLIDER_VALUE}>{`${settings.subFontSize}px`}</span>
              <SliderReset show={settings.subFontSize !== DEFAULT.subFontSize} onReset={() => update({ subFontSize: DEFAULT.subFontSize })} />
          </div>
        </SettingRow>

        <ToggleRow
          label={t("Bold text")}
          sub={t("Renders subtitles in a heavier weight. Turn off to use your font's normal weight.")}
          value={settings.subBold}
          onChange={(v) => update({ subBold: v })}
        />

        <SettingRow
          wide
          label={t("Opacity")}
          desc={t("Fade the text back if it sits too hard over bright scenes.")}
        >
          <div className={SLIDER_WRAP}>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={settings.subOpacity ?? 1}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) update({ subOpacity: Math.max(0.2, Math.min(1, v)) });
              }}
              aria-label={t("Opacity")}
              className="harbor-slider h-11 min-w-0 flex-1"
              style={fillStyle(settings.subOpacity ?? 1, 0.2, 1, 0.05)}
            />
            <span className={SLIDER_VALUE}>{`${opacityPct}%`}</span>
              <SliderReset show={(settings.subOpacity ?? 1) !== DEFAULT.subOpacity} onReset={() => update({ subOpacity: DEFAULT.subOpacity })} />
          </div>
        </SettingRow>

        <SettingRow
          wide
          label={t("Distance from bottom")}
          desc={t("Lift subtitles clear of a letterbox bar or a burned-in logo.")}
        >
          <div className={SLIDER_WRAP}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={settings.subMarginY}
              onChange={(e) => update({ subMarginY: parseInt(e.target.value, 10) })}
              aria-label={t("Distance from bottom")}
              className="harbor-slider h-11 min-w-0 flex-1"
              style={fillStyle(settings.subMarginY, 0, 100)}
            />
            <span className={SLIDER_VALUE}>{`${settings.subMarginY}%`}</span>
              <SliderReset show={settings.subMarginY !== DEFAULT.subMarginY} onReset={() => update({ subMarginY: DEFAULT.subMarginY })} />
          </div>
        </SettingRow>

        <SettingRow
          label={t("Alignment")}
          desc={t("Where a subtitle line sits across the width of the video.")}
        >
          <Segmented<"left" | "center" | "right">
            value={settings.subAlignX || "center"}
            options={[
              { value: "left", label: t("Left") },
              { value: "center", label: t("Center") },
              { value: "right", label: t("Right") },
            ]}
            onChange={(subAlignX) => update({ subAlignX })}
          />
        </SettingRow>

        <SettingRow
          wide
          label={t("Text color")}
          desc={t("The fill color of the subtitle letters themselves.")}
        >
          <ColorField
            value={settings.subFontColor}
            fallback="#FFFFFF"
            onChange={(hex) => update({ subFontColor: hex })}
          />
        </SettingRow>

        <SettingRow
          wide
          label={t("Outline color")}
          desc={t("The stroke or halo drawn behind the letters.")}
        >
          <ColorField
            value={settings.subBorderColor}
            fallback="#000000"
            onChange={(hex) => update({ subBorderColor: hex })}
          />
        </SettingRow>
      </SettingGroup>

      <FontPicker />

      <SettingGroup label={t("Styled (ASS) subtitles")}>
        {assModes.map((m) => (
          <ChoiceBlock
            key={m.id}
            selected={settings.subAssOverride === m.id}
            onClick={() => update({ subAssOverride: m.id })}
            label={m.label}
            sub={m.sub}
          />
        ))}
        <p className={`max-w-[70ch] ${ROW_DESC}`}>
          {t(
            "Embedded subtitles changing size between titles, or showing empty boxes? Switch to Use my style for a consistent size. For boxes, also choose Arabic under Font.",
          )}
        </p>
        {(settings.subAssOverride === "no" || settings.subAssOverride === "scale") && (
          <ToggleRow
            label={t("Normalize embedded subtitle size")}
            sub={t(
              "Auto-adjusts styled (ASS) subtitles so dialogue stays the same size across files, while keeping their colors, fonts, and sign placement.",
            )}
            value={settings.subAssNormalizeSize}
            onChange={(v) => update({ subAssNormalizeSize: v })}
          />
        )}
      </SettingGroup>

      <SettingGroup label={t("Sound descriptions")}>
        <ToggleRow
          label={t("Hide sound effects and speaker names")}
          sub={t(
            "Removes bracketed descriptions like [door creaks] and speaker labels like JOHN: while subtitles play, so a release that only ships an SDH track still reads as plain dialogue. It also removes other bracketed text, so an occasional on-screen sign or lyric may go with it. Skipped on forced tracks, picture-based tracks, and any language that does not use the Latin alphabet.",
          )}
          value={settings.subHideSdh}
          onChange={(v) => update({ subHideSdh: v })}
        />
      </SettingGroup>

      <SettingGroup label={t("Elsewhere")}>
        <ToggleRow
          label={t("Show subtitles in Picture-in-Picture")}
          sub={t(
            "Keeps subtitles visible when the player shrinks into the small floating window. Turn off to hide them there.",
          )}
          value={settings.subShowInPip}
          onChange={(v) => update({ subShowInPip: v })}
        />
      </SettingGroup>
    </SettingsWorkbench>
  );
}

function SubtitlePreview() {
  const t = useT();
  const { settings } = useSettings();
  const fontSize = Math.max(16, Math.min(120, settings.subFontSize));
  const previewSize = Math.round(fontSize * 0.55);
  const family = previewFamily(settings.subFontFamily);

  let textShadow: string | undefined;
  if (settings.subStyle === "outline") {
    const sz = Math.max(1, settings.subBorderSize) || 2;
    const c = settings.subBorderColor || "#000000";
    const offsets: [number, number][] = [];
    for (let dx = -sz; dx <= sz; dx++) {
      for (let dy = -sz; dy <= sz; dy++) {
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > sz + 0.1 || r < 0.1) continue;
        offsets.push([dx, dy]);
      }
    }
    textShadow = offsets.map(([dx, dy]) => `${dx * 0.55}px ${dy * 0.55}px 0 ${c}`).join(", ");
  } else if (settings.subStyle === "shadow") {
    textShadow =
      "0 1px 2px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,0.85), 0 0 18px rgba(0,0,0,0.55)";
  }

  const boxRgb = (() => {
    const m = (settings.subBoxColor || "#000000").replace(/^#/, "");
    if (m.length !== 6) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(m.slice(0, 2), 16) || 0,
      g: parseInt(m.slice(2, 4), 16) || 0,
      b: parseInt(m.slice(4, 6), 16) || 0,
    };
  })();
  const boxStyle: React.CSSProperties | undefined =
    settings.subStyle === "box"
      ? {
          backgroundColor: `rgba(${boxRgb.r}, ${boxRgb.g}, ${boxRgb.b}, ${settings.subBoxOpacity})`,
          padding: `${Math.round(previewSize * 0.18)}px ${Math.round(previewSize * 0.5)}px`,
          borderRadius: `${Math.round(previewSize * 0.25)}px`,
        }
      : undefined;

  const align = settings.subAlignX || "center";
  const justify =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";

  return (
    <div
      className="relative h-56 overflow-hidden rounded-[10px] bg-cover bg-center"
      style={{ backgroundImage: `url(${subtitleStill})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-canvas/60 via-transparent to-transparent" />
      <div
        className={`absolute inset-x-0 flex ${justify} px-[6%]`}
        style={{ bottom: `${settings.subMarginY}%`, opacity: settings.subOpacity }}
      >
        <div style={boxStyle}>
          <div
            style={{
              color: settings.subFontColor,
              fontFamily: family,
              fontWeight: settings.subBold ? 700 : 400,
              fontSize: `${previewSize}px`,
              lineHeight: 1.2,
              letterSpacing: "-0.005em",
              textShadow,
              textAlign: align as "left" | "center" | "right",
            }}
          >
            {t("This is how your subtitles will look.")}
          </div>
        </div>
      </div>
    </div>
  );
}

const PRESET_FONTS: Array<{
  id: "inter" | "system" | "rounded" | "serif" | "arabic";
  label: string;
}> = [
  { id: "inter", label: "Inter" },
  { id: "system", label: "System" },
  { id: "rounded", label: "Rounded" },
  { id: "serif", label: "Serif" },
  { id: "arabic", label: "Arabic" },
];

const FONT_ACCEPT =
  ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2,application/x-font-ttf,application/x-font-otf,application/font-woff,application/font-woff2";
const MAX_FONT_BYTES = 4 * 1024 * 1024;
type FontImportError =
  | { kind: "too-large"; sizeMb: string }
  | { kind: "unsupported"; extension: string }
  | { kind: "save-failed" };

function FontPicker() {
  const { settings, update } = useSettings();
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<FontImportError | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const customFonts = settings.customFonts ?? [];
  const errorMessage =
    error?.kind === "too-large"
      ? t("That font is {size} MB. Max is 4 MB.", { size: error.sizeMb })
      : error?.kind === "unsupported"
        ? t('Unsupported font type ".{extension}". Use TTF, OTF, WOFF, or WOFF2.', {
            extension: error.extension,
          })
        : error?.kind === "save-failed"
          ? t("Couldn't save that font. It may be invalid, or storage is full.")
          : null;

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const onFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_FONT_BYTES) {
      setError({ kind: "too-large", sizeMb: (file.size / (1024 * 1024)).toFixed(1) });
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const formatMap: Record<string, string> = {
      ttf: "truetype",
      otf: "opentype",
      woff: "woff",
      woff2: "woff2",
    };
    if (!formatMap[ext]) {
      setError({ kind: "unsupported", extension: ext });
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () =>
          typeof r.result === "string" ? resolve(r.result) : reject(new Error("read failed"));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const bytes = await file.arrayBuffer();
      const family = sfntFamilyName(bytes) ?? undefined;
      const face = new FontFace(`harbor-font-${id}`, bytes, { display: "swap" });
      await face.load();
      await saveFontData(id, dataUrl);
      document.fonts.add(face);
      const baseName = file.name.replace(/\.(ttf|otf|woff2?|ttc)$/i, "");
      const next = [
        ...customFonts,
        {
          id,
          name: baseName || `Custom ${customFonts.length + 1}`,
          family,
          format: formatMap[ext],
        },
      ];
      update({ customFonts: next, subFontFamily: `custom:${id}` });
    } catch (e) {
      console.warn("[fonts] read failed", e);
      setError({ kind: "save-failed" });
    }
  };

  const remove = (id: string) => {
    const next = customFonts.filter((f) => f.id !== id);
    const family = `custom:${id}`;
    const patch: Partial<{ customFonts: typeof customFonts; subFontFamily: string }> = {
      customFonts: next,
    };
    if (settings.subFontFamily === family) patch.subFontFamily = "inter";
    update(patch);
    setConfirmId(null);
    if (uploadRef.current) advanceFocus(uploadRef.current);
  };

  const allFonts = [
    ...PRESET_FONTS.map((f) => ({ id: f.id as string, label: f.label, custom: false })),
    ...customFonts.map((f) => ({ id: `custom:${f.id}`, label: f.name, custom: true })),
  ];

  const confirmFont = customFonts.find((f) => `custom:${f.id}` === `custom:${confirmId}`);

  const [unloaded, setUnloaded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document)) return;
    let cancelled = false;
    const check = () => {
      const missing = new Set<string>();
      for (const f of customFonts) {
        let ok = false;
        document.fonts.forEach((face) => {
          if (face.family === `harbor-font-${f.id}` && face.status === "loaded") ok = true;
        });
        if (!ok) missing.add(f.id);
      }
      if (!cancelled) setUnloaded(missing);
    };
    check();
    void document.fonts.ready.then(check);
    const timer = window.setTimeout(check, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customFonts]);

  return (
    <SettingGroup label={t("Font")}>
      <p className={`max-w-[70ch] ${ROW_DESC}`}>
        {t(
          "The typeface subtitles are drawn in. Add your own TTF, OTF or WOFF file if none of these suit.",
        )}
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2.5">
        {allFonts.map((f) => {
          const sel = settings.subFontFamily === f.id;
          const broken = f.custom && unloaded.has(f.id.slice("custom:".length));
          return (
            <div key={f.id} className="flex min-w-0 items-stretch gap-1.5">
              <button
                type="button"
                aria-pressed={sel}
                onClick={() => update({ subFontFamily: f.id })}
                title={
                  broken ? t("This font did not load. Remove it and upload it again.") : undefined
                }
                className={`flex h-14 min-w-0 flex-1 items-center justify-center rounded-[10px] border px-3 text-[16.5px] font-semibold transition-colors ${
                  broken
                    ? "border-danger bg-elevated text-danger"
                    : sel
                      ? "border-accent bg-elevated text-ink"
                      : "border-edge-soft bg-elevated text-ink-muted hover:border-edge hover:text-ink"
                }`}
                style={{ fontFamily: previewFamily(f.id) }}
              >
                <span className="min-w-0 break-words">{f.custom ? f.label : t(f.label)}</span>
              </button>
              {f.custom && (
                <button
                  type="button"
                  onClick={() => setConfirmId(f.id.slice("custom:".length))}
                  aria-label={t("Remove {name}", { name: f.label })}
                  className="flex h-14 w-11 shrink-0 items-center justify-center rounded-[10px] border border-edge-soft bg-elevated text-ink-muted transition-colors hover:border-danger/40 hover:text-danger"
                >
                  <X size={15} strokeWidth={2.6} />
                </button>
              )}
            </div>
          );
        })}
        <button
          ref={uploadRef}
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-14 items-center justify-center gap-2 rounded-[10px] border border-dashed border-edge bg-canvas text-[15.5px] font-semibold text-ink-muted transition-colors hover:border-ink hover:bg-elevated hover:text-ink"
        >
          <Plus size={16} strokeWidth={2.4} />
          {t("Upload font")}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={FONT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
      {errorMessage && (
        <p className="max-w-[66ch] rounded-[10px] bg-elevated px-4 py-3 text-[15.5px] leading-[22px] text-danger">
          {errorMessage}
        </p>
      )}
      {confirmFont && (
        <ConfirmDeleteFont
          name={confirmFont.name}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => remove(confirmFont.id)}
        />
      )}
    </SettingGroup>
  );
}

function ConfirmDeleteFont({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const { closing, close } = useModalExit(onCancel);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const restore = captureFocusReturn();
    if (cancelRef.current) advanceFocus(cancelRef.current);
    return restore;
  }, []);

  return (
    <ModalShell closing={closing} onDismiss={close}>
      <div className="flex items-start gap-4 px-6 pt-6">
        <p className="min-w-0 flex-1 text-[19px] font-semibold leading-[26px] tracking-tight text-ink">
          {t("Delete this font?")}
        </p>
        <button
          type="button"
          onClick={close}
          aria-label={t("Cancel")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-6">
        <p className={`max-w-[66ch] ${ROW_DESC}`}>
          <span className="font-semibold text-ink">{name}</span>{" "}
          {t("will be removed from Harbor. Anything you've set to use it will fall back to Inter.")}
        </p>
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 pb-6">
        <button
          ref={cancelRef}
          data-tv-initial-focus
          type="button"
          onClick={close}
          className={ROW_ACTION}
        >
          {t("Cancel")}
        </button>
        <button type="button" onClick={onConfirm} className={ROW_ACTION_DANGER}>
          {t("Delete")}
        </button>
      </div>
    </ModalShell>
  );
}
