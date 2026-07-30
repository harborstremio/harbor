import { useSampleArtwork } from "@/lib/sample-artwork";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, Segmented, ToggleRow } from "../shared";
import { PosterCardSection } from "./display/poster-card-section";
import { SFX } from "@/lib/sfx";

export function DisplaySection() {
  const t = useT();
  const { settings, update } = useSettings();
  const glassBlur = Number.isFinite(settings.defaultLiquidGlassBlur) ? settings.defaultLiquidGlassBlur : 2;
  const glassTint = Number.isFinite(settings.defaultLiquidGlassTint) ? settings.defaultLiquidGlassTint : 40;
  const { poster: previewPoster } = useSampleArtwork();
  const soundEffectsEnabled = settings.soundTheme !== "none";
  return (
    <>
      <PosterCardSection previewPoster={previewPoster} />
      <Section title={t("Liquid Glass")}>
        <ToggleRow
          label={t("Use liquid glass")}
          newId="theme:liquid-glass"
          sub={t("Use liquid glass for the search pill and row scroll arrows. The appearance settings below are shared by glass surfaces across Harbor.")}
          value={settings.liquidGlass}
          onChange={(v) => update({ liquidGlass: v })}
        />
        {settings.liquidGlass && (
          <>
          <ToggleRow
            label={t("Enhanced liquid glass")}
            sub={t("A richer glass treatment. May look better while using more graphics resources.")}
            value={settings.experimentalLiquidGlassEnabled}
            onChange={(v) => update({ experimentalLiquidGlassEnabled: v })}
          />
          {settings.experimentalLiquidGlassEnabled ? (
            <div className="mt-4 flex items-center gap-4 px-1 py-1.5">
              <span className="w-40 shrink-0 text-[13.5px] font-medium text-ink">{t("Glass opacity")}</span>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={settings.experimentalLiquidGlassOpacity}
                onChange={(e) => update({ experimentalLiquidGlassOpacity: Number(e.target.value) })}
                className="h-1 flex-1 appearance-none rounded-full bg-edge-soft accent-ink"
              />
              <span className="w-14 shrink-0 text-end text-[13px] tabular-nums text-ink-muted">
                {settings.experimentalLiquidGlassOpacity}%
              </span>
            </div>
          ) : (
            <>
              <div className="mt-4 flex items-center gap-4 px-1 py-1.5">
                <span className="w-40 shrink-0 text-[13.5px] font-medium text-ink">{t("Glass blur")}</span>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.5"
                  value={glassBlur}
                  onChange={(e) => update({ defaultLiquidGlassBlur: Number(e.target.value) })}
                  className="h-1 flex-1 appearance-none rounded-full bg-edge-soft accent-ink"
                />
                <span className="w-14 shrink-0 text-end text-[13px] tabular-nums text-ink-muted">{glassBlur}px</span>
              </div>
              <div className="mt-4 flex items-center gap-4 px-1 py-1.5">
                <span className="w-40 shrink-0 text-[13.5px] font-medium text-ink">{t("Glass tint")}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={glassTint}
                  onChange={(e) => update({ defaultLiquidGlassTint: Number(e.target.value) })}
                  className="h-1 flex-1 appearance-none rounded-full bg-edge-soft accent-ink"
                />
                <span className="w-14 shrink-0 text-end text-[13px] tabular-nums text-ink-muted">{glassTint}%</span>
              </div>
            </>
          )}
          </>
        )}
      </Section>

      <Section
        title={t("Sound effects")}
        subtitle={t("Subtle audio feedback as you navigate and click. Off by default; pick a style to turn it on.")}
      >
        <div className="flex flex-col gap-4">
          <Segmented
            value={settings.soundTheme}
            options={[
              { value: "none", label: t("Off") },
              { value: "glass", label: t("Glass") },
              { value: "modern", label: t("Modern") },
              { value: "retro", label: t("Retro") },
              { value: "cinematic", label: t("Cinematic") },
            ]}
            onChange={(v) => update({ soundTheme: v as "none" | "glass" | "modern" | "retro" | "cinematic" })}
          />

          {soundEffectsEnabled && (
            <>
              <div className="flex items-center gap-4 px-1 py-1.5">
                <span className="w-32 shrink-0 text-[13.5px] font-medium text-ink">
                  {t("Sound effects volume")}
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={settings.sfxVolume ?? 50}
                  onChange={(e) => {
                    const volume = parseInt(e.target.value, 10);
                    update({ sfxVolume: volume });
                    SFX.setVolume(volume / 100);
                    SFX.click();
                  }}
                  className="h-1 flex-1 appearance-none rounded-full bg-edge-soft accent-ink"
                />
                <span className="w-14 shrink-0 text-end text-[13px] tabular-nums text-ink-muted">
                  {settings.sfxVolume ?? 50}%
                </span>
              </div>

              <ToggleRow
                label={t("Player volume sounds")}
                sub={t("Play a short sound when changing the player volume. Off by default.")}
                value={settings.playerVolumeSfx}
                onChange={(value) => update({ playerVolumeSfx: value })}
              />
            </>
          )}
        </div>
      </Section>

      <Section
        title={t("Title text")}
        subtitle={t("Resize the row titles on Home and the title shown in the player, without scaling the rest of the interface. You can also lead the player title with the series name instead of the episode.")}
      >
        <SizeSlider
          label={t("Row titles")}
          value={settings.rowTitleScale}
          onChange={(v) => update({ rowTitleScale: v })}
        />
        <SizeSlider
          label={t("Player title")}
          value={settings.playerTitleScale}
          onChange={(v) => update({ playerTitleScale: v })}
        />
        <ToggleRow
          label={t("Show series name first in the player")}
          sub={t("Lead with the show name instead of the episode title at the top of the player.")}
          value={settings.playerTitleSeriesFirst}
          onChange={(v) => update({ playerTitleSeriesFirst: v })}
        />
      </Section>

      <Section
        title={t("Accessibility")}
        subtitle={t("Make everything bigger and easier to read: sidebar, menus, popups, every page. The whole interface scales live as you drag, so you can see the change right here. Great on 4K and ultrawide monitors, or whenever the text feels small.")}
      >
        <div className="flex items-center gap-4 px-1 py-1.5">
          <span className="w-32 shrink-0 text-[13.5px] font-medium text-ink">{t("Interface scale")}</span>
          <input
            type="range"
            min={0.8}
            max={1.6}
            step={0.05}
            value={settings.uiScale}
            onChange={(e) => update({ uiScale: parseFloat(e.target.value) })}
            className="h-1 flex-1 appearance-none rounded-full bg-edge-soft accent-ink"
          />
          <span className="w-14 shrink-0 text-end text-[13px] tabular-nums text-ink-muted">
            {Math.round(settings.uiScale * 100)}%
          </span>
          {settings.uiScale !== 1 && (
            <button
              onClick={() => update({ uiScale: 1 })}
              className="shrink-0 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
            >
              {t("Reset")}
            </button>
          )}
        </div>
      </Section>

      <Section
        title={t("Home hero")}
        subtitle={t("Make the featured banner on Home bigger and sharper.")}
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-[14px] font-medium text-ink">{t("Featured source")}</span>
          <span className="text-[12.5px] text-ink-subtle">
            {t("What fills the hero. Trending is a fresh top list from Harbor, refreshed through the day. Classic uses your own Home rows.")}
          </span>
          <Segmented
            value={settings.heroFeed}
            options={[
              { value: "trending", label: t("Trending") },
              { value: "trakt", label: t("Trakt") },
              { value: "simkl", label: t("Simkl") },
              { value: "classic", label: t("Classic") },
            ]}
            onChange={(v) => update({ heroFeed: v as "trending" | "trakt" | "simkl" | "classic" })}
          />
        </div>
        <ToggleRow
          label={t("Full hero banner")}
          sub={t("Stretch the featured hero edge to edge and taller, across every layout.")}
          value={settings.heroFull}
          onChange={(v) => update({ heroFull: v })}
        />
        <ToggleRow
          label={t("Full quality hero image")}
          sub={t("Load the highest-resolution artwork for the featured hero. Uses more bandwidth.")}
          value={settings.heroFullQuality}
          onChange={(v) => update({ heroFullQuality: v })}
        />
        <ToggleRow
          label={t("Play trailers in the hero")}
          newId="theme:hero-video"
          sub={t("After a moment on a slide, the featured title's trailer plays muted in the background. Uses more bandwidth.")}
          value={settings.heroTrailers}
          onChange={(v) => update({ heroTrailers: v })}
        />
        {settings.heroTrailers && (
          <ToggleRow
            label={t("Home hero audio")}
            sub={t("The home hero trailer plays with sound and a mute button in the corner, then shows a replay button when it ends. Auto-rotation pauses so it stays on the featured title.")}
            value={settings.heroTrailerAudio}
            onChange={(v) => update({ heroTrailerAudio: v })}
          />
        )}
      </Section>

      <Section
        title={t("Screensaver")}
        subtitle={t("When Harbor sits idle in the foreground, it drifts through cinematic backdrops with a clock and what's trending. Any movement or key brings you back. Off by default.")}
      >
        <ToggleRow
          label={t("Ambient screensaver")}
          value={settings.screensaver}
          onChange={(v) => update({ screensaver: v })}
        />
        {settings.screensaver && (
          <div className="mt-3 flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              {t("Start after")}
            </span>
            <Segmented
              value={String(settings.screensaverDelayMin)}
              options={[
                { value: "1", label: t("1 min") },
                { value: "3", label: t("3 min") },
                { value: "5", label: t("5 min") },
                { value: "10", label: t("10 min") },
                { value: "15", label: t("15 min") },
              ]}
              onChange={(v) => update({ screensaverDelayMin: Number(v) })}
            />
          </div>
        )}
      </Section>

      <Section
        title={t("Home hero shadow")}
        subtitle={t("How dark the gradient behind the featured title on Home is. 100% is the classic look; lower it to let more of the artwork show through.")}
      >
        <div className="flex items-center gap-4 px-1 py-1.5">
          <span className="w-32 shrink-0 text-[13.5px] font-medium text-ink">{t("Shadow")}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={settings.heroShadow}
            onChange={(e) => update({ heroShadow: parseInt(e.target.value, 10) })}
            className="h-1 flex-1 appearance-none rounded-full bg-edge-soft accent-ink"
          />
          <span className="w-14 shrink-0 text-end text-[13px] tabular-nums text-ink-muted">
            {settings.heroShadow}%
          </span>
          {settings.heroShadow !== 100 && (
            <button
              onClick={() => update({ heroShadow: 100 })}
              className="shrink-0 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
            >
              {t("Reset")}
            </button>
          )}
        </div>
      </Section>

      <Section
        title={t("Trailer quality")}
        subtitle={t("How sharp trailers play. Auto follows your connection speed, and the Watch Trailer button targets 1080p. Pick 1080p or Best (up to 4K when the source has it) to force higher. 1080p and Best merge separate video and audio with the bundled ffmpeg, so they take a beat longer to start.")}
      >
        <Segmented
          value={settings.trailerQuality}
          options={[
            { value: "auto", label: "Auto" },
            { value: "360p", label: "360p" },
            { value: "720p", label: "720p" },
            { value: "1080p", label: "1080p" },
            { value: "best", label: "Best" },
          ]}
          onChange={(v) => update({ trailerQuality: v })}
        />
        <ToggleRow
          label={t("Autoplay trailer on detail pages")}
          sub={t("Plays a muted trailer in the backdrop when you open a title. Click the speaker to unmute. Falls back to the image when no trailer is available.")}
          value={settings.detailTrailerAutoplay}
          onChange={(v) => update({ detailTrailerAutoplay: v })}
        />
        {settings.detailTrailerAutoplay && (
          <ToggleRow
            label={t("Start trailers with audio")}
            sub={t("Detail page trailers begin unmuted. Falls back to muted if the browser blocks sound until you interact.")}
            value={settings.detailTrailerAudio}
            onChange={(v) => update({ detailTrailerAudio: v })}
          />
        )}
        <ToggleRow
          label={t("Scroll up for the trailer")}
          sub={t("From the very top of a detail page, keep scrolling up to open the trailer. Off by default.")}
          value={settings.scrollUpTrailer}
          onChange={(v) => update({ scrollUpTrailer: v })}
        />
      </Section>
    </>
  );
}

function SizeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-4 px-1 py-1.5">
      <span className="w-32 shrink-0 text-[13.5px] font-medium text-ink">{label}</span>
      <input
        type="range"
        min={0.8}
        max={1.6}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 flex-1 appearance-none rounded-full bg-edge-soft accent-ink"
      />
      <span className="w-14 shrink-0 text-end text-[13px] tabular-nums text-ink-muted">
        {Math.round(value * 100)}%
      </span>
      {value !== 1 && (
        <button
          onClick={() => onChange(1)}
          className="shrink-0 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
        >
          {t("Reset")}
        </button>
      )}
    </div>
  );
}
