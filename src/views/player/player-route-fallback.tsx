import { HarborLoader } from "@/components/harbor-loader";
import { Topbar } from "@/chrome/topbar";
import { useT } from "@/lib/i18n";
import type { PlayerSrc } from "@/lib/view";
import { LoaderLogoOrText } from "./loader-logo-or-text";

// Shown by the App Suspense boundary while the player chunk loads. Matches the
// CinematicPlayerLoader look so the handoff from the picker's "Selecting best
// source" screen is a crossfade instead of a black blink.
export function PlayerRouteFallback({ src }: { src: PlayerSrc }) {
  const t = useT();
  const backdrop = src.episode?.still || src.meta.background || src.meta.poster;
  return (
    <div className="fixed inset-0 z-100 overflow-hidden bg-black">
      <Topbar connecting />
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-40 blur-[28px] saturate-150"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-b from-black/65 via-black/55 to-black/85" />
      <div className="relative flex h-full flex-col items-center justify-center gap-7 px-8 text-center">
        <LoaderLogoOrText logo={src.meta.logo ?? null} fallbackText={src.meta.name ?? src.title} />
        {src.episode && (
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.32em] text-white/70">
            S{src.episode.imdbSeason ?? src.episode.season} · E
            {String(src.episode.imdbEpisode ?? src.episode.episode).padStart(2, "0")}
            {src.episode.name ? ` · ${src.episode.name}` : ""}
          </p>
        )}
        <HarborLoader size="md" caption={t("Loading video")} />
      </div>
    </div>
  );
}
