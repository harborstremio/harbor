import { Poster } from "@/components/poster";
import { RankBadge } from "@/components/rank-badge";
import type { CastEntry } from "@/lib/providers/tmdb";
import { useRankings } from "@/lib/rankings";
import { useView } from "@/lib/view";

export function CastCard({ cast }: { cast: CastEntry }) {
  const { openPerson } = useView();
  const { rank } = useRankings();
  const isResolved = cast.id > 0;
  const r = isResolved ? rank(cast.id, "Acting") : undefined;
  const photo = cast.profilePath
    ? cast.profilePath.startsWith("http")
      ? cast.profilePath
      : `https://image.tmdb.org/t/p/w185${cast.profilePath}`
    : undefined;
  const Wrap: "button" | "div" = isResolved ? "button" : "div";
  const wrapProps = isResolved ? { onClick: () => openPerson(cast.id), type: "button" as const } : {};
  return (
    <Wrap
      {...wrapProps}
      data-person-card
      className={`group flex w-full min-w-0 flex-col gap-2.5 text-start ${isResolved ? "" : "cursor-default"}`}
    >
      <div
        className={`relative transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] ${isResolved ? "group-hover:-translate-y-2" : ""}`}
      >
        <Poster
          src={photo}
          seed={String(cast.id)}
          ratio="portrait"
          className={`rounded-xl shadow-[0_0_0_rgba(0,0,0,0)] transition-shadow duration-300 ${isResolved ? "harbor-card-ring group-hover:shadow-[0_24px_44px_-14px_rgba(0,0,0,0.6)]" : ""}`}
        />
        {r && <RankBadge rank={r} dept="Acting" />}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-1 text-[13px] font-medium text-ink">{cast.name}</p>
        {cast.character && <p className="line-clamp-2 text-[12px] leading-tight text-ink-subtle">{cast.character}</p>}
      </div>
    </Wrap>
  );
}
