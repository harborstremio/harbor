import { useEffect, useRef, useState } from "react";
import { fetchGameSource, inspectGameSource } from "@/lib/games/source-fetch";
import { verifySource } from "@/lib/games/source-verification";
import { sourceInputUrl } from "@/lib/games/source-discovery";
import { retainSourceArtwork } from "@/lib/games/source-artwork";
import { replaceGameSource, sameSourceRevision } from "@/lib/games/source-subscriptions";
import { readSourceCatalogs, writeSourceStore } from "@/lib/games/source-store";
import { sourceError, sourceUrl, sourceNeedsMetadataRefresh, type GameSource, type SourceManifest } from "@/lib/games/sources";

export function useGameSources(profile: string) {
  const [state, setState] = useState<{ profile: string; sources: GameSource[] }>({ profile, sources: [] });
  const [loading, setLoading] = useState(true), [ready, setReady] = useState(false), [error, setError] = useState("");
  const [busy, setBusy] = useState<string[]>([]);
  const [verifying, setVerifying] = useState<string[]>([]);
  const verifications = useRef(new Map<string, AbortController>());
  const current = useRef({ profile, sources: [] as GameSource[], loaded: false }), alive = useRef(true), owner = useRef(profile);
  const requests = useRef(new Map<string, AbortController>()), serial = useRef(Promise.resolve()), loadId = useRef(0);
  const inspections = useRef(new Set<AbortController>());
  const restore = useRef<AbortController | null>(null), lifetime = useRef(new AbortController());
  const session = useRef(0);
  const metadataRefreshes = useRef(new Set<string>());
  owner.current = profile;
  const valid = () => alive.current && owner.current === profile;
  const sources = state.profile === profile ? state.sources : [];
  const reload = async () => {
    if (!valid()) return;
    restore.current?.abort();
    const request = new AbortController(); restore.current = request;
    const id = ++loadId.current; setLoading(true); setError("");
    try { const list = await readSourceCatalogs(profile, request.signal); if (!request.signal.aborted && valid() && id === loadId.current) { current.current = { profile, sources: list, loaded: true }; setState({ profile, sources: list }); setReady(true); } }
    catch (error) { if (!request.signal.aborted && valid() && id === loadId.current) setError(sourceError(error)); }
    finally { if (restore.current === request) restore.current = null; if (!request.signal.aborted && valid() && id === loadId.current) setLoading(false); }
  };
  useEffect(() => { session.current++; lifetime.current = new AbortController(); metadataRefreshes.current.clear(); alive.current = true; current.current = { profile, sources: [], loaded: false }; setReady(false); setBusy([]); setVerifying([]); void reload(); return () => { session.current++; alive.current = false; restore.current?.abort(); restore.current = null; lifetime.current.abort(); for (const request of requests.current.values()) request.abort(); requests.current.clear(); verifications.current.clear(); for(const request of inspections.current)request.abort(); inspections.current.clear(); }; }, [profile]);
  const change = (update: (list: GameSource[]) => GameSource[]) => {
    const revision = session.current;
    const readSignal = lifetime.current.signal;
    const task = serial.current.catch(() => {}).then(async () => {
      if (!valid() || revision !== session.current || current.current.profile !== profile || !current.current.loaded) return false;
      const next = update(current.current.sources);
      if (next === current.current.sources) return true;
      const stored = await writeSourceStore(profile, next, true, readSignal);
      if (!valid() || revision !== session.current) return false;
      current.current = { profile, sources: stored, loaded: true }; setState({ profile, sources: stored }); setError("");
      return true;
    });
    serial.current = task.then(() => {}, () => {});
    return task.catch(error => { if (valid() && revision === session.current) setError(sourceError(error)); return false; });
  };
  const inspect = async (url: string, signal: AbortSignal, replacing?: string, verify = false, onVerified?: () => void) => {
    const revision = session.current;
    if (current.current.sources.some(source => source.id !== replacing && source.url === sourceInputUrl(url))) throw Error("source_duplicate");
    const request = new AbortController(); inspections.current.add(request);
    try {
      const combined = AbortSignal.any([signal, request.signal]);
      if (verify) { await verifySource(profile, sourceInputUrl(url) || url, combined); onVerified?.(); }
      const result = await inspectGameSource(url, combined, profile);
      if (!valid() || revision !== session.current) throw new DOMException("Source profile changed", "AbortError");
      if (result.kind === "catalog" && current.current.sources.some(source => source.id !== replacing && source.url === result.url)) throw Error("source_duplicate");
      return result;
    } finally { inspections.current.delete(request); }
  };
  const add = (url: string, manifest: SourceManifest) => change(list => {
    const canonical = sourceUrl(url);
    if (!canonical) throw Error("source_url");
    if (list.some(source => source.url === canonical)) throw Error("source_duplicate");
    return [...list, { ...manifest, id: crypto.randomUUID(), url: canonical, enabled: true, checkedAt: Date.now() }];
  });
  const refresh = async (source: GameSource, verify = false) => {
    if (requests.current.has(source.id)) return;
    const request = new AbortController(); requests.current.set(source.id, request); setBusy([...requests.current.keys()]);
    try {
      if (verify) {
        verifications.current.set(source.id, request); setVerifying(ids => [...ids, source.id]);
        try { await verifySource(profile, source.url, request.signal); }
        finally { if (valid() && verifications.current.get(source.id) === request) setVerifying(ids => ids.filter(id => id !== source.id)); }
      }
      request.signal.throwIfAborted();
      const manifest = await fetchGameSource(source.url, request.signal, source.website, source.name, profile, verify);
      if (valid() && !request.signal.aborted) await change(list => request.signal.aborted ? list : list.map(item => sameSourceRevision(item, source) ? { ...item, ...retainSourceArtwork(manifest, item), catalog: undefined, catalogIssue: undefined, checkedAt: Date.now(), error: undefined } : item));
    } catch (error) {
      if (valid() && !request.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) await change(list => request.signal.aborted ? list : list.map(item => sameSourceRevision(item, source) ? { ...item, error: sourceError(error) } : item));
    } finally { if (requests.current.get(source.id) === request) requests.current.delete(source.id); if (verifications.current.get(source.id) === request) verifications.current.delete(source.id); if (valid()) setBusy([...requests.current.keys()]); }
  };
  useEffect(() => {
    if (!ready || loading || busy.length) return;
    const source = sources.find(item => !item.catalogIssue && sourceNeedsMetadataRefresh(item) && !metadataRefreshes.current.has(item.id + ":" + item.url));
    if (!source) return;
    // Old snapshots discarded release-page links. Refresh once, serially; keep them usable on failure.
    metadataRefreshes.current.add(source.id + ":" + source.url);
    void refresh(source);
  }, [profile, ready, loading, sources, busy]);
  const replace = (reviewed: GameSource, url: string, manifest: SourceManifest) => {
    requests.current.get(reviewed.id)?.abort();
    return change(list => replaceGameSource(list, reviewed, url, manifest));
  };
  const remove = (id: string) => { requests.current.get(id)?.abort(); return change(list => list.filter(source => source.id !== id)); };
  const toggle = (id: string) => change(list => list.map(source => source.id === id ? { ...source, enabled: !source.enabled } : source));
  const cancelVerification = (id?: string) => { for (const [key, request] of verifications.current) if (!id || id === key) request.abort(); };
  return { profile, sources, loading, ready, error, busy, verifying, cancelVerification, verify: (source: GameSource) => refresh(source, true), reload, inspect, add, replace, refresh, remove, toggle, dismissError: () => setError("") };
}
export type GameSources = ReturnType<typeof useGameSources>;
