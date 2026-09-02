import type { ReactNode } from "react";
import { ArrowedScrollRow } from "@/components/arrowed-scroll-row";
import { Poster } from "@/components/poster";
import { openLinkOut } from "@/lib/social/link-out";
import type { FavoriteMedia } from "@/lib/providers/favorites-types";
import { Avatar } from "./profile-bits";

const AVATAR_SIZE = 88;

const POSTER_ART =
  "rounded-md ring-1 ring-edge-soft shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] motion-safe:group-hover:will-change-transform group-hover:shadow-[0_18px_36px_-14px_rgba(0,0,0,0.6)] motion-safe:group-hover:[transform:translate3d(0,-0.5rem,0)_scale(1.03)]";

const AVATAR_ART =
  "inline-flex rounded-full shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] motion-safe:group-hover:will-change-transform group-hover:shadow-[0_16px_32px_-14px_rgba(0,0,0,0.6)] motion-safe:group-hover:[transform:translate3d(0,-0.25rem,0)_scale(1.04)]";

function tileTitle(item: FavoriteMedia): string {
  return item.sub ? `${item.name} (${item.sub})` : item.name;
}

function Tile({
  url,
  title,
  className,
  children,
}: {
  url: string | null;
  title: string;
  className: string;
  children: ReactNode;
}) {
  if (!url) {
    return (
      <div className={`group ${className}`} title={title}>
        {children}
      </div>
    );
  }
  const href = url;
  return (
    <button
      type="button"
      onClick={() => openLinkOut(href)}
      title={title}
      className={`group ${className}`}
    >
      {children}
    </button>
  );
}

function PosterTile({ item }: { item: FavoriteMedia }) {
  return (
    <Tile url={item.url} title={tileTitle(item)} className="w-[108px] shrink-0 text-start">
      <Poster
        src={item.image || undefined}
        fallbacks={item.imageFallback ? [item.imageFallback] : undefined}
        seed={item.name || item.id}
        ratio="portrait"
        lazy
        className={POSTER_ART}
      />
      <div className="mt-2 truncate text-[12.5px] font-medium text-ink">{item.name}</div>
    </Tile>
  );
}

function ArtistTile({ item }: { item: FavoriteMedia }) {
  return (
    <Tile url={item.url} title={tileTitle(item)} className="w-[100px] shrink-0 text-center">
      <span className={AVATAR_ART}>
        <Avatar src={item.image || undefined} size={AVATAR_SIZE} alias={item.name} />
      </span>
      <div className="mt-2 truncate text-[12.5px] font-medium text-ink">{item.name}</div>
    </Tile>
  );
}

export function FavoritesRow({
  kind,
  items,
}: {
  kind: FavoriteMedia["kind"];
  items: FavoriteMedia[];
}) {
  const circular = kind === "music";
  return (
    <ArrowedScrollRow className="-mx-5 px-4">
      {items.map((item) =>
        circular ? (
          <ArtistTile key={item.id} item={item} />
        ) : (
          <PosterTile key={item.id} item={item} />
        ),
      )}
    </ArrowedScrollRow>
  );
}
