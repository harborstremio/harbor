import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { get } from "@/lib/providers/tmdb/tmdb-client";
import { tmdbPerson, type PersonCredit } from "@/lib/providers/tmdb";
import { FilmRow } from "@/views/person/film-row";

const nameKey = (name: string) =>
  name.normalize("NFKC").toLocaleLowerCase().trim().replace(/\s+/g, " ");
const cache = new Map<string, Promise<PersonCredit[]>>();
async function creditsFor(key: string, name: string) {
  const response = await get<{ results?: { id: number; name: string }[] }>(key, "search/person", {
    query: name,
    include_adult: "false",
  });
  if (!response) throw new Error("Person lookup unavailable");
  const exact = response.results?.filter((person) => nameKey(person.name) === nameKey(name)) ?? [];
  // Do not select the most popular namesake when the identity is ambiguous.
  if (exact.length !== 1) return [];
  const person = await tmdbPerson(key, exact[0].id);
  if (!person) throw new Error("Credits unavailable");
  const unique = new Map<string, PersonCredit>();
  for (const credit of [...person.cast, ...person.crew]) {
    if (credit.mediaType !== "movie" && credit.mediaType !== "tv") continue;
    const identity = `${credit.mediaType}:${credit.id}`;
    const previous = unique.get(identity);
    unique.set(
      identity,
      previous
        ? {
            ...previous,
            job: [...new Set([previous.job, credit.job].filter(Boolean))].join(" · "),
            character: previous.character
              ? [
                  ...new Set([previous.character, credit.character, credit.job].filter(Boolean)),
                ].join(" · ")
              : credit.character,
          }
        : credit,
    );
  }
  return [...unique.values()].sort(
    (a, b) =>
      (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "") || b.popularity - a.popularity,
  );
}

export function MusicArtistFilmography({ name }: { name: string }) {
  const { settings } = useSettings();
  const t = useT();
  const key = `${settings.tmdbKey}:${nameKey(name)}`;
  const [result, setResult] = useState<{ key: string; credits: PersonCredit[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (!settings.tmdbKey) return;
    let alive = true;
    setFailed(null);
    let request = cache.get(key);
    if (!request) {
      request = creditsFor(settings.tmdbKey, name);
      cache.set(key, request);
      if (cache.size > 60) cache.delete(cache.keys().next().value!);
      void request.catch(() => cache.delete(key));
    }
    void request
      .then((credits) => {
        if (alive) setResult({ key, credits });
      })
      .catch(() => {
        if (alive) setFailed(key);
      });
    return () => {
      alive = false;
    };
  }, [key, attempt]);
  const credits = result?.key === key ? result.credits : [];
  if (failed === key)
    return (
      <section className="music-filmography">
        <h2>{t("music.artist.filmography")}</h2>
        <p className="mb-3 text-sm text-ink-muted" role="status">
          {t("music.action.error")}
        </p>
        <button
          type="button"
          className="music-detail-secondary"
          onClick={() => retry((value) => value + 1)}
        >
          {t("common.retry")}
        </button>
      </section>
    );
  if (!credits.length) return null;
  return (
    <section className="music-filmography">
      <FilmRow title={t("music.artist.filmography")} credits={credits} showRole showRating />
      <p className="text-xs text-ink-subtle">TMDB</p>
    </section>
  );
}
