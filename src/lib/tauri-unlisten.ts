export type TauriUnlisten = () => void | Promise<void>;

export function isStaleTauriListenerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("listeners[eventid].handlerid") ||
    (normalized.includes("unregisterlistener") && normalized.includes("undefined"))
  );
}

export function makeSafeTauriUnlisten(unlisten: TauriUnlisten): () => void {
  let disposed = false;

  return () => {
    if (disposed) return;
    disposed = true;

    const reportFailure = (error: unknown) => {
      if (!isStaleTauriListenerError(error)) {
        console.warn("[tauri] failed to unregister listener", error);
      }
    };

    try {
      const result = unlisten();
      if (result && typeof result.then === "function") {
        void result.catch(reportFailure);
      }
    } catch (error) {
      reportFailure(error);
    }
  };
}
