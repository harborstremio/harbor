export const LIBRARY_PLAY_STATUSES = ["unset", "toPlay", "playing", "finished", "onHold", "stopped"] as const;
export type LibraryPlayStatus = typeof LIBRARY_PLAY_STATUSES[number];
export const LIBRARY_STATUS_FILTERS = ["all", ...LIBRARY_PLAY_STATUSES] as const;
export type LibraryStatusFilter = typeof LIBRARY_STATUS_FILTERS[number];

/** A personal choice, never inferred from hours, installation state or achievements. */
export function matchesLibraryStatus(status: LibraryPlayStatus | undefined, filter: LibraryStatusFilter = "all") {
  return filter === "all" || (status ?? "unset") === filter;
}
