import { useMemo } from "react";
import { AVATAR_CATALOG, avatarUrl } from "./catalog";
import { useAvatarPacks } from "./packs";

export function useAvatarValues(): string[] {
  const packs = useAvatarPacks();
  return useMemo(() => {
    const originals = AVATAR_CATALOG.filter((g) => !g.transparent).flatMap((g) =>
      g.items.map((i) => avatarUrl(i.id)),
    );
    const imported = packs.flatMap((p) => p.items.map((i) => i.data));
    return [...originals, ...imported];
  }, [packs]);
}
