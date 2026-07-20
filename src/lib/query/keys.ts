/** Stable query-key factory so cache entries stay consistent across views. */
export const queryKeys = {
  catalog: {
    list: (authKey: string | null) => ["harbor", "catalog", "list", authKey ?? "anon"] as const,
    rows: (authKey: string | null) => ["harbor", "catalog", "rows", authKey ?? "anon"] as const,
    shelf: (base: string, type: string, id: string) =>
      ["harbor", "catalog", "shelf", base, type, id, 1] as const,
  },
  addons: {
    installed: (authKey: string | null) =>
      ["harbor", "addons", "installed", authKey ?? "anon"] as const,
    directory: () => ["harbor", "addons", "directory"] as const,
    manifest: (transportUrl: string) => ["harbor", "addons", "manifest", transportUrl] as const,
  },
  detail: {
    data: (id: string, type: string, tmdbKey: string, language: string) =>
      ["harbor", "detail", id, type, tmdbKey ? "tmdb" : "cinemeta", language] as const,
  },
} as const;
