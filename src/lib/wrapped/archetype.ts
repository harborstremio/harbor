export function deriveArchetype(input: {
  split: { movies: number; series: number; anime: number };
  longestBinge: { count: number };
  totalTitles: number;
}): { id: string; label: string; blurb: string } {
  const { movies, series, anime } = input.split;
  const total = movies + series + anime || 1;
  if (anime / total >= 0.5) {
    return {
      id: "weeb",
      label: "The Anime Devotee",
      blurb: "Over half your year was anime. Respect the grind.",
    };
  }
  if (input.longestBinge.count >= 8) {
    return {
      id: "binger",
      label: "The Binger",
      blurb: `You once tore through ${input.longestBinge.count} in a single day.`,
    };
  }
  if (movies / total >= 0.6) {
    return { id: "cinephile", label: "The Film Buff", blurb: "Movies are your natural habitat." };
  }
  if (series / total >= 0.6) {
    return {
      id: "serialist",
      label: "The Series Slayer",
      blurb: "You live one episode at a time.",
    };
  }
  if (input.totalTitles >= 60) {
    return {
      id: "explorer",
      label: "The Explorer",
      blurb: "You cast a wide net across everything.",
    };
  }
  return {
    id: "balanced",
    label: "The Well-Rounded",
    blurb: "A little of everything, all year long.",
  };
}
