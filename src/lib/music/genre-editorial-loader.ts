import { genreSearchKey } from './genre-catalog';
import { EDITORIAL_SCENES, sceneRecordings, SCENE_RECORDINGS_PER_PAGE, type SceneRecording } from './genre-editorial';

type Entry = { title?: string; title_short?: string; artist?: { name?: string }; contributors?: { name?: string }[] };
export function matchesSceneRecording(value: unknown, recording: SceneRecording): boolean {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Entry;
  const credits = [entry.artist?.name, ...(Array.isArray(entry.contributors) ? entry.contributors.map(artist => artist.name) : [])];
  if (!credits.some(name => typeof name === 'string' && genreSearchKey(name) === genreSearchKey(recording.artist))) return false;
  return !recording.title || [entry.title_short, entry.title].some(title => typeof title === 'string' && genreSearchKey(title) === genreSearchKey(recording.title!));
}

/** Only opened scenes fetch music. Three concurrent cached searches, no catalog-wide fan-out. */
export async function loadEditorialRecordings(slug: string, page: number, entries: (path: string) => Promise<unknown[]>): Promise<{ data: unknown[]; done: boolean }> {
  const scene = EDITORIAL_SCENES[slug];
  if (!scene || !Number.isSafeInteger(page) || page < 0) throw new Error('Unknown music scene');
  const recordings = sceneRecordings(slug, page), lanes: unknown[][] = new Array(recordings.length);
  let next = 0, failures = 0, full = false;
  await Promise.all(Array.from({length: Math.min(3, recordings.length)}, async () => {
    while (next < recordings.length) {
      const index = next++, recording = recordings[index];
      // The public endpoint can ignore advanced artist: filters. Plain search plus
      // exact returned credits prevents unrelated fallback hits entering the scene.
      const query = `${recording.artist} ${recording.title ?? ''}`.trim();
      try {
        const data = await entries(`search?q=${encodeURIComponent(query)}&limit=${recording.title ? 8 : 3}&index=${recording.title ? 0 : page * 3}`);
        if (!recording.title && data.length === 3) full = true;
        lanes[index] = data.filter(value => matchesSceneRecording(value, recording)).slice(0, recording.title ? 1 : 3);
      } catch { failures++; lanes[index] = []; }
    }
  }));
  if (recordings.length && failures === recordings.length) throw new Error('Music scene unavailable');
  const data = Array.from({length: scene.recordings ? 1 : 3}, (_,index) => lanes.flatMap(lane => lane[index] ? [lane[index]] : [])).flat();
  return {data, done: scene.recordings ? (page + 1) * SCENE_RECORDINGS_PER_PAGE >= scene.recordings.length : !full && failures === 0};
}
