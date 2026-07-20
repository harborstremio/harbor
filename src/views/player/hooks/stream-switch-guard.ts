export class StreamSwitchGuard {
  private activeRequest = 0;
  private nextRequest = 0;
  private wasPlayingBeforeSwitch: boolean | null = null;

  begin(isPlaying: boolean): number {
    if (this.wasPlayingBeforeSwitch === null) {
      this.wasPlayingBeforeSwitch = isPlaying;
    }
    this.activeRequest = ++this.nextRequest;
    return this.activeRequest;
  }

  isCurrent(request: number): boolean {
    return this.activeRequest === request;
  }

  shouldResumeOnFailure(request: number): boolean {
    return this.isCurrent(request) && this.wasPlayingBeforeSwitch === true;
  }

  finish(request: number): void {
    if (!this.isCurrent(request)) return;
    this.activeRequest = 0;
    this.wasPlayingBeforeSwitch = null;
  }
}
