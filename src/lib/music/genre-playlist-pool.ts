import { genreSearchKey, type MusicDiscoveryGenre } from './genre-catalog';

export const US_HIP_HOP_SCENES = [
  ['chicago-drill','Chicago drill',['Drill Chicago']],
  ['new-york-drill','New York drill',['Brooklyn drill','NY drill','Drill New York']],
  ['east-coast-hip-hop','East Coast hip hop',['East Coast rap','East Coast essentials']],
  ['west-coast-hip-hop','West Coast hip hop',['West Coast rap','West Coast essentials']],
  ['southern-hip-hop','Southern hip hop',['Southern rap','Dirty South','South Side essentials']],
  ['atlanta-rap','Atlanta rap',['Atlanta trap']],
  ['houston-rap','Houston rap',[]],
  ['memphis-rap','Memphis rap',['Memphis underground rap']],
  ['detroit-rap','Detroit rap',['Detroit Flint Michigan rap']],
  ['bay-area-rap','Bay Area rap',['Hyphy']],
  ['g-funk','G-funk',['G funk']],
  ['boom-bap','Boom bap',['Boombap']],
  ['jazz-rap','Jazz rap',['Jazzy hip hop','Jazz hip hop']],
  ['conscious-hip-hop','Conscious hip hop',['Conscious rap']],
  ['alternative-hip-hop','Alternative hip hop',['Alternative rap']],
  ['crunk','Crunk',[]],
  ['miami-bass','Miami bass',['Miami booty bass']],
  ['chopped-and-screwed','Chopped and screwed',['Chopped & screwed','Screwed and chopped']],
] as const;
export const isPlaylistScene = (slug: string) => slug === 'internet-classics' || US_HIP_HOP_SCENES.some(scene => scene[0] === slug);

// Vetted for early web, viral songs and creator music. Contents are fetched live,
// not bundled into Harbor. See the source review in the task handoff.
export const INTERNET_PLAYLISTS = [11799766821,14978443383,14478144483,5389738762,12658267603];
const INTERNET_QUERIES = ['meme songs','internet nostalgia','Parry Gripp'];
type Entry = Record<string, unknown>;
type FetchEntries = (path: string) => Promise<unknown[]>;
type Source = { meta: Entry; offset: number; ended: boolean };
type Page = { data: unknown[]; done: boolean; playlists: unknown[] };
type Session = { at: number; pages: Page[]; buffer: unknown[]; seen: Set<string>; ids: Set<number>; sources?: Source[]; pending?: Promise<void> };
const sessions = new WeakMap<FetchEntries, Map<string, Session>>();
const PAGE_SIZE = 24, SOURCE_CHUNK = 12, TTL = 15 * 60_000;
const object = (value: unknown): Entry => value && typeof value === 'object' ? value as Entry : {};
const word = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function playlistFitsScene(title: string, genre: MusicDiscoveryGenre): boolean {
  const name = ` ${genreSearchKey(title)} `;
  return [genre.name, ...genre.aliases].some(term => name.includes(` ${genreSearchKey(term)} `));
}

async function bounded<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length); let next = 0;
  await Promise.all(Array.from({length: Math.min(3,items.length)},async()=>{
    while(next < items.length) { const i = next++; try { results[i] = {status:'fulfilled',value:await run(items[i])}; } catch(reason) { results[i] = {status:'rejected',reason}; } }
  }));
  return results;
}

async function sourcesFor(genre: MusicDiscoveryGenre, entries: FetchEntries): Promise<Source[]> {
  const internet = genre.slug === 'internet-classics';
  const queries = internet ? INTERNET_QUERIES : [genre.name];
  const results = await bounded(queries,query=>entries(`search/playlist?q=${encodeURIComponent(query)}&limit=50`));
  if(results.every(result=>result.status === 'rejected')) throw new Error('Genre playlists unavailable');
  const found = new Map<number,Entry>();
  for(const result of results) if(result.status === 'fulfilled') for(const value of result.value) {
    const meta = object(value), id = Number(meta.id);
    if(!Number.isSafeInteger(id) || id <= 0 || found.has(id)) continue;
    if(internet ? !INTERNET_PLAYLISTS.includes(id) : !playlistFitsScene(word(meta.title),genre)) continue;
    if(typeof meta.nb_tracks === 'number' && meta.nb_tracks <= 0) continue;
    found.set(id,meta);
  }
  // Search ranking changes; retained, reviewed lists remain addressable by ID.
  if(internet) {
    const titles = ['Memes Songs',"2000’s Internet Nostalgia","2010’s internet nostalgia",'100% Parry Gripp','old internet nostalgia!'];
    INTERNET_PLAYLISTS.forEach((id,i)=>{if(!found.has(id))found.set(id,{id,title:titles[i]});});
  }
  const rank = (meta: Entry) => {
    const title = genreSearchKey(word(meta.title)), terms = [genre.name,...genre.aliases].map(genreSearchKey);
    return (terms.includes(title) ? 100 : terms.some(term=>title.startsWith(term+' ')) ? 50 : 0)
      + (/deezer.*editor/i.test(word(object(meta.user).name)) ? 20 : 0);
  };
  const selected = internet ? INTERNET_PLAYLISTS.map(id=>found.get(id)!) : [...found.values()].sort((a,b)=>rank(b)-rank(a)).slice(0,6);
  return selected.map(meta=>({meta,offset:0,ended:false}));
}

/** Stable merged pages, fetched only on entry/scroll, with three requests at most in flight. */
export async function loadGenrePlaylistPage(genre: MusicDiscoveryGenre, page: number, entries: FetchEntries): Promise<Page> {
  if(!Number.isSafeInteger(page) || page < 0) throw new Error('Invalid genre page');
  let cache = sessions.get(entries); if(!cache) { cache = new Map(); sessions.set(entries,cache); }
  let session = cache.get(genre.slug);
  if(!session || (page === 0 && !session.pending && Date.now()-session.at > TTL)) {
    session = {at:Date.now(),pages:[],buffer:[],seen:new Set(),ids:new Set()}; cache.set(genre.slug,session);
    if(cache.size > 30) cache.delete(cache.keys().next().value!);
  }
  const state = session;
  while(state.pages.length <= page) {
    if(state.pending) { await state.pending; continue; }
    state.pending = (async()=>{
      state.sources ??= await sourcesFor(genre,entries);
      while(state.buffer.length < PAGE_SIZE && state.sources.some(source=>!source.ended)) {
        const active = state.sources.filter(source=>!source.ended);
        const results = await bounded(active,source=>entries(`playlist/${source.meta.id}/tracks?limit=${SOURCE_CHUNK}&index=${source.offset}`));
        results.forEach((result,i)=>{
          if(result.status !== 'rejected') return;
          const cause = object(object(result.reason).cause);
          // A removed/private playlist cannot recover on retry; a network failure can.
          if(cause.deezerCode === 800 || cause.status === 404) active[i].ended = true;
        });
        if(results.every(result=>result.status === 'rejected')) {
          if(state.buffer.length || active.every(source=>source.ended)) break;
          throw new Error('Genre tracks unavailable');
        }
        const lanes: unknown[][] = [];
        results.forEach((result,i)=>{if(result.status === 'fulfilled') {
          active[i].offset += result.value.length; active[i].ended = result.value.length < SOURCE_CHUNK; lanes.push(result.value);
        }});
        for(let i=0;i<SOURCE_CHUNK;i++) for(const lane of lanes) {
          const track = object(lane[i]), id = Number(track.id), artist = word(object(track.artist).name), title = word(track.title_short) || word(track.title);
          if(!Number.isSafeInteger(id) || id <= 0 || !title || !artist || track.readable === false || state.ids.has(id)) continue;
          const key = `${genreSearchKey(artist)}|${genreSearchKey(title.replace(/\s*\([^)]*remaster[^)]*\)|\s*-\s*\d{4}\s*remaster.*$/gi,''))}`;
          if(state.seen.has(key)) continue;
          state.seen.add(key); state.ids.add(id); state.buffer.push(track);
        }
        // Leave failed sources at their cursor; next request can retry them.
        if(results.some(result=>result.status === 'rejected') && state.buffer.length) break;
      }
      const data = state.buffer.splice(0,PAGE_SIZE);
      state.pages.push({data,done:!state.buffer.length && state.sources.every(source=>source.ended),playlists:state.sources.map(source=>source.meta)});
    })().finally(()=>{state.pending = undefined;});
    await state.pending;
    if(state.pages.at(-1)?.done && state.pages.length <= page) return {data:[],done:true,playlists:state.pages.at(-1)!.playlists};
  }
  return state.pages[page];
}
