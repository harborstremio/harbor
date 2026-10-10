export type AvatarItem = { id: string; name: string };
export type AvatarGroup = { group: string; items: AvatarItem[]; transparent?: boolean };

export const avatarUrl = (id: string): string => `/avatars/${id}.webp`;

export const AVATAR_CATALOG: AvatarGroup[] = [
  {
    group: "JL Media Vision",
    items: [
      { id: "jl/jl_runner", name: "Runner" },
      { id: "jl/jl_soccer_star", name: "Soccer Star" },
      { id: "jl/jl_coach", name: "Coach" },
      { id: "jl/jl_swimmer", name: "Swimmer" },
      { id: "jl/jl_lifter", name: "Lifter" },
      { id: "jl/jl_locs", name: "Host" },
      { id: "jl/jl_hooper", name: "Hooper" },
      { id: "jl/jl_martial_artist", name: "Martial Artist" },
      { id: "jl/jl_rugby", name: "Rugby" },
      { id: "jl/jl_tennis", name: "Tennis" },
      { id: "jl/jl_baller", name: "Baller" },
      { id: "jl/jl_striker", name: "Striker" },
    ],
  },
];

export const AVATAR_COUNT = AVATAR_CATALOG.reduce((n, g) => n + g.items.length, 0);

const KEPT_URLS = new Set(AVATAR_CATALOG.flatMap((g) => g.items.map((i) => avatarUrl(i.id))));

export function isRemovedBuiltinAvatar(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("/avatars/") && !KEPT_URLS.has(value);
}
