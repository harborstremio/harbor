import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { externalToKitsu } from "@/lib/providers/anime-mapping";
import { kitsuAnime, parseKitsuId } from "@/lib/providers/kitsu";

const ANIME_ID_RX = /^(kitsu|mal|anilist|anidb):(\d+)/;

function dedupeTitles(name: string, extra: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [name, ...extra]) {
    const t = (raw ?? "").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Union of a show's known titles (display name + kitsu english / romaji / native
 * / canonical) for anime metas. Consumed by the stream trust filter's anime
 * title-identity gate, which rejects wrong-show results that IMDb-indexer addons
 * inject when Harbor fans the anime request out to a `tt<imdb>:season:episode`
 * query answered by episode NUMBER (e.g. Evangelion S1E1 pulling Stranger
 * Things / Star Wars / Star Trek).
 *
 * Returns null for non-anime ids so the gate no-ops. For anime ids it seeds
 * synchronously with the display name (always part of the final union) so the
 * gate is active from the first pipeline run, then expands to the full kitsu
 * title union once resolved. The gate itself no-ops on a null/empty list, so
 * this can only ever remove wrong-show results, never legit anime.
 */
export function useAnimeAltTitles(meta: Meta): string[] | null {
  const metaId = meta.id;
  const metaName = meta.name;
  const [titles, setTitles] = useState<string[] | null>(() =>
    ANIME_ID_RX.test(metaId) ? dedupeTitles(metaName, []) : null,
  );
  useEffect(() => {
    const m = ANIME_ID_RX.exec(metaId);
    if (!m) {
      setTitles(null);
      return;
    }
    let cancelled = false;
    setTitles(dedupeTitles(metaName, []));
    const source = m[1];
    const id = Number(m[2]);
    void (async () => {
      const kid = source === "kitsu" ? parseKitsuId(metaId) : await externalToKitsu(source, id);
      if (cancelled || kid == null) return;
      const detail = await kitsuAnime(kid).catch(() => null);
      if (cancelled || !detail) return;
      setTitles(dedupeTitles(metaName, detail.altTitles));
    })();
    return () => {
      cancelled = true;
    };
  }, [metaId, metaName]);
  return titles;
}
