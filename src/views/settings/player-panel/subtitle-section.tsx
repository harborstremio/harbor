import { fillStyle } from "@/components/slider";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import godfatherStill from "@/assets/godfather-offer.svg";
import { sfntFamilyName } from "@/lib/font-family-name";
import { saveFontData } from "@/lib/font-storage";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { ColorPopoverTrigger } from "../color-picker";
import { ToggleRow } from "../shared";
import { Label, SubField, previewFamily } from "./internals";

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

  const aligns: Array<{ id: "left" | "center" | "right"; label: string }> = [
    { id: "left", label: t("Left") },
    { id: "center", label: t("Center") },
    { id: "right", label: t("Right") },
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

  return (
    <div className="flex flex-col gap-5">
      <SubtitlePreview />

      <div className="flex flex-col gap-2.5">
        <Label>{t("Background")}</Label>
        <div className="grid grid-cols-3 gap-2">
          {styles.map((s) => {
            const sel = settings.subStyle === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => update({ subStyle: s.id })}
                className={`flex flex-col items-start gap-0.5 rounded-md border px-3.5 py-2.5 text-start transition-colors ${
                  sel ? "border-ink bg-elevated" : "border-edge-soft bg-canvas hover:border-edge"
                }`}
              >
                <span className="text-[13px] font-semibold text-ink">{s.label}</span>
                <span className="text-[11.5px] leading-snug text-ink-muted">{s.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Label>{t("Styled (ASS) subtitles")}</Label>
        <div className="grid grid-cols-3 gap-2">
          {assModes.map((m) => {
            const sel = settings.subAssOverride === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => update({ subAssOverride: m.id })}
                className={`flex flex-col items-start gap-0.5 rounded-md border px-3.5 py-2.5 text-start transition-colors ${
                  sel ? "border-ink bg-elevated" : "border-edge-soft bg-canvas hover:border-edge"
                }`}
              >
                <span className="text-[13px] font-semibold text-ink">{m.label}</span>
                <span className="text-[11.5px] leading-snug text-ink-muted">{m.sub}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11.5px] leading-snug text-ink-muted">
          {t(
            "Embedded subtitles changing size between titles, or showing empty boxes? Switch to Use my style for a consistent size. For boxes, also choose Arabic under Font.",
          )}
        </p>
      </div>

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

      {settings.subStyle === "box" && (
        <SubField
          label={t("Background opacity")}
          value={`${Math.round(settings.subBoxOpacity * 100)}%`}
        >
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={settings.subBoxOpacity}
            onChange={(e) => update({ subBoxOpacity: parseFloat(e.target.value) })}
            className="harbor-slider w-full"
            style={fillStyle(settings.subBoxOpacity, 0.2, 1)}
          />
        </SubField>
      )}

      {settings.subStyle === "outline" && (
        <SubField label={t("Outline thickness")} value={`${settings.subBorderSize}px`}>
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
            className="harbor-slider w-full"
            style={fillStyle(Math.max(1, settings.subBorderSize), 1, 6)}
          />
        </SubField>
      )}

      <FontPicker />

      <ToggleRow
        label={t("Bold text")}
        sub={t("Render subtitles in a heavier weight. Turn off to use your font's normal weight.")}
        value={settings.subBold}
        onChange={(v) => update({ subBold: v })}
      />

      <ToggleRow
        label={t("Show subtitles in Picture-in-Picture")}
        sub={t("Hide subtitles when the player shrinks into the floating PiP window.")}
        value={settings.subShowInPip}
        onChange={(v) => update({ subShowInPip: v })}
      />

      <SubField label={t("Size")} value={`${settings.subFontSize}px`}>
        <input
          type="range"
          min={16}
          max={120}
          step={1}
          value={settings.subFontSize}
          onChange={(e) => update({ subFontSize: parseInt(e.target.value, 10) })}
          className="harbor-slider w-full"
          style={fillStyle(settings.subFontSize, 16, 120)}
        />
      </SubField>

      <SubField label={t("Opacity")} value={`${Math.round((settings.subOpacity ?? 1) * 100)}%`}>
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
          className="harbor-slider w-full"
          style={fillStyle(settings.subOpacity ?? 1, 0.2, 1)}
        />
      </SubField>

      <SubField label={t("Distance from bottom")} value={`${settings.subMarginY}%`}>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={settings.subMarginY}
          onChange={(e) => update({ subMarginY: parseInt(e.target.value, 10) })}
          className="harbor-slider w-full"
          style={fillStyle(settings.subMarginY, 0, 100)}
        />
      </SubField>

      <div className="flex flex-col gap-2.5">
        <Label>{t("Alignment")}</Label>
        <div className="grid grid-cols-3 gap-2">
          {aligns.map((a) => {
            const sel = settings.subAlignX === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => update({ subAlignX: a.id })}
                className={`flex h-10 items-center justify-center rounded-md border text-[12.5px] font-semibold transition-colors ${
                  sel
                    ? "border-ink bg-elevated text-ink"
                    : "border-edge-soft bg-canvas text-ink-muted hover:border-edge hover:text-ink"
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        <div className="flex flex-col gap-2.5">
          <Label>{t("Text color")}</Label>
          <div className="flex items-center gap-3">
            <ColorPopoverTrigger
              value={settings.subFontColor}
              onChange={(hex) => update({ subFontColor: hex })}
              label={settings.subFontColor.toUpperCase()}
              highlighted
              direction="up"
            />
            {settings.subFontColor.toUpperCase() !== "#FFFFFF" && (
              <button
                type="button"
                onClick={() => update({ subFontColor: "#FFFFFF" })}
                className="ms-auto rounded-md px-2 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
              >
                {t("Reset")}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <Label>{t("Outline color")}</Label>
          <div className="flex items-center gap-3">
            <ColorPopoverTrigger
              value={settings.subBorderColor}
              onChange={(hex) => update({ subBorderColor: hex })}
              label={settings.subBorderColor.toUpperCase()}
              highlighted
              direction="up"
            />
            {settings.subBorderColor.toUpperCase() !== "#000000" && (
              <button
                type="button"
                onClick={() => update({ subBorderColor: "#000000" })}
                className="ms-auto rounded-md px-2 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
              >
                {t("Reset")}
              </button>
            )}
          </div>
        </div>
      </div>

      {settings.subStyle === "box" && (
        <div className="flex flex-col gap-2.5">
          <Label>{t("Box color")}</Label>
          <div className="flex items-center gap-3">
            <ColorPopoverTrigger
              value={settings.subBoxColor || "#000000"}
              onChange={(hex) => update({ subBoxColor: hex })}
              label={(settings.subBoxColor || "#000000").toUpperCase()}
              highlighted
              direction="up"
            />
            {(settings.subBoxColor || "#000000").toUpperCase() !== "#000000" && (
              <button
                type="button"
                onClick={() => update({ subBoxColor: "#000000" })}
                className="ms-auto rounded-md px-2 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
              >
                {t("Reset")}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end border-t border-edge-soft pt-4">
        <button
          type="button"
          onClick={resetDefaults}
          disabled={isDefault}
          className="flex h-9 items-center gap-2 rounded-full bg-canvas px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-canvas disabled:hover:text-ink-muted"
        >
          {t("Reset to defaults")}
        </button>
      </div>
    </div>
  );
}

function SubtitlePreview() {
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
      className="relative h-56 overflow-hidden rounded-md bg-cover bg-center"
      style={{ backgroundImage: `url(${godfatherStill})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
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
            I&apos;m gonna make him an offer he can&apos;t refuse.
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
    const t = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(t);
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
    const t = window.setTimeout(check, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [customFonts]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <Label>{t("Font")}</Label>
        {customFonts.length > 0 && (
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-ink-subtle">
            {t("{n} custom", { n: customFonts.length })}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {allFonts.map((f) => {
          const sel = settings.subFontFamily === f.id;
          const broken = f.custom && unloaded.has(f.id.slice("custom:".length));
          return (
            <div key={f.id} className="relative">
              <button
                type="button"
                onClick={() => update({ subFontFamily: f.id })}
                title={
                  broken ? t("This font did not load. Remove it and upload it again.") : undefined
                }
                className={`flex h-11 w-full items-center justify-center rounded-md border px-2 text-[13px] font-semibold transition-colors ${
                  broken
                    ? "border-danger/40 bg-danger/10 text-danger"
                    : sel
                      ? "border-ink bg-elevated text-ink"
                      : "border-edge-soft bg-canvas text-ink-muted hover:border-edge hover:text-ink"
                }`}
                style={{ fontFamily: previewFamily(f.id) }}
              >
                <span className="truncate">{f.custom ? f.label : t(f.label)}</span>
              </button>
              {f.custom && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmId(f.id.slice("custom:".length));
                  }}
                  aria-label={t("Remove {name}", { name: f.label })}
                  className="absolute -end-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-canvas text-ink-muted ring-1 ring-edge transition-colors hover:bg-danger hover:text-white"
                >
                  <X size={12} strokeWidth={2.6} />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-11 items-center justify-center gap-1.5 rounded-md border border-dashed border-edge bg-canvas text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-ink hover:bg-elevated hover:text-ink"
        >
          <Plus size={14} strokeWidth={2.4} />
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
        <p className="rounded-md bg-danger/15 px-2.5 py-2 text-[11.5px] leading-snug text-danger ring-1 ring-danger">
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
    </div>
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

  return (
    <ModalShell closing={closing} onDismiss={close}>
      <div className="flex items-start gap-4 px-6 pt-6">
        <p className="min-w-0 flex-1 text-[17px] font-semibold tracking-tight text-ink">
          {t("Delete this font?")}
        </p>
        <button
          type="button"
          onClick={close}
          aria-label={t("Cancel")}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-6">
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink">{name}</span>{" "}
          {t("will be removed from Harbor. Anything you've set to use it will fall back to Inter.")}
        </p>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 pb-6">
        <button
          type="button"
          onClick={close}
          className="harbor-press-pop h-9 rounded-md bg-elevated px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          {t("Cancel")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="harbor-press-pop h-9 rounded-md bg-danger px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          {t("Delete")}
        </button>
      </div>
    </ModalShell>
  );
}
