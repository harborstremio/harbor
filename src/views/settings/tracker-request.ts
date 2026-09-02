let pending: string | null = null;

export function requestTracker(id: string): void {
  pending = id;
}

export function consumeTracker(): string | null {
  const v = pending;
  pending = null;
  return v;
}
