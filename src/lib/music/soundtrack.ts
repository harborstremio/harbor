const FROM_CLAUSE =
  /\bfrom\s+(?:the\s+)?(?:motion\s+picture|film|movie|series)?\s*["“”]([^"“”]{2,70})["“”]/i;
const MUSIC_FROM =
  /^(?:music|songs)\s+(?:from|inspired\s+by)\s+(?:the\s+)?(?:motion\s+picture|film|movie)\s*:?\s*["“”]?(.{2,70}?)["“”]?$/i;
const SOUNDTRACK_TAIL =
  /^(.{2,70}?)\s*[:([–-]\s*(?:the\s+)?(?:original\s+)?(?:motion\s+picture\s+)?(?:soundtrack|score|music\s+from\s+(?:the\s+)?(?:motion\s+picture|film|movie))\b/i;
const TRAILING_NOISE = /\s*[([][^)\]]*$/;

/** Catalogues name the film in the album or in a From clause on the title, never in a field. */
export function soundtrackFilmTitle(...values: (string | undefined)[]): string | null {
  const texts = values.map((value) => (value ?? "").trim()).filter(Boolean);
  for (const pattern of [FROM_CLAUSE, MUSIC_FROM, SOUNDTRACK_TAIL]) {
    for (const text of texts) {
      const found = pattern.exec(text)?.[1]?.replace(TRAILING_NOISE, "").trim();
      if (found && found.length > 1 && found.length < 70) return found;
    }
  }
  return null;
}

const LOOSE = /[^a-z0-9]+/g;
const plain = (value: string) => value.toLowerCase().replace(LOOSE, " ").trim();

export function bestFilmMatch<T extends { name?: string }>(
  films: readonly T[],
  wanted: string,
): T | null {
  const target = plain(wanted);
  if (!target) return null;
  return (
    films.find((film) => plain(film.name ?? "") === target) ??
    films.find((film) => plain(film.name ?? "").startsWith(target)) ??
    null
  );
}
