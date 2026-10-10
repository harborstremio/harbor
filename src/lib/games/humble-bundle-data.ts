const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown) => typeof v === 'string' ? v.trim().slice(0, 300) : '';
const date = (v: unknown) => { const s = text(v); return /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(s) ? Date.parse(`${s}Z`) : NaN; };
export type HumbleBundle = { name: string; url: string; endsAt: number; items: { name: string; amount: number | null; currency: string }[] };
export function humbleDocument(html: string, id: string): Record<string, unknown> {
  if (html.length > 4_000_000) throw Error('Bundle response too large');
  const script = html.match(new RegExp(`<script\\b[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`, 'i'));
  if (!script) throw Error('Bundle data unavailable');
  return object(JSON.parse(script[1]));
}
export function humbleBundlePaths(html: string, now = Date.now()): string[] {
  const games = object(object(humbleDocument(html, 'landingPage-json-data').data).games);
  if (!Array.isArray(games.mosaic)) throw Error('Bundle listing unavailable');
  const paths = games.mosaic.flatMap(group => {
    const products = object(group).products;
    return Array.isArray(products) ? products.flatMap(product => {
      const p = object(product), path = text(p.product_url);
      return /^\/games\/[a-z0-9-]+$/.test(path) && date(p['start_date|datetime']) <= now && date(p['end_date|datetime']) > now ? [path] : [];
    }) : [];
  });
  return [...new Set(paths)].slice(0, 30);
}
export function parseHumbleBundle(html: string, path: string, now = Date.now()): HumbleBundle | null {
  if (!/^\/games\/[a-z0-9-]+$/.test(path)) throw Error('Invalid bundle path');
  const data = object(humbleDocument(html, 'webpack-bundle-page-data').bundleData), basic = object(data.basic_data);
  const endsAt = date(basic['end_time|datetime']), name = text(basic.human_name);
  if (!name || !Number.isFinite(endsAt)) throw Error('Invalid bundle');
  if (endsAt <= now) return null;
  const tiers = Object.values(object(data.tier_display_data)).map(object).filter(t => t.sold_out === false);
  const included = new Set(tiers.flatMap(t => Array.isArray(t.tier_item_machine_names) ? t.tier_item_machine_names : []));
  const items = Object.entries(object(data.tier_item_data)).flatMap(([id, raw]) => {
    const item = object(raw), name = text(item.human_name);
    if (!included.has(id) || !name || item.item_content_type !== 'game') return [];
    const price = object(item['min_price|money']), currency = text(price.currency);
    return [{ name, amount: typeof price.amount === 'number' && price.amount >= 0 ? price.amount : null, currency: /^[A-Z]{3}$/.test(currency) ? currency : '' }];
  });
  return { name, endsAt, url: `https://www.humblebundle.com${path}`, items };
}
// Only exact titles after typography normalization. Editions, DLC and sequels stay distinct.
export const bundleTitle = (name: string) => name.replace(/[™®]/g, '').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
export function bundlesWithGame(bundles: HumbleBundle[], name: string, now = Date.now()) {
  return bundles.flatMap(bundle => {
    const items = bundle.items.filter(item => bundleTitle(item.name) === bundleTitle(name));
    return bundle.endsAt > now && items.length === 1 ? [{ ...bundle, item: items[0] }] : [];
  });
}
