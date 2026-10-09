import { labelRoster } from "./label-metadata";
import { resolveRoster } from "./mb-roster";
import type { RankedMusicSearchResults } from "./sources";

export function loadMusicLabel(
  labelId: string,
  signal?: AbortSignal,
): Promise<RankedMusicSearchResults> {
  return labelRoster(labelId, signal).then(resolveRoster);
}
