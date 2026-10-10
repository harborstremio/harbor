import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const icons = new Map<string, Promise<string | null>>();
const waiting: Array<() => void> = [];
let reading = 0;
async function readIcon(profile: string, token: string, candidateId: string) {
  await new Promise<void>(resolve => { if (reading < 2) { reading++; resolve(); } else waiting.push(resolve); });
  try { return await invoke<string | null>("games_setup_icon", { profile, token, candidateId }); }
  finally { const next = waiting.shift(); if (next) next(); else reading--; }
}
function executableIcon(profile: string, token: string, candidateId: string) {
  const key = JSON.stringify([profile, token, candidateId]);
  let pending = icons.get(key);
  if (!pending) {
    pending = readIcon(profile, token, candidateId)
      .then(value => typeof value === "string" && value.length <= 350_000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) ? value : null)
      .catch(() => null);
    icons.set(key, pending);
    while (icons.size > 64) icons.delete(icons.keys().next().value!);
  }
  return pending;
}

/** A game window joining the library. Selecting it never starts the executable. */
export function LinkGameMark({ selected = false, size = 20 }: { selected?: boolean; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 19H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v4M3 8h17"/>
    <path d="M7 12v4m-2-2h4m5-1h.01m2 2h.01"/>
    {selected ? <path className="games-setup-link-confirm" d="m14 19 2.4 2.3L22 15.5"/> : <path className="games-setup-link-arrow" d="M13 19h8m-3-3 3 3-3 3"/>}
  </svg>;
}

/** A playable file, distinct from the separate add-to-library action. */
function ExecutableFileMark() {
  return <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 3H7a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10L16 3Z"/>
    <path d="M16 3v5a2 2 0 0 0 2 2h5"/>
    <path d="m12 13 6 4-6 4v-8Z" fill="currentColor" stroke="none"/>
  </svg>;
}

export function GameSetupIcon({ profile, token, candidateId }: { profile: string; token: string; candidateId: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<{ key: string; image: string | null; loading: boolean }>({ key: "", image: null, loading: true });
  const key = JSON.stringify([profile, token, candidateId]);
  useEffect(() => {
    let live = true, requested = false;
    const load = () => {
      if (requested || !live) return;
      requested = true;
      void executableIcon(profile, token, candidateId).then(image => { if (live) setState({ key, image, loading: false }); });
    };
    const observer = typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); load(); }
    }, { rootMargin: "80px" });
    if (observer && root.current) observer.observe(root.current); else load();
    return () => { live = false; observer?.disconnect(); };
  }, [profile, token, candidateId, key]);
  const current = state.key === key ? state : { image: null, loading: true };
  return <span ref={root} className={`games-setup-executable-icon${current.loading ? " is-loading" : ""}`} aria-hidden="true">
    {current.image ? <img src={current.image} alt="" draggable={false} onError={() => setState({ key, image: null, loading: false })}/> : !current.loading && <ExecutableFileMark/>}
  </span>;
}
