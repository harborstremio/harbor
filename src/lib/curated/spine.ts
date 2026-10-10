import raw from "@/data/criterion-spine.json";

type SpineFile = {
  builtAt: string;
  count: number;
  lowest: number;
  highest: number;
  spines: Record<string, number>;
};

const file = raw as SpineFile;

export const CRITERION_LIST_ID = "criterion-collection";

export function spineFor(imdbId: string | null | undefined): number | null {
  if (!imdbId) return null;
  const spine = file.spines[imdbId];
  return typeof spine === "number" ? spine : null;
}
