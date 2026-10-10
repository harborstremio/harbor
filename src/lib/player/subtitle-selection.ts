export type SubtitleSelectionOrigin = "manual" | "automatic" | "restore";

export type SubtitleSelectionRequest = Readonly<{
  mediaRevision: number;
  selectionRevision: number;
  requestedId: string;
  previousId: string | null;
}>;

export type SubtitleSelectionSettlement =
  | { current: false }
  | { current: true; selectedId: string | null };

/** Keeps async subtitle loads from committing after a newer selection or media load. */
export class SubtitleSelectionCoordinator {
  private selectionRevision = 0;
  private manualMediaRevision: number | null = null;

  canAutoSelect(mediaRevision: number): boolean {
    return this.manualMediaRevision !== mediaRevision;
  }

  claim(mediaRevision: number, origin: SubtitleSelectionOrigin): boolean {
    if (origin !== "manual") return this.canAutoSelect(mediaRevision);
    this.manualMediaRevision = mediaRevision;
    return true;
  }

  begin(
    mediaRevision: number,
    requestedId: string,
    previousId: string | null,
  ): SubtitleSelectionRequest {
    return {
      mediaRevision,
      selectionRevision: ++this.selectionRevision,
      requestedId,
      previousId,
    };
  }

  invalidate(): void {
    this.selectionRevision += 1;
  }

  isCurrent(request: SubtitleSelectionRequest, currentMediaRevision: number): boolean {
    return (
      request.mediaRevision === currentMediaRevision &&
      request.selectionRevision === this.selectionRevision
    );
  }

  settle(
    request: SubtitleSelectionRequest,
    currentMediaRevision: number,
    loaded: boolean,
    isAvailable: (id: string) => boolean,
  ): SubtitleSelectionSettlement {
    if (!this.isCurrent(request, currentMediaRevision)) {
      return { current: false };
    }
    if (loaded && isAvailable(request.requestedId)) {
      return { current: true, selectedId: request.requestedId };
    }
    return {
      current: true,
      selectedId:
        request.previousId != null && isAvailable(request.previousId) ? request.previousId : null,
    };
  }
}
