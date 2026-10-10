import { Play } from "@/components/icons/play-filled";
import type { TmdbDetail } from "@/lib/providers/tmdb/tmdb-details";
import { SFX } from "@/lib/sfx";
import { useBpT } from "../bp-i18n";
import { BP_DETAIL_HEADING } from "./bp-detail-chrome";

const THUMB = (ytId: string) => `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;

type Clip = { ytId: string; name: string; kind: string };

// TMDB hands back its own English type strings. The tag is the loudest token on
// the card, so it goes through the catalog rather than being printed raw, which
// left an English word sitting in an otherwise mirrored card under RTL.
const KIND_KEY: Record<string, string> = {
  Trailer: "Trailer",
  Teaser: "Teaser",
  Clip: "Clip",
  Featurette: "Featurette",
  "Behind the Scenes": "Behind the Scenes",
  "Opening Credits": "Opening Credits",
  Bloopers: "Bloopers",
  Recap: "Recap",
};

export function BpVideosRow({
  detail,
  onPlay,
}: {
  detail: TmdbDetail;
  onPlay: (ytId: string) => void;
}) {
  const t = useBpT();
  const kindLabel = (kind: string): string => {
    const key = KIND_KEY[kind];
    return key ? t(key) : kind;
  };

  const seen = new Set<string>();
  const clips: Clip[] = [];
  for (const ytId of detail.trailerCandidates.slice(1)) {
    if (seen.has(ytId)) continue;
    seen.add(ytId);
    clips.push({ ytId, name: t("Trailer"), kind: "Trailer" });
  }
  for (const v of detail.extraVideos) {
    if (seen.has(v.ytId)) continue;
    seen.add(v.ytId);
    clips.push({ ytId: v.ytId, name: v.name || kindLabel(v.type), kind: v.type });
  }
  if (clips.length === 0) return null;

  return (
    <section data-bp-row data-bp-row-key="videos" className="relative">
      <h2 className={BP_DETAIL_HEADING}>{t("Videos")}</h2>
      <div
        data-bp-scroll-x
        className="flex gap-[clamp(9px,0.85vw,17px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {clips.slice(0, 14).map((c) => (
          <button
            key={c.ytId}
            type="button"
            data-bp-focusable
            data-bp-tile="wide"
            data-bp-restore-key={`bp-video:${c.ytId}`}
            onClick={() => {
              SFX.click();
              onPlay(c.ytId);
            }}
            aria-label={c.name}
            className="group relative flex shrink-0 flex-col overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
            style={{ width: "clamp(212px, 17.5vw, 340px)" }}
          >
            <span
              className="relative block w-full overflow-hidden bg-[var(--bp-panel-2)]"
              style={{ aspectRatio: "16 / 9" }}
            >
              <img
                src={THUMB(c.ytId)}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-[var(--bp-void)]/55 opacity-0 transition-opacity duration-[var(--bp-dur)] group-data-[bp-focus=true]:opacity-100 motion-reduce:transition-none">
                <Play size={26} className="fill-ink text-ink" strokeWidth={0} />
              </span>
            </span>
            <span className="flex flex-col gap-1 p-[clamp(9px,0.9vw,15px)]">
              <span className="text-[clamp(10px,1.25vh,14px)] font-bold uppercase tracking-[0.14em] text-ink-subtle">
                {kindLabel(c.kind)}
              </span>
              <span className="line-clamp-1 text-[clamp(12.5px,1.7vh,19.5px)] font-semibold text-ink">
                {c.name}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
