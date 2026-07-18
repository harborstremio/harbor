import { RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import seekPreviewBg from "@/assets/preview/seek-preview.png";
import { SeekBarVisual } from "@/components/player/transport/seek-bar-visual";
import { useSettings, type Settings } from "@/lib/settings";
import { ColorPopoverTrigger } from "../color-picker";
import { SubField } from "./internals";
import { ToggleRow } from "../shared";
import { SeekImageUpload, openSeekImageDialog } from "./seek-image-upload";
import { useT } from "@/lib/i18n";

const STYLES: Array<{
  id: "flat" | "glass" | "pinstripe" | "rainbow";
  label: string;
  sub: string;
}> = [
  { id: "flat", label: "Flat_Style", sub: "Solid fill, no texture. Cleanest baseline." },
  { id: "glass", label: "Glass", sub: "Subtle Apple-like sheen on the filled portion." },
  { id: "pinstripe", label: "Pinstripe", sub: "Diagonal stripes across the fill, retro vibe." },
  { id: "rainbow", label: "Rainbow", sub: "Six horizontal stripes. Pairs with nyan cat dot." },
];

const SHAPES: Array<{ id: "circle" | "square" | "image" | "hidden"; label: string; sub: string }> =
  [
    { id: "circle", label: "Circle", sub: "The default round dot." },
    { id: "square", label: "Square", sub: "Rounded square in the same color." },
    { id: "image", label: "Custom image", sub: "PNG, GIF, WebP, or SVG. Animated GIFs play." },
    { id: "hidden", label: "Hidden", sub: "No dot, just the bar." },
  ];

const PRESET_COLORS = [
  "",
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#5ac8fa",
  "#007aff",
  "#af52de",
  "#ff2d92",
  "#ffffff",
];

export function SeekBarPanel() {
  const t = useT();
  const { settings, update } = useSettings();

  const heightVal = settings.seekBarHeight ?? 6;
  const dotVal = settings.seekDotSize ?? 16;
  const currentStyle = settings.seekBarStyle ?? "flat";
  const currentShape = settings.seekDotShape ?? "circle";
  const accent = (settings.seekBarColor || "").trim();

  return (
    <div className="flex flex-col gap-7">
      <ToggleRow
        label={t("Show thumbnail preview on hover")}
        sub={t(
          "Generates a frame on the fly as you scrub the seek bar. Works on debrid streams and local files.",
        )}
        value={settings.seekPreviewEnabled}
        onChange={(v) => update({ seekPreviewEnabled: v })}
      />
      <Preview settings={settings} />

      <SubField label={t("Bar style")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STYLES.map((s) => (
            <PickTile
              key={s.id}
              selected={currentStyle === s.id}
              onClick={() => update({ seekBarStyle: s.id })}
              label={t(s.label)}
              sub={t(s.sub)}
            />
          ))}
        </div>
        {currentStyle === "image" && (
          <p className="mt-1 text-[11px] text-ink-subtle">
            {t("Image bar active. Pick a style above to switch back, or clear the image below.")}
          </p>
        )}
      </SubField>

      <SubField label={t("Bar height")} value={`${heightVal}px`}>
        <input
          type="range"
          min={3}
          max={14}
          step={1}
          value={heightVal}
          onChange={(e) => update({ seekBarHeight: Number(e.target.value) })}
          className="w-full accent-ink"
        />
      </SubField>

      <SubField label={t("Bar color")}>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_COLORS.map((c) => {
            const isSel = (accent || "") === c;
            const isDefault = c === "";
            return (
              <button
                key={c || "default"}
                type="button"
                onClick={() => update({ seekBarColor: c })}
                className={`flex h-8 w-8 items-center justify-center rounded-full ring-2 transition-all ${
                  isSel ? "ring-ink scale-110" : "ring-edge-soft hover:ring-edge"
                }`}
                style={{
                  backgroundColor: isDefault ? "transparent" : c,
                  backgroundImage: isDefault
                    ? "linear-gradient(135deg, transparent 47%, var(--color-ink-subtle) 47% 53%, transparent 53%)"
                    : undefined,
                }}
                aria-label={isDefault ? t("Default (gold accent)") : c}
              />
            );
          })}
          <ColorPopoverTrigger
            value={accent || "#f0c674"}
            onChange={(hex) => update({ seekBarColor: hex })}
            label={accent ? accent.toUpperCase() : t("Custom")}
            highlighted={!!accent && !PRESET_COLORS.includes(accent)}
          />
          {accent && (
            <button
              type="button"
              onClick={() => update({ seekBarColor: "" })}
              className="flex h-8 items-center gap-1 rounded-full bg-raised px-3 text-[11.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              <RotateCcw size={11} strokeWidth={2.4} />
              {t("Default")}
            </button>
          )}
        </div>
      </SubField>

      <SubField label={t("Bar image")}>
        <SeekImageUpload
          value={settings.seekBarImage}
          onSelect={(url) => update({ seekBarImage: url, seekBarStyle: "image" })}
          onClear={() =>
            update({
              seekBarImage: "",
              seekBarStyle: settings.seekBarStyle === "image" ? "flat" : settings.seekBarStyle,
            })
          }
          emptyTitle={t("Upload a pattern to tile across the bar")}
          hint={t(
            "Tiles horizontally; the bar's height crops it vertically. Animated GIFs up to 2 MB play.",
          )}
          targetDim={256}
          targetQuality={0.88}
        />
      </SubField>

      <ToggleRow
        label={t("Buffer fill")}
        sub={t(
          "The lighter fill showing how much is buffered or downloaded ahead. It hides automatically once a stream is fully cached (green dot).",
        )}
        value={settings.seekBarFill !== false}
        onChange={(v) => update({ seekBarFill: v })}
      />

      <SubField
        label={t("Buffer fill brightness")}
        value={`${Math.round((settings.seekBarFillOpacity ?? 0.35) * 100)}%`}
      >
        <input
          type="range"
          min={5}
          max={100}
          step={5}
          value={Math.round((settings.seekBarFillOpacity ?? 0.35) * 100)}
          onChange={(e) => update({ seekBarFillOpacity: Number(e.target.value) / 100 })}
          disabled={settings.seekBarFill === false}
          className="w-full accent-ink disabled:opacity-40"
        />
      </SubField>

      <SubField label={t("Seek dot shape")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SHAPES.map((s) => (
            <PickTile
              key={s.id}
              selected={currentShape === s.id}
              onClick={async () => {
                if (s.id === "image" && !settings.seekDotImage) {
                  const url = await openSeekImageDialog();
                  if (url) update({ seekDotImage: url, seekDotShape: "image" });
                  return;
                }
                update({ seekDotShape: s.id });
              }}
              label={t(s.label)}
              sub={t(s.sub)}
            />
          ))}
        </div>
      </SubField>

      <SubField
        label={currentShape === "image" ? t("Image size") : t("Dot size")}
        value={`${dotVal}px`}
      >
        <input
          type="range"
          min={8}
          max={currentShape === "image" ? 200 : 64}
          step={1}
          value={dotVal}
          onChange={(e) => update({ seekDotSize: Number(e.target.value) })}
          disabled={currentShape === "hidden"}
          className="w-full accent-ink disabled:opacity-40"
        />
      </SubField>

      <SubField label={t("Dot image")}>
        <SeekImageUpload
          value={settings.seekDotImage}
          onSelect={(url) => update({ seekDotImage: url, seekDotShape: "image" })}
          onClear={() =>
            update({
              seekDotImage: "",
              seekDotShape: settings.seekDotShape === "image" ? "circle" : settings.seekDotShape,
            })
          }
          emptyTitle={t("Upload nyan cat, a sticker, anything")}
          hint={t(
            "PNG, JPEG, WebP, or SVG (auto-shrunk if huge). Animated GIFs up to 2 MB play live.",
          )}
        />
      </SubField>
    </div>
  );
}

function PickTile({
  selected,
  onClick,
  label,
  sub,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-start transition-all duration-150 ${
        selected
          ? "border-ink bg-elevated text-ink ring-2 ring-ink/30 shadow-[0_0_0_3px_rgba(255,255,255,0.05)]"
          : "border-edge-soft bg-canvas/30 text-ink-muted hover:border-edge hover:text-ink"
      }`}
    >
      <span className={`text-[12.5px] font-semibold ${selected ? "text-ink" : ""}`}>{label}</span>
      <span
        className={`text-[10.5px] leading-snug ${selected ? "text-ink-muted" : "text-ink-subtle"}`}
      >
        {sub}
      </span>
    </button>
  );
}

function Preview({ settings }: { settings: Settings }) {
  const [pct, setPct] = useState(55);
  const [hover, setHover] = useState(false);
  const [scrub, setScrub] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const fromEvent = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-edge shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <img
        src={seekPreviewBg}
        alt=""
        className="block h-auto w-full select-none"
        draggable={false}
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-7 pb-3 pt-6">
        <div
          ref={trackRef}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setScrub(true);
            setPct(fromEvent(e.clientX));
          }}
          onPointerMove={(e) => {
            if (scrub) setPct(fromEvent(e.clientX));
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            setScrub(false);
          }}
          className="relative h-10 cursor-pointer touch-none"
        >
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
            <SeekBarVisual
              settings={settings}
              pct={pct}
              bufferedPct={settings.seekBarFill === false ? 0 : Math.min(100, pct + 13)}
              hovered={hover}
              scrubbing={scrub}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
