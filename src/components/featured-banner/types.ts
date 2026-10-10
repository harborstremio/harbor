export const FADE_MS = 700;

export type LightboxState = {
  images: string[];
  startIndex: number;
  title: string;
};

export function upsizeTmdb(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(/\/t\/p\/(w\d+|original)\//, "/t/p/w1280/");
}
