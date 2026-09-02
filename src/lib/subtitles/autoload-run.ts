export type SubtitleAutoloadRunLease = Readonly<{
  mediaKey: string;
  generation: number;
}>;

/** Invalidates older async searches, including overlapping runs for the same media. */
export class SubtitleAutoloadRunCoordinator {
  private generation = 0;

  begin(mediaKey: string): SubtitleAutoloadRunLease {
    return { mediaKey, generation: ++this.generation };
  }

  invalidate(): void {
    this.generation += 1;
  }

  isCurrent(lease: SubtitleAutoloadRunLease, mediaKey: string): boolean {
    return lease.mediaKey === mediaKey && lease.generation === this.generation;
  }
}

export function subtitleAutoloadSelectionLeaseValid(input: {
  leaseRevision: number;
  leaseSelectedId: string | null;
  currentRevision: number;
  currentSelectedId: string | null;
  currentSelectionIsAutomatic: boolean;
}): boolean {
  const unchanged =
    input.currentRevision === input.leaseRevision &&
    input.currentSelectedId === input.leaseSelectedId;
  return unchanged || (input.currentSelectedId != null && input.currentSelectionIsAutomatic);
}

export function subtitleAutoloadLateSelectionAllowed(input: {
  currentSelectedId: string | null;
  currentSelectionIsAutomatic: boolean;
  autoUpgradeEnabled: boolean;
}): boolean {
  if (input.currentSelectedId == null) return true;
  return input.autoUpgradeEnabled && input.currentSelectionIsAutomatic;
}
