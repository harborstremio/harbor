import { useEffect, useState, type RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SetupJob } from "@/lib/games/setup";

// A hero and an open dialog share one lease; no work for hidden views or older binaries.
const viewers = new Map<string, { profile: string; id: string; count: number; pending: boolean }>();
const lastRenewal = new Map<string, number>();
let heartbeat: number | undefined;
function observe() {
  if (document.visibilityState !== "visible") return;
  for (const [key, viewer] of viewers) {
    if (viewer.pending || Date.now() - (lastRenewal.get(key) ?? 0) < 3500) continue;
    viewer.pending = true;
    lastRenewal.delete(key); lastRenewal.set(key, Date.now());
    while (lastRenewal.size > 200) lastRenewal.delete(lastRenewal.keys().next().value!);
    void invoke("games_observe_setup", { profile: viewer.profile, id: viewer.id }).catch(() => {}).finally(() => { viewer.pending = false; });
  }
}
function visibility() {
  window.clearInterval(heartbeat); heartbeat = undefined;
  if (viewers.size && document.visibilityState === "visible") { observe(); heartbeat = window.setInterval(observe, 4000); }
}
export function useInstallerObservation(job: SetupJob | undefined, active: boolean, root: RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active || !job || !root.current) { setVisible(false); return; }
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [active, job?.id, root]);
  useEffect(() => {
    if (!active || !visible || job?.status !== "running" || !job.progress?.canObserve) return;
    const key = JSON.stringify([job.profile, job.id]), previous = viewers.get(key);
    if (previous) previous.count++;
    else viewers.set(key, { profile: job.profile, id: job.id, count: 1, pending: false });
    if (viewers.size === 1 && !previous) { document.addEventListener("visibilitychange", visibility); visibility(); }
    else if (!previous) observe();
    return () => {
      const viewer = viewers.get(key);
      if (viewer && --viewer.count === 0) viewers.delete(key);
      if (!viewers.size) { window.clearInterval(heartbeat); heartbeat = undefined; document.removeEventListener("visibilitychange", visibility); }
    };
  }, [active, visible, job?.id, job?.profile, job?.status, job?.progress?.canObserve]);
}
