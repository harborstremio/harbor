import { MANGA_COLLECTIONS, streamCollection } from "@/lib/manga/collections";
import type { MangaSummary } from "@/lib/manga/types";
import { badgeArtFor } from "./collection-badge";
import { MangaRail } from "./manga-rail";

export function MangaCollections({ onOpen }: { onOpen: (item: MangaSummary) => void }) {
  return (
    <div className="flex flex-col gap-9">
      {MANGA_COLLECTIONS.map((collection) => (
        <MangaRail
          key={collection.id}
          title={collection.name}
          subtitle={collection.subtitle}
          art={badgeArtFor(collection.id)}
          award={collection.award}
          loadStream={(onChunk) => streamCollection(collection, onChunk)}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
