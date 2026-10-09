export type ArtworkRole = 'loading' | 'launch';
export type ArtworkChoice = { id: string; name: string; kind: 'lottie' | 'image'; poster: string };
export const ARTWORK_KEY = 'harbor.custom-artwork.v1';
export const ARTWORK_MAX_BYTES = 8 * 1024 * 1024;
export const ARTWORK_ACCEPT = '.json,.lottie,.gif,.png,.jpg,.jpeg,.webp';

export function artworkChoice(value: unknown): ArtworkChoice | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<ArtworkChoice>;
  return typeof v.id === 'string' && /^[\w-]{1,80}$/.test(v.id) && typeof v.name === 'string' && v.name.length <= 200
    && (v.kind === 'image' || v.kind === 'lottie') && typeof v.poster === 'string' && v.poster.length < 200_000
    && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v.poster) ? v as ArtworkChoice : null;
}

/** Custom animations use the expression-free player and contain no external media. */
export function validateArtworkLottie(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid');
  const data = value as Record<string, unknown>;
  const number = (key: string) => typeof data[key] === 'number' && Number.isFinite(data[key]) ? data[key] as number : NaN;
  const width = number('w'), height = number('h'), fps = number('fr'), start = number('ip'), end = number('op');
  if (!(width > 0 && height > 0 && fps > 0 && end > start) || !Array.isArray(data.layers) || !data.layers.length) throw Error('invalid');
  if (width > 4096 || height > 4096 || fps > 120 || (end-start)/fps > 300 || data.layers.length > 500) throw Error('large');
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const compositions = new Map<string, Record<string, unknown>>();
  for (const asset of assets) {
    if (!asset || typeof asset !== 'object') throw Error('invalid');
    const a = asset as Record<string, unknown>;
    if (a.p !== undefined && (typeof a.p !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(a.p))) throw Error('external');
    if (a.p) { a.u = ''; a.e = 1; }
    if (typeof a.id === 'string' && Array.isArray(a.layers)) {
      if (compositions.has(a.id)) throw Error('invalid');
      compositions.set(a.id, a);
    }
  }
  let count = 0;
  const walk = (entry: unknown, depth: number) => {
    if (++count > 250_000 || depth > 64) throw Error('large');
    if (!entry || typeof entry !== 'object') return;
    const row = entry as Record<string, unknown>;
    if (typeof row.fPath === 'string' && row.fPath || row.ty === 6) throw Error('external');
    // Expressions can reference other files or execute code in the full player.
    if (typeof row.x === 'string') delete row.x;
    for (const child of Object.values(row)) walk(child,depth+1);
  };
  walk(data,0);
  const checked = new Set<string>();
  const checkComposition = (id:string, ancestors:Set<string>) => {
    if (ancestors.has(id) || ancestors.size > 32) throw Error('invalid');
    if (checked.has(id)) return;
    const composition = compositions.get(id); if (!composition) return;
    const path = new Set(ancestors).add(id);
    for (const layer of composition.layers as Record<string,unknown>[]) if (typeof layer?.refId === 'string') checkComposition(layer.refId,path);
    checked.add(id);
  };
  for (const id of compositions.keys()) checkComposition(id,new Set());
  return data;
}
