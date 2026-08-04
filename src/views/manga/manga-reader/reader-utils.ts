export function measureAspect(src?: string): Promise<number> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(1.4);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img.naturalHeight / (img.naturalWidth || 1));
    img.onerror = () => resolve(1.4);
    img.src = src;
  });
}

export async function detectWebtoon(urls: string[]): Promise<boolean> {
  if (!urls.length) return false;
  const samples = [urls[0], urls[Math.floor(urls.length / 2)]].filter(Boolean);
  const aspects = await Promise.all(samples.map((s) => measureAspect(s)));
  return Math.max(...aspects) >= 2.2;
}
