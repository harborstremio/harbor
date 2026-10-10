import { activeProfileId } from "@/lib/active-profile-id";
import type { TypeKey } from "./shared";
import type { LocalSortKey, SortDir } from "./local-tab/toolbar";

export type LibraryFilterPreferences = {
  type: TypeKey;
  genres: string[];
  sort: LocalSortKey;
  sortDir: SortDir;
  server?: string;
  library?: string;
};

export function readLibraryFilterPreferences(
  section: "local" | "media-servers",
): Partial<LibraryFilterPreferences> {
  try {
    const raw = localStorage.getItem(`harbor.library.filters.${section}.${activeProfileId()}`);
    if (!raw) return {};
    const value = JSON.parse(raw) as Partial<LibraryFilterPreferences>;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function writeLibraryFilterPreferences(
  section: "local" | "media-servers",
  value: LibraryFilterPreferences,
): void {
  try {
    localStorage.setItem(
      `harbor.library.filters.${section}.${activeProfileId()}`,
      JSON.stringify(value),
    );
  } catch {
    /* Preferences are optional when storage is unavailable. */
  }
}
