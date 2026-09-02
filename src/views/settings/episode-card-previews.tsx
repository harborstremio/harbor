import type { ReactNode } from "react";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { useT } from "@/lib/i18n";
import { useSettingsPreviewArt } from "@/lib/settings-preview-art";
import { PreviewImage } from "./preview-image";

export type EpisodeCardKind = "rating" | "description" | "hd";

const MOCK_TITLE = "The Last Stand";
const MOCK_SYNOPSIS =
  "With the city surrounded, an unlikely alliance forms as a long-buried secret finally comes to light.";

export function EpisodeCardPreview({ kind }: { kind: EpisodeCardKind }) {
  const art = useSettingsPreviewArt();
  const stills = art?.stills ?? [];
  if (kind === "hd") return <HdCompare src={stills[0]} />;
  return (
    <EpiCard
      still={stills[0]}
      showRating
      showDesc={kind === "description"}
      glowRating={kind === "rating"}
    />
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">{children}</p>;
}

function Still({ src, soft }: { src?: string; soft?: boolean }) {
  if (!src) return <div className="h-full w-full bg-gradient-to-br from-elevated to-canvas" />;
  return (
    <PreviewImage
      src={src}
      className={`h-full w-full object-cover ${soft ? "scale-105 blur-[1.6px]" : ""}`}
    />
  );
}

function EpiCard({
  still,
  showRating,
  showDesc,
  glowRating,
}: {
  still?: string;
  showRating?: boolean;
  showDesc?: boolean;
  glowRating?: boolean;
}) {
  const t = useT();
  return (
    <>
      <div className="overflow-hidden rounded-md bg-canvas/40 ring-1 ring-edge-soft/60">
        <div className="relative aspect-video">
          <Still src={still} />
          <span className="absolute start-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-ink">
            4
          </span>
          {showRating && (
            <span
              className={`absolute bottom-1.5 end-1.5 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-1 backdrop-blur-sm ${
                glowRating ? "ring-1 ring-amber-300/70" : ""
              }`}
            >
              <ImdbIcon className="h-2.5 w-5" />
              <span className="text-[10.5px] font-bold tabular-nums text-amber-300">8.7</span>
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5 px-2.5 py-2">
          <span className="text-[12px] font-semibold text-ink">{t(MOCK_TITLE)}</span>
          <span className="text-[10px] text-ink-subtle">E4 · {t("{n} min", { n: 48 })}</span>
          {showDesc && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-muted">
              {t(MOCK_SYNOPSIS)}
            </p>
          )}
        </div>
      </div>
      <Caption>
        {glowRating
          ? t("Each episode shows its IMDb rating, right on the still.")
          : showDesc
            ? t("Turn on to show each episode's synopsis under the still.")
            : null}
      </Caption>
    </>
  );
}

function HdCompare({ src }: { src?: string }) {
  const t = useT();
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Tile label={t("Lighter (w300)")} src={src} soft />
        <Tile label={t("Original")} src={src} accent />
      </div>
      <Caption>{t("Loads full-resolution artwork instead of the lighter, softer version.")}</Caption>
    </>
  );
}

function Tile({ label, src, soft, accent }: { label: string; src?: string; soft?: boolean; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-hidden rounded-md ring-1 ring-edge-soft/60">
        <div className="relative aspect-video">
          <Still src={src} soft={soft} />
        </div>
      </div>
      <span
        className={`text-[9px] font-bold uppercase tracking-[0.12em] ${
          accent ? "text-accent" : "text-ink-subtle"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
