import { useEffect, useState } from "react";
import {
  resolveDisplayCredits,
  splitArtistCredit,
  withFeaturedCredits,
  type ArtistCreditPart,
} from "@/lib/music/artist-credit";
export function useArtistCredits(name: string, title = "") {
  const [resolved, setResolved] = useState<{ name: string; parts: ArtistCreditPart[] } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    void resolveDisplayCredits(name).then((parts) => {
      if (active) setResolved({ name, parts });
    });
    return () => {
      active = false;
    };
  }, [name]);
  return withFeaturedCredits(
    resolved?.name === name ? resolved.parts : splitArtistCredit(name),
    title,
  );
}
