/** Decode a replacement before swapping visible artwork; never hold the UI indefinitely. */
export function preloadGameArt(src: string, signal?: AbortSignal): Promise<boolean> {
  if (!src || signal?.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const image = new Image();
    let finished = false;
    const finish = (ready: boolean) => {
      if (finished) return;
      finished = true; clearTimeout(timer); signal?.removeEventListener("abort", abort);
      resolve(ready);
    };
    const abort = () => finish(false), timer = setTimeout(() => finish(false), 6500);
    signal?.addEventListener("abort", abort, { once: true });
    image.src = src;
    image.decode().then(() => finish(!signal?.aborted), () => finish(false));
  });
}
