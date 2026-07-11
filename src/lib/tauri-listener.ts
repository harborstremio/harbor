type Unlisten = () => void | Promise<void>;

export function onceUnlisten(unlisten: Unlisten): () => void {
  let called = false;

  return () => {
    if (called) return;
    called = true;

    try {
      const result = unlisten();
      if (result && typeof result.catch === "function") {
        void result.catch(() => {});
      }
    } catch {}
  };
}
