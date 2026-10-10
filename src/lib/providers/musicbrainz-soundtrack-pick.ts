export type SoundtrackCandidate = { id: string; title: string; released: string };

export type FilmSoundtrack = {
  releaseGroupId: string;
  title: string;
  artist: string;
  year?: number;
};

type Obj = Record<string, unknown>;

const obj = (value: unknown): Obj =>
  value !== null && typeof value === "object" ? (value as Obj) : {};
const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const NAMES_THE_FILM = /soundtrack|motion picture|original score|music from/i;
const NAMES_A_DERIVATIVE = /\bremix(?:es)?\b|\bedit\b|\bdemo\b|\bkaraoke\b|\bcover\b/i;

export function soundtrackCandidates(payload: unknown): SoundtrackCandidate[] {
  const found = new Map<string, SoundtrackCandidate>();
  for (const entry of arr(obj(payload).relations)) {
    const relation = obj(entry);
    if (str(relation.type) !== "IMDb") continue;
    if (str(relation["target-type"]) !== "release_group") continue;
    const group = obj(relation.release_group);
    const id = str(group.id);
    const title = str(group.title);
    if (!id || !title || found.has(id)) continue;
    found.set(id, { id, title, released: str(group["first-release-date"]) });
  }
  return [...found.values()];
}

function signal(candidate: SoundtrackCandidate): number {
  return (
    (NAMES_THE_FILM.test(candidate.title) ? 4 : 0) -
    (NAMES_A_DERIVATIVE.test(candidate.title) ? 3 : 0)
  );
}

export function rankSoundtrackCandidates(list: SoundtrackCandidate[]): SoundtrackCandidate[] {
  return [...list].sort((a, b) => {
    const bySignal = signal(b) - signal(a);
    if (bySignal !== 0) return bySignal;
    return (a.released || "9999").localeCompare(b.released || "9999");
  });
}

function englishName(holder: Obj, credited: string): string {
  for (const entry of arr(holder.aliases)) {
    const alias = obj(entry);
    if (str(alias.locale) !== "en" || alias.primary !== true) continue;
    const name = str(alias.name);
    if (name) return name;
  }
  return credited;
}

function creditedTo(group: Obj): string {
  return arr(group["artist-credit"])
    .map((entry) => {
      const credit = obj(entry);
      const join = typeof credit.joinphrase === "string" ? credit.joinphrase : "";
      const credited = str(credit.name);
      return `${englishName(obj(credit.artist), credited)}${join}`;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function readReleaseGroup(
  payload: unknown,
  fallbackTitle: string,
): { album: FilmSoundtrack; single: boolean } | null {
  const group = obj(payload);
  const id = str(group.id);
  if (!id) return null;
  const secondary = arr(group["secondary-types"]).map((value) => str(value).toLowerCase());
  if (!secondary.includes("soundtrack")) return null;
  const year = Number(str(group["first-release-date"]).slice(0, 4));
  return {
    album: {
      releaseGroupId: id,
      title: englishName(group, str(group.title) || fallbackTitle),
      artist: creditedTo(group),
      year: year > 1000 ? year : undefined,
    },
    single: str(group["primary-type"]).toLowerCase() === "single",
  };
}
