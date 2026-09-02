import { fillStyle } from "@/components/slider";
import { useEffect, useRef } from "react";
import previewPoster1 from "@/assets/preview/poster1.webp";
import previewPoster2 from "@/assets/preview/poster2.webp";
import previewPoster3 from "@/assets/preview/poster3.webp";
import previewPoster4 from "@/assets/preview/poster4.webp";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { resetPosterDock, updatePosterDock } from "@/lib/poster-dock";
import { Section, Segmented, ToggleRow } from "../../shared";
import { SettingRow } from "../../kit";
import { POSTER_RADII, POSTER_SIZES, PxField, posterSizeKey, radiusKey } from "./poster-options";
import { PreviewImage } from "../../preview-image";

function sizeIndex(scale: number): number {
  const key = posterSizeKey(scale);
  const i = POSTER_SIZES.findIndex((p) => p.value === key);
  return i < 0 ? 2 : i;
}

function SIZE_LABEL(t: (s: string) => string, scale: number): string {
  return t(POSTER_SIZES[sizeIndex(scale)].label);
}

function RADIUS_LABEL(t: (s: string) => string, px: number): string {
  const key = radiusKey(px);
  const found = POSTER_RADII.find((p) => p.value === key);
  return `${t(found?.label ?? "Classic")} · ${px}px`;
}

export function PosterCardSection({ previewPoster }: { previewPoster: string }) {
  const t = useT();
  const { settings, update } = useSettings();
  const cardW = Math.round(150 * settings.posterScale);
  const cardH = Math.round(225 * settings.posterScale);
  const previewW = Math.min(cardW, 178);
  const tv = settings.rowCardStyle === "tv";

  return (
    <>
      <Section title={t("Poster card style")}>
        <div className="flex flex-wrap gap-1.5">
          <aside className="flex w-[230px] shrink-0 flex-col gap-3 rounded-md bg-elevated px-4 py-4">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
              {t("Live preview")}
            </span>
            <span className="flex min-h-[236px] items-center justify-center rounded-md bg-canvas py-3">
              <PreviewImage
                src={previewPoster}
                className="aspect-[2/3] object-cover transition-[width,border-radius] duration-300 ease-in-out"
                style={{ width: previewW, borderRadius: settings.posterRadius }}
              />
            </span>
            <span className="flex flex-col gap-1">
              <PxRow
                label={t("Width")}
                value={cardW}
                min={90}
                max={300}
                onCommit={(px) => update({ posterScale: Math.round((px / 150) * 100) / 100 })}
              />
              <PxRow
                label={t("Height")}
                value={cardH}
                min={135}
                max={450}
                onCommit={(px) => update({ posterScale: Math.round((px / 225) * 100) / 100 })}
              />
              <PxRow
                label={t("Radius")}
                value={settings.posterRadius}
                min={0}
                max={40}
                onCommit={(px) => update({ posterRadius: px })}
              />
            </span>
          </aside>

          <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
            <SettingRow
              label={t("Row card style")}
              desc={t("TV shows wide art cards with the logo on them. Poster is the classic grid.")}
            >
              <Segmented
                value={settings.rowCardStyle}
                options={[
                  { value: "poster", label: t("Poster") },
                  { value: "tv", label: t("TV") },
                ]}
                onChange={(v) => update({ rowCardStyle: v })}
              />
            </SettingRow>

            {tv && (
              <SettingRow
                label={t("Logo position")}
                desc={t("Where the logo and poster sit on a TV card.")}
              >
                <Segmented
                  value={settings.tvCardLogoPos}
                  options={[
                    { value: "bottomStart", label: t("Start") },
                    { value: "center", label: t("Center") },
                    { value: "bottomEnd", label: t("End") },
                  ]}
                  onChange={(v) => update({ tvCardLogoPos: v })}
                />
              </SettingRow>
            )}

            <SettingRow label={t("Size")} desc={SIZE_LABEL(t, settings.posterScale)}>
              <input
                type="range"
                min={0}
                max={POSTER_SIZES.length - 1}
                step={1}
                aria-label={t("Size")}
                value={sizeIndex(settings.posterScale)}
                onChange={(e) =>
                  update({ posterScale: POSTER_SIZES[Number(e.target.value)].scale })
                }
                className="harbor-slider w-[190px] shrink-0"
                style={fillStyle(sizeIndex(settings.posterScale), 0, POSTER_SIZES.length - 1)}
              />
            </SettingRow>

            <SettingRow label={t("Corner radius")} desc={RADIUS_LABEL(t, settings.posterRadius)}>
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                aria-label={t("Corner radius")}
                value={settings.posterRadius}
                onChange={(e) => update({ posterRadius: Number(e.target.value) })}
                className="harbor-slider w-[190px] shrink-0"
                style={fillStyle(settings.posterRadius, 0, 40)}
              />
            </SettingRow>

            <SettingRow
              label={t("Load effect")}
              desc={t(
                "Blur up looks smoothest. Fade is lighter on older devices. Instant turns it off.",
              )}
            >
              <Segmented
                value={settings.posterEffect}
                options={[
                  { value: "blur", label: t("Blur up") },
                  { value: "fade", label: t("Fade") },
                  { value: "off", label: t("Instant") },
                ]}
                onChange={(v) => update({ posterEffect: v as "blur" | "fade" | "off" })}
              />
            </SettingRow>

            <SettingRow
              label={t("Quality")}
              desc={t(
                "High is sized to your screen and looks identical to full res on far less memory. Balanced saves the most. Maximum keeps original resolution.",
              )}
            >
              <Segmented
                value={settings.posterQuality}
                options={[
                  { value: "balanced", label: t("Balanced") },
                  { value: "high", label: t("High") },
                  { value: "max", label: t("Maximum") },
                ]}
                onChange={(v) => update({ posterQuality: v as "balanced" | "high" | "max" })}
              />
            </SettingRow>
          </div>
        </div>
      </Section>

      <Section title={t("Card behaviour")}>
        <ToggleRow
          label={t("Focused Card")}
          sub={t(
            "Emphasize the selected card across the page while gently darkening and blurring the other cards.",
          )}
          value={settings.posterFocusedCard}
          onChange={(posterFocusedCard) => update({ posterFocusedCard })}
        />
        <ToggleRow
          label={t("Expanding Cards")}
          sub={t(
            "Expand poster cards during keyboard or remote navigation across poster rows, using preloaded wide artwork.",
          )}
          value={settings.posterBackdropExpansion}
          onChange={(posterBackdropExpansion) => update({ posterBackdropExpansion })}
        />
        <ToggleRow
          label={t("Poster dock magnification")}
          newId="theme:poster-dock"
          sub={t("Gently magnify nearby posters as you move across a poster row.")}
          value={settings.posterDockMagnification}
          onChange={(posterDockMagnification) => update({ posterDockMagnification })}
        />
        {settings.posterDockMagnification && (
          <div className="harbor-cascade flex flex-col gap-1.5">
            <SettingRow label={t("Animation speed")}>
              <input
                type="range"
                min="250"
                max="1500"
                step="10"
                value={settings.posterDockTransitionMs}
                onChange={(event) => update({ posterDockTransitionMs: Number(event.target.value) })}
                className="harbor-slider w-[220px] shrink-0"
                style={fillStyle(settings.posterDockTransitionMs, 250, 1500)}
              />
              <span className="w-16 shrink-0 text-end text-[15px] font-semibold tabular-nums text-ink">
                {settings.posterDockTransitionMs}ms
              </span>
              {settings.posterDockTransitionMs !== 760 && (
                <button
                  type="button"
                  onClick={() => update({ posterDockTransitionMs: 760 })}
                  className="harbor-press-pop h-8 shrink-0 rounded-md bg-canvas px-3 text-[12.5px] font-semibold text-ink-subtle transition-colors hover:text-ink"
                >
                  {t("Reset")}
                </button>
              )}
            </SettingRow>
            <PosterDockPreview transitionMs={settings.posterDockTransitionMs} />
          </div>
        )}
      </Section>
    </>
  );
}

function PosterDockPreview({ transitionMs }: { transitionMs: number }) {
  const t = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pointerXRef = useRef<number | null>(null);

  const update = () => {
    frameRef.current = null;
    const track = trackRef.current;
    const pointerX = pointerXRef.current;
    if (!track || pointerX === null) return;
    const firstCell = track.children[0] as HTMLElement | undefined;
    if (!firstCell) return;

    updatePosterDock({
      track,
      pointerX,
      cellWidth: firstCell.getBoundingClientRect().width,
      gap: 12,
      scrollPosition: 0,
      rtl: getComputedStyle(track).direction === "rtl",
      transitionMs,
    });
  };

  const schedule = (pointerX: number) => {
    pointerXRef.current = pointerX;
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(update);
  };

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (trackRef.current) resetPosterDock(trackRef.current);
    },
    [],
  );

  return (
    <div className="flex flex-col gap-2.5 rounded-md bg-elevated px-4 py-4">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
        {t("Hover the row")}
      </span>
      <div className="overflow-visible px-2 pb-3 pt-1">
        <div
          ref={trackRef}
          onPointerMove={(event) => schedule(event.clientX)}
          onPointerLeave={() => {
            pointerXRef.current = null;
            if (trackRef.current) resetPosterDock(trackRef.current);
          }}
          className="grid grid-cols-4 items-start gap-3"
        >
          {[previewPoster1, previewPoster2, previewPoster3, previewPoster4].map((poster, index) => (
            <div key={`${poster}-${index}`} className="min-w-0">
              <div
                data-preview-anchor
                className="overflow-hidden rounded-md shadow-[0_6px_16px_-8px_rgba(0,0,0,0.8)]"
              >
                <PreviewImage src={poster} className="aspect-[2/3] w-full object-cover" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PxRow({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (px: number) => void;
}) {
  return (
    <span className="flex items-center justify-between gap-3 rounded-md bg-canvas px-3 py-2">
      <span className="text-[12.5px] font-medium text-ink-subtle">{label}</span>
      <PxField value={value} min={min} max={max} onCommit={onCommit} />
    </span>
  );
}
