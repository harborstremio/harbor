import { memo } from "react";
import { X } from "lucide-react";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import type { NewEpisode } from "@/lib/new-episodes";
import { useView } from "@/lib/view";

type Props = {
  episodes: NewEpisode[];
  onDismissOne: (key: string) => void;
  onDismissAll: () => void;
};

function label(ep: NewEpisode): string {
  if (ep.title) return ep.title;
  return `S${ep.season} E${ep.episode}`;
}

const EpisodeCard = memo(function EpisodeCard({
  ep,
  onDismiss,
}: {
  ep: NewEpisode;
  onDismiss: (key: string) => void;
}) {
  const t = useT();
  const { openMeta } = useView();
  const art = ep.still ?? ep.poster;

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        onClick={() =>
          openMeta(
            { id: ep.seriesId, type: "series", name: ep.seriesName, poster: ep.poster ?? undefined },
            { episodeHint: { season: ep.season, episode: ep.episode } },
          )
        }
        className="block w-full overflow-hidden rounded-lg bg-elevated text-start outline-none transition-transform duration-150 ease-in-out group-hover:scale-[1.015] motion-reduce:group-hover:scale-100"
      >
        <span className="relative block aspect-video w-full overflow-hidden bg-raised">
          {art ? (
            <img
              src={art}
              alt=""
              draggable={false}
              loading="lazy"
              className="h-full w-full select-none object-cover"
            />
          ) : null}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
          <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3">
            <span className="truncate text-[13.5px] font-semibold leading-tight text-white">
              {ep.seriesName}
            </span>
            <span className="truncate text-[12px] leading-tight text-white/70">{label(ep)}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(ep.key);
        }}
        aria-label={t("Dismiss")}
        className="absolute end-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white opacity-0 transition-opacity duration-150 ease-in-out hover:bg-black/85 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X size={14} strokeWidth={2.4} />
      </button>
    </div>
  );
});

export function NewEpisodesSection({ episodes, onDismissOne, onDismissAll }: Props) {
  const t = useT();
  if (episodes.length === 0) return null;

  const dismissAll = (
    <button
      type="button"
      onClick={onDismissAll}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
    >
      {t("Dismiss all")}
      <X size={13} strokeWidth={2.2} />
    </button>
  );

  const title = (
    <span className="flex items-center gap-2.5">
      <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-[12px] font-bold tabular-nums text-canvas">
        {episodes.length}
      </span>
      {t("New Episodes")}
    </span>
  );

  return (
    <Row
      title={title}
      min={260}
      shape="landscape"
      scrollKey="home:new-episodes"
      headerRight={dismissAll}
    >
      {episodes.map((ep) => (
        <EpisodeCard key={ep.key} ep={ep} onDismiss={onDismissOne} />
      ))}
    </Row>
  );
}
