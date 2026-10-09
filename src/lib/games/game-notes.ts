export type GameNote = { id: string; title: string; body: string; source?: { url: string; author: string } };
export type GameNotebook = { version: 1; revision: number; notes: GameNote[] };
export const NOTE_LIMIT = 100, NOTE_BODY_LIMIT = 100_000, NOTE_STORE_LIMIT = 2 * 1024 * 1024;
export const emptyNotebook = (): GameNotebook => ({ version: 1, revision: 0, notes: [] });
export const notebookDrafts = new Map<string, { raw: string | null; notes: GameNote[] }>();
const generations = new Map<string, number>();
/** Removing a profile clears only its notes, including drafts and queued writes. */
export function purgeGameNotes(profile: string) {
  const prefix = `harbor.games.notes.v1:${encodeURIComponent(profile)}:`;
  generations.set(profile, (generations.get(profile) ?? 0) + 1);
  for (const key of notebookDrafts.keys()) if (key.startsWith(prefix)) notebookDrafts.delete(key);
  for (let index = localStorage.length - 1; index >= 0; index--) { const key = localStorage.key(index); if (key?.startsWith(prefix)) localStorage.removeItem(key); }
}
export function notebookKey(profile: string, game: string) {
  if (!profile || !game || profile.length > 512 || game.length > 4200 || /[\x00-\x1f]/.test(profile + game)) throw Error("games.notes.readError");
  return `harbor.games.notes.v1:${encodeURIComponent(profile)}:${encodeURIComponent(game)}`;
}
export function noteUrl(raw: string): string | undefined {
  try { const url = new URL(raw); return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
export function parseNotebook(raw: string | null): GameNotebook {
  if (raw === null) return emptyNotebook();
  if (raw.length > NOTE_STORE_LIMIT || new TextEncoder().encode(raw).length > NOTE_STORE_LIMIT) throw Error("games.notes.limit");
  let value: GameNotebook;
  try { value = JSON.parse(raw); } catch { throw Error("games.notes.readError"); }
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.notes)) throw Error("games.notes.readError");
  if (value.notes.length > NOTE_LIMIT) throw Error("games.notes.limit");
  const seen = new Set<string>();
  const notes = value.notes.map(note => {
    if (!note || typeof note.id !== "string" || !/^[\w-]{1,80}$/.test(note.id) || seen.has(note.id) || typeof note.title !== "string" || !note.title.trim() || note.title.length > 120 || /[\x00-\x1f]/.test(note.title) || typeof note.body !== "string" || note.body.includes("\0")) throw Error("games.notes.readError");
    if (note.body.length > NOTE_BODY_LIMIT) throw Error("games.notes.limit");
    seen.add(note.id);
    if (note.source !== undefined && (!note.source || typeof note.source !== "object" || typeof note.source.url !== "string" || note.source.url.length > 4096 || !noteUrl(note.source.url) || typeof note.source.author !== "string" || note.source.author.length > 500)) throw Error("games.notes.readError");
    return { id: note.id, title: note.title, body: note.body, ...(note.source ? { source: { url: note.source.url, author: note.source.author } } : {}) };
  });
  return { version: 1, revision: value.revision, notes };
}
export function moveGameNote(notes: GameNote[], id: string, direction: -1 | 1): GameNote[] {
  const index = notes.findIndex(note => note.id === id), next = index + direction;
  if (index < 0 || next < 0 || next >= notes.length) return notes;
  const result = [...notes]; [result[index], result[next]] = [result[next], result[index]]; return result;
}
/** Suppress duplicate imported bodies; retain original IDs and the order of existing notes. */
export function mergeGameNotes(existing: GameNote[], incoming: GameNote[], replace: boolean): GameNote[] {
  const next = replace ? [] : [...existing], ids = new Set(next.map(note => note.id)), bodies = new Set(next.map(note => note.body.trim()));
  for (const note of incoming) {
    if (bodies.has(note.body.trim())) continue;
    const id = ids.has(note.id) ? crypto.randomUUID() : note.id;
    next.push({ ...note, id }); ids.add(id); bodies.add(note.body.trim());
  }
  return parseNotebook(JSON.stringify({ version: 1, revision: 0, notes: next })).notes;
}
const pending = new Map<string, Promise<unknown>>();
export async function saveNotebook(profile: string, game: string, expected: string | null, notes: GameNote[]) {
  const key = notebookKey(profile, game);
  const generation = generations.get(profile) ?? 0;
  // Validate and snapshot the draft before waiting for another writer.
  const draft = parseNotebook(JSON.stringify({ version: 1, revision: 0, notes })).notes;
  const commit = () => {
    if (generation !== (generations.get(profile) ?? 0)) throw Error("games.notes.conflict");
    const raw = localStorage.getItem(key);
    if (raw !== expected) throw Error("games.notes.conflict");
    const current = parseNotebook(raw);
    const next = parseNotebook(JSON.stringify({ version: 1, revision: current.revision + 1, notes: draft }));
    const saved = JSON.stringify(next);
    try { localStorage.setItem(key, saved); } catch { throw Error("games.notes.saveError"); }
    return { data: next, raw: saved };
  };
  const task = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(() => typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request(key, commit) : commit());
  pending.set(key, task);
  try { return await task; } finally { if (pending.get(key) === task) pending.delete(key); }
}
