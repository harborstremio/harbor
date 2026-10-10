import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { tmdbIdFromImdb } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import {
  tmdbTitleCredits,
  tmdbTitleCreditsCached,
  type TitleCredits,
} from "@/lib/providers/tmdb/tmdb-title-credits";

export type PortPerson = { id: number; name: string; profilePath: string | null };
export type PortCredits = { cast: PortPerson[]; director: string | null };

const CAST_MAX = 9;
const held = new Map<string, PortCredits | null>();

export function parseTmdbRef(ref: string | null): { kind: "movie" | "tv"; id: number } | null {
  const m = /^tmdb:(movie|tv):(\d+)$/.exec(ref ?? "");
  if (!m) return null;
  return { kind: m[1] as "movie" | "tv", id: Number(m[2]) };
}

export function shapeCredits(raw: TitleCredits | null): PortCredits | null {
  if (!raw) return null;
  const cast = [...raw.cast]
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, CAST_MAX)
    .map((p) => ({ id: p.id, name: p.name, profilePath: p.profilePath }));
  const director = raw.crew.find((p) => p.job === "Director")?.name ?? null;
  if (cast.length === 0 && !director) return null;
  return { cast, director };
}

export function usePortCredits(meta: Meta | null, key: string): PortCredits | null | undefined {
  const id = meta?.id ?? "";
  const type = meta?.type === "series" ? "series" : "movie";
  const [out, setOut] = useState<PortCredits | null | undefined>(() =>
    !key || !id ? null : held.get(id),
  );

  useEffect(() => {
    if (!id || !key || !id.startsWith("tt")) {
      setOut(null);
      return;
    }
    const known = held.get(id);
    if (known !== undefined) {
      setOut(known);
      return;
    }
    setOut(undefined);
    let live = true;
    (async () => {
      const ref = parseTmdbRef(await tmdbIdFromImdb(key, id, type));
      if (!ref) {
        held.set(id, null);
        if (live) setOut(null);
        return;
      }
      const cached = tmdbTitleCreditsCached(ref.kind, ref.id);
      const raw = cached !== undefined ? cached : await tmdbTitleCredits(key, ref.kind, ref.id);
      const shaped = shapeCredits(raw);
      held.set(id, shaped);
      if (live) setOut(shaped);
    })().catch(() => {
      if (live) setOut(null);
    });
    return () => {
      live = false;
    };
  }, [id, key, type]);

  return out;
}
