import { AVATAR_CATALOG, avatarUrl } from "./catalog";

const JL_DEFAULT_AVATARS: string[] = AVATAR_CATALOG.flatMap((g) =>
  g.items.filter((i) => i.id.startsWith("jl/")).map((i) => avatarUrl(i.id)),
);

// FNV-1a keeps the pick stable across sessions and devices for the same profile id,
// so a profile without a picture always shows the same JL avatar.
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** JL avatar URL for a seed (usually a profile id), or null when there is no seed. */
export function defaultAvatarFor(seed: string | null | undefined): string | null {
  if (!seed || JL_DEFAULT_AVATARS.length === 0) return null;
  return JL_DEFAULT_AVATARS[hashSeed(seed) % JL_DEFAULT_AVATARS.length];
}
