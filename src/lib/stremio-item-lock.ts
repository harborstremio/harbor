const chains = new Map<string, Promise<unknown>>();

export function withItemLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(id) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(() => fn());
  const settled = run.then(
    () => {},
    () => {},
  );
  chains.set(id, settled);
  void settled.then(() => {
    if (chains.get(id) === settled) chains.delete(id);
  });
  return run;
}
