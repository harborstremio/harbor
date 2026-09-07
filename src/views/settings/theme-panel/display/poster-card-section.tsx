import { fillStyle } from "@/components/slider";
import { useEffect, useRef } from "react";
import { SETTINGS_FILMS, SETTINGS_SAMPLE_META, useSampleArtwork } from "@/lib/sample-artwork";
import { TvCardArtwork } from "@/components/tv-card";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { resetPosterDock, updatePosterDock } from "@/lib/poster-dock";
import { Section, Segmented, ToggleRow } from "../../shared";
import { SettingRow } from "../../kit";
import { SButton } from "../../ui";
import { POSTER_RADII, POSTER_SIZES, posterSizeKey, radiusKey } from "./poster-options";
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

export function PosterCardSection() {
  const t = useT();
  const { settings, update } = useSettings();
  const art = useSampleArtwork();
  const tv = settings.rowCardStyle === "tv";

  return (
    <>
      <Section title={t("Poster card style")}>
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

        <div className="hset-postertune" style={tv ? { flexWrap: "wrap" } : undefined}>
          <div
            className="hset-postertune-stage"
            style={tv ? { inlineSize: Math.round(236 * settings.posterScale), maxWidth: "100%", alignSelf: "center", padding: 0, background: "transparent" } : undefined}
          >
            {tv ? (
              <div
                role="img"
                aria-label={t("TV card preview for {title}", { title: SETTINGS_SAMPLE_META.name })}
                className="relative aspect-[16/9] max-w-full overflow-hidden bg-elevated ring-1 ring-edge-soft transition-[width,border-radius] duration-[260ms] ease-in-out motion-reduce:transition-none"
                style={{
                  width: Math.round(236 * settings.posterScale),
                  borderRadius: settings.posterRadius,
                }}
              >
                <TvCardArtwork
                  meta={SETTINGS_SAMPLE_META}
                  logo={art.logo ?? undefined}
                  posterSrc={art.poster}
                />
              </div>
            ) : (
              <PreviewImage
                src={art.poster}
                className="aspect-[2/3] object-cover"
                style={{
                  width: Math.round(118 * settings.posterScale),
                  borderRadius: settings.posterRadius,
                  transition: "width 260ms ease-in-out, border-radius 260ms ease-in-out",
                }}
              />
            )}
          </div>
          <div className="hset-postertune-dials" style={tv ? { flex: "1 1 280px" } : undefined}>
            <SettingRow
              wide
              label={t("Size")}
              desc={t("How large every poster card is drawn across Home and search.")}
            >
              <div className="flex w-full items-center gap-4">
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
                  className="harbor-slider h-11 min-w-0 flex-1"
                  style={fillStyle(sizeIndex(settings.posterScale), 0, POSTER_SIZES.length - 1)}
                />
                <span className="w-[92px] shrink-0 text-end text-[15.5px] font-semibold text-ink">
                  {SIZE_LABEL(t, settings.posterScale)}
                </span>
              </div>
            </SettingRow>

            <SettingRow
              wide
              label={t("Corner radius")}
              desc={t("How rounded the corners of every poster card are.")}
            >
              <div className="flex w-full items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={2}
                  aria-label={t("Corner radius")}
                  value={settings.posterRadius}
                  onChange={(e) => update({ posterRadius: Number(e.target.value) })}
                  className="harbor-slider h-11 min-w-0 flex-1"
                  style={fillStyle(settings.posterRadius, 0, 40, 2)}
                />
                <span className="w-[124px] shrink-0 text-end text-[15.5px] font-semibold tabular-nums text-ink">
                  {RADIUS_LABEL(t, settings.posterRadius)}
                </span>
              </div>
            </SettingRow>
          </div>
        </div>

        <SettingRow
          wide
          label={t("Load effect")}
          desc={t("Blur up looks smoothest. Fade is lighter on older devices. Instant turns it off.")}
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
          wide
          label={t("Quality")}
          desc={t("High is sized to your screen and looks identical to full res on far less memory. Balanced saves the most. Maximum keeps original resolution.")}
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
      </Section>

      <Section title={t("Card behaviour")}>
        <ToggleRow
          label={t("Focused Card")}
          sub={t("Emphasize the selected card across the page while gently darkening and blurring the other cards.")}
          value={settings.posterFocusedCard}
          onChange={(posterFocusedCard) => update({ posterFocusedCard })}
        />
        <ToggleRow
          label={t("Expanding Cards")}
          sub={t("Expand poster cards during keyboard or remote navigation across poster rows, using preloaded wide artwork.")}
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
            <SettingRow
              wide
              label={t("Animation speed")}
              desc={t("How long a poster takes to grow and settle as the pointer passes it.")}
            >
              <div className="flex w-full max-w-[520px] flex-wrap items-center gap-4">
                <input
                  type="range"
                  min={250}
                  max={1500}
                  step={50}
                  aria-label={t("Animation speed")}
                  value={settings.posterDockTransitionMs}
                  onChange={(event) => update({ posterDockTransitionMs: Number(event.target.value) })}
                  className="harbor-slider h-11 min-w-0 flex-1"
                  style={fillStyle(settings.posterDockTransitionMs, 250, 1500, 50)}
                />
                <span className="w-[80px] shrink-0 text-end text-[15.5px] font-semibold tabular-nums text-ink">
                  {t("{ms} ms", { ms: settings.posterDockTransitionMs })}
                </span>
                {settings.posterDockTransitionMs !== 760 && (
                  <span className="flex basis-full">
                    <SButton onClick={() => update({ posterDockTransitionMs: 760 })}>
                      {t("Reset")}
                    </SButton>
                  </span>
                )}
              </div>
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
    <div className="flex flex-col gap-3 rounded-[10px] bg-elevated px-5 py-5">
      <span className="harbor-settings-label">{t("Hover the row")}</span>
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
          {SETTINGS_FILMS.map(({ poster }, index) => (
            <div key={`${poster}-${index}`} className="min-w-0">
              <div
                data-preview-anchor
                className="overflow-hidden rounded-[10px]"
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
