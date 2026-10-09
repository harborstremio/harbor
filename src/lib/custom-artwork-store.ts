import { ARTWORK_KEY, artworkChoice, type ArtworkChoice, type ArtworkRole } from './custom-artwork-data';

type Choices = Record<ArtworkRole, ArtworkChoice | null>;
let raw: string | null | undefined;
let snapshot: Choices = {loading:null,launch:null};
const changed = 'harbor:custom-artwork';
const blobs = new Map<string,Promise<Blob>>();

export function readArtworkChoices(): Choices {
  let next: string | null;
  try { next = localStorage.getItem(ARTWORK_KEY); } catch { return snapshot; }
  if (next !== raw) {
    raw = next;
    try { const data = JSON.parse(next ?? '{}'); snapshot = {loading:artworkChoice(data?.loading),launch:artworkChoice(data?.launch)}; }
    catch { snapshot = {loading:null,launch:null}; }
  }
  return snapshot;
}
export function subscribeArtwork(listener: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === ARTWORK_KEY || event.key === null) listener(); };
  window.addEventListener(changed,listener); window.addEventListener('storage',storage);
  return () => { window.removeEventListener(changed,listener); window.removeEventListener('storage',storage); };
}
async function operation<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve,reject) => {
    const request = indexedDB.open('harbor-custom-artwork',1);
    let failed = false;
    const fail = () => { failed = true; clearTimeout(timer); reject(Error('storage')); };
    const timer = setTimeout(fail,3000);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => { clearTimeout(timer); if (failed) request.result.close(); else resolve(request.result); };
    request.onerror = request.onblocked = fail;
  });
  try { return await new Promise<T>((resolve,reject) => {
    const tx = db.transaction('assets',mode), request = work(tx.objectStore('assets'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(Error('storage'));
  }); } finally { db.close(); }
}
export function loadArtworkBlob(id: string): Promise<Blob> {
  let pending = blobs.get(id);
  if (!pending) {
    pending = operation('readonly',s=>s.get(id)).then(value=>{if (!(value instanceof Blob)) throw Error('missing');return value;});
    blobs.set(id,pending);
    if (blobs.size > 2) blobs.delete(blobs.keys().next().value!);
    void pending.catch(()=>{if(blobs.get(id)===pending)blobs.delete(id);});
  }
  return pending;
}
export async function saveArtwork(role: ArtworkRole, choice: ArtworkChoice | null, blob?: Blob) {
  const previous = readArtworkChoices()[role];
  if (choice) {
    if (!artworkChoice(choice) || !blob) throw Error('invalid');
    await operation('readwrite',s=>s.put(blob,choice.id));
  }
  try { localStorage.setItem(ARTWORK_KEY,JSON.stringify({...readArtworkChoices(),[role]:choice})); }
  catch {
    if (choice) await operation('readwrite',s=>s.delete(choice.id)).catch(()=>{});
    throw Error('storage');
  }
  if (choice && blob) blobs.set(choice.id,Promise.resolve(blob));
  readArtworkChoices(); window.dispatchEvent(new Event(changed));
  if (previous && previous.id !== choice?.id) {
    blobs.delete(previous.id);
    await operation('readwrite',s=>s.delete(previous.id)).catch(()=>{});
  }
}
