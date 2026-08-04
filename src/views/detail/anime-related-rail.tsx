import { Poster } from "@/components/poster";
import type { AnilistRelatedNode } from "@/lib/anilist/media-details";
import { CollectionBadges } from "@/views/manga/collection-badge";

export function AnimeRelatedRail({
  title,
  nodes,
  onOpen,
  badgeCollections = false,
}: {
  title: string;
  nodes: AnilistRelatedNode[];
  onOpen?: (node: AnilistRelatedNode) => void;
  badgeCollections?: boolean;
}) {
  if (nodes.length === 0) return null;
  return (
    <section className="flex min-w-0 flex-col">
      <h3 className="mb-3 text-[15px] font-semibold text-ink">{title}</h3>
      <div className="flex gap-3 overflow-x-auto pb-1 [scroll-snap-type:x_proximity] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&>*]:[scroll-snap-align:start]">
        {nodes.map((node) => (
          <RelatedCard
            key={node.anilistId}
            node={node}
            onOpen={onOpen}
            badgeCollections={badgeCollections}
          />
        ))}
      </div>
    </section>
  );
}

function RelatedCard({
  node,
  onOpen,
  badgeCollections,
}: {
  node: AnilistRelatedNode;
  onOpen?: (node: AnilistRelatedNode) => void;
  badgeCollections?: boolean;
}) {
  const meta = [
    node.format,
    node.year ? String(node.year) : undefined,
    node.rating ? `★ ${node.rating}` : undefined,
  ]
    .filter(Boolean)
    .join(" • ");
  const Wrap: "button" | "div" = onOpen ? "button" : "div";
  const wrapProps = onOpen ? { onClick: () => onOpen(node), type: "button" as const } : {};
  return (
    <Wrap
      {...wrapProps}
      className={`group flex w-36 shrink-0 flex-col gap-2 text-start ${onOpen ? "" : "cursor-default"}`}
    >
      <Poster
        src={node.poster}
        seed={String(node.anilistId)}
        ratio="portrait"
        className="rounded-xl"
      >
        <span className="pointer-events-none absolute start-1.5 top-1.5 rounded-full bg-canvas/80 px-2 py-0.5 text-[10px] text-ink backdrop-blur">
          {node.relation}
        </span>
        {node.upcoming && (
          <span className="pointer-events-none absolute end-1.5 top-1.5 rounded-full bg-canvas/80 px-2 py-0.5 text-[10px] text-ink backdrop-blur">
            Upcoming
          </span>
        )}
        {badgeCollections && node.mediaType === "manga" && (
          <span className="absolute end-1.5 bottom-1.5">
            <CollectionBadges title={node.title} size={30} side="top" />
          </span>
        )}
      </Poster>
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-[12.5px] text-ink">{node.title}</p>
        {meta && <p className="text-[11px] text-ink-subtle">{meta}</p>}
      </div>
    </Wrap>
  );
}
