// Bounded fan-out. Promise.all over a mapped array opens every socket at once,
// and on the stick that is how one continue-watching row became a hundred and
// sixty simultaneous kitsu walks. Results keep input order. A rejection from
// `run` rejects the whole call, so callers that want per-item tolerance catch
// inside `run`, exactly as they did with Promise.all.
export async function runLanes<T, R>(
  items: T[],
  lanes: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let at = 0;
  const worker = async () => {
    while (at < items.length) {
      const i = at++;
      out[i] = await run(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(lanes, items.length) }, worker));
  return out;
}
