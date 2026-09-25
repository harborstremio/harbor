import { useState } from "react";
import { NavGlyph } from "@/components/icons/nav-glyph";
import { absCollectionImage } from "@/lib/collections";
import type { MembershipDestination } from "@/lib/membership-actions";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";

function designatedArtwork(destination?: MembershipDestination): string | undefined {
  for (const artwork of [destination?.coverImage, destination?.bgImage]) {
    const url = absCollectionImage(artwork?.trim());
    if (url && /^(https?:\/\/|blob:|data:image\/)/i.test(url)) return url;
  }
  return undefined;
}

/** Only the destination's designated artwork belongs here, never a member's poster. */
export function CollectionDestinationIcon({
  destination,
}: {
  destination?: MembershipDestination;
}) {
  const src = useProxiedImageSrc(designatedArtwork(destination));
  const [loaded, setLoaded] = useState<string>();
  const [failed, setFailed] = useState<string>();
  return (
    <span
      aria-hidden
      className="relative inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-[4px]"
    >
      <NavGlyph name="collections" className="size-4" />
      {src && src !== failed && (
        <img
          key={src}
          src={src}
          alt=""
          decoding="async"
          draggable={false}
          className="absolute inset-0 size-full object-cover"
          style={{ opacity: loaded === src ? 1 : 0 }}
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
        />
      )}
    </span>
  );
}
