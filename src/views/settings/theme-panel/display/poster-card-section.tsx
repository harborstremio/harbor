import { useEffect, useRef } from "react";
import previewPoster1 from "@/assets/preview/poster1.webp";
import previewPoster2 from "@/assets/preview/poster2.webp";
import previewPoster3 from "@/assets/preview/poster3.webp";
import previewPoster4 from "@/assets/preview/poster4.webp";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { resetPosterDock, updatePosterDock } from "@/lib/poster-dock";
import { Section, Segmented, ToggleRow } from "../../shared";
import { POSTER_RADII, POSTER_SIZES, PxField, posterSizeKey, radiusKey } from "./poster-options";

export function PosterCardSection({ previewPoster }: { previewPoster: string }) {
  const t = useT();
  const { settings, update } = useSettings();
  const cardW = Math.round(150 * settings.posterScale);
  const cardH = Math.round(225 * settings.posterScale);
  const previewW = Math.min(cardW, 190);
  const tv = settings.rowCardStyle === "tv";

  return (
    <Section
      title={t("Poster card style")}
      subtitle={t("How cards look across Home, Discover, and your library. The preview updates live.")}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="flex shrink-0 flex-col gap-3 rounded-2xl bg-canvas/40 p-4 ring-1 ring-edge-soft lg:w-[218px]">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {t("Live preview")}
          </span>
          <div className="flex justify-center py-1">
            <img
              src={previewPoster}
              alt=""
              draggable={false}
              className="aspect-[2/3] object-cover shadow-[0_10px_28px_-10px_rgba(0,0,0,0.65)] transition-[width,border-radius] duration-200"
              style={{ width: previewW, borderRadius: settings.posterRadius }}
            />
          </div>
          <div className="flex flex-col gap-1.5 text-[12.5px]">
            <PxRow label={t("Width")} value={cardW} min={90} max={300} onCommit={(px) => update({ posterScale: Math.round((px / 150) * 100) / 100 })} />
            <PxRow label={t("Height")} value={cardH} min={135} max={450} onCommit={(px) => update({ posterScale: Math.round((px / 225) * 100) / 100 })} />
            <PxRow label={t("Corner radius")} value={settings.posterRadius} min={0} max={40} onCommit={(px) => update({ posterRadius: px })} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col divide-y divide-edge-soft/60">
          <Row label={t("Row card style")} hint={t("TV shows wide art cards with the logo on them. Poster is the classic grid.")}>
            <Segmented
              value={settings.rowCardStyle}
              options={[
                { value: "poster", label: t("Poster") },
                { value: "tv", label: t("TV") },
              ]}
              onChange={(v) => update({ rowCardStyle: v })}
            />
          </Row>

          {tv && (
            <Row label={t("Logo position")} hint={t("Where the logo and poster sit on a TV card.")}>
              <Segmented
                value={settings.tvCardLogoPos}
                options={[
                  { value: "bottomStart", label: t("Start") },
                  { value: "center", label: t("Center") },
                  { value: "bottomEnd", label: t("End") },
                ]}
                onChange={(v) => update({ tvCardLogoPos: v })}
              />
            </Row>
          )}

          <Row label={t("Size")}>
            <Segmented
              value={posterSizeKey(settings.posterScale)}
              options={POSTER_SIZES.map((p) => ({ value: p.value, label: p.label }))}
              onChange={(v) => update({ posterScale: POSTER_SIZES.find((p) => p.value === v)?.scale ?? 1 })}
            />
          </Row>

          <Row label={t("Corner radius")}>
            <Segmented
              value={radiusKey(settings.posterRadius)}
              options={POSTER_RADII.map((p) => ({ value: p.value, label: t(p.label) }))}
              onChange={(v) => update({ posterRadius: POSTER_RADII.find((p) => p.value === v)?.px ?? 12 })}
            />
          </Row>

          <Row label={t("Load effect")} hint={t("Blur up looks smoothest. Fade is lighter on older devices. Instant turns it off.")}>
            <Segmented
              value={settings.posterEffect}
              options={[
                { value: "blur", label: t("Blur up") },
                { value: "fade", label: t("Fade") },
                { value: "off", label: t("Instant") },
              ]}
              onChange={(v) => update({ posterEffect: v as "blur" | "fade" | "off" })}
            />
          </Row>

          <Row label={t("Quality")} hint={t("High is sized to your screen and looks identical to full res on far less memory. Balanced saves the most. Maximum keeps original resolution.")}>
            <Segmented
              value={settings.posterQuality}
              options={[
                { value: "balanced", label: t("Balanced") },
                { value: "high", label: t("High") },
                { value: "max", label: t("Maximum") },
              ]}
              onChange={(v) => update({ posterQuality: v as "balanced" | "high" | "max" })}
            />
          </Row>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-edge-soft bg-canvas/35 p-5">
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
          <>
            <div className="flex items-center gap-4 px-1 py-1.5">
              <span className="w-32 shrink-0 text-[13.5px] font-medium text-ink">{t("Animation speed")}</span>
              <input
                type="range"
                min="250"
                max="1500"
                step="10"
                value={settings.posterDockTransitionMs}
                onChange={(event) => update({ posterDockTransitionMs: Number(event.target.value) })}
                className="h-1 flex-1 appearance-none rounded-full bg-edge-soft accent-ink"
              />
              <span className="w-16 shrink-0 text-end text-[13px] tabular-nums text-ink-muted">
                {settings.posterDockTransitionMs}ms
              </span>
              {settings.posterDockTransitionMs !== 760 && (
                <button
                  type="button"
                  onClick={() => update({ posterDockTransitionMs: 760 })}
                  className="shrink-0 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
                >
                  {t("Reset")}
                </button>
              )}
            </div>
            <PosterDockPreview transitionMs={settings.posterDockTransitionMs} />
          </>
        )}
      </div>
    </Section>
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
      rtl: false,
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
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">{t("Live preview")}</span>
      <div className="overflow-visible px-3 pb-4 pt-2">
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
              <div data-preview-anchor className="overflow-hidden rounded-lg shadow-[0_6px_16px_-8px_rgba(0,0,0,0.8)]">
                <img src={poster} alt="" draggable={false} className="aspect-[2/3] w-full object-cover" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 first:pt-0 last:pb-0">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13.5px] font-medium text-ink">{label}</span>
        {hint && <span className="max-w-[46ch] text-[12px] leading-snug text-ink-subtle">{hint}</span>}
      </span>
      <span className="min-w-0 max-w-full">{children}</span>
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
    <span className="flex items-center justify-between gap-3">
      <span className="font-medium text-ink">{label}</span>
      <PxField value={value} min={min} max={max} onCommit={onCommit} />
    </span>
  );
}
