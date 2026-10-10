const listeners = new Set<(requestId: string) => void>();

export function openDiagnosticsConsent(requestId: string): void {
  for (const l of listeners) l(requestId);
}

export function subscribeDiagnosticsOpen(cb: (requestId: string) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
