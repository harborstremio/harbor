import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { archiveError, mergeArchiveJob, type ArchiveJob } from "@/lib/games/archives";

export function useGameArchives(profile: string, active: boolean) {
  const [state, setState] = useState<{ profile: string; jobs: ArchiveJob[] }>({ profile, jobs: [] });
  const [error, setError] = useState("");
  const owner = useRef(profile); owner.current = profile;
  const jobsRef = useRef(state); jobsRef.current = state;
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const accept = (job: ArchiveJob) => { if (owner.current === profile && job.profile === profile) setState(previous => ({ profile, jobs: mergeArchiveJob(previous.profile === profile ? previous.jobs : [], job, profile) })); };
  useEffect(() => {
    setError("");
    if (!active || !isTauri()) return;
    let live = true, pending = false;
    const refresh = async () => {
      if (!live || pending) return; pending = true;
      const revisions = new Map((jobsRef.current.profile === profile ? jobsRef.current.jobs : []).map(job => [job.id, job.updatedAt]));
      try {
        const jobs = await invoke<ArchiveJob[]>("games_archive_jobs", { profile });
        if (live) setState(previous => ({ profile, jobs: jobs.reduce((items, job) => mergeArchiveJob(items, job, profile), previous.profile === profile ? previous.jobs.filter(job => jobs.some(current => current.id === job.id) || !revisions.has(job.id) || job.updatedAt > revisions.get(job.id)!) : []) }));
      } catch { /* A prior native version has no durable archive feed. */ }
      finally { pending = false; }
    };
    refreshRef.current = refresh;
    const stop = listen<ArchiveJob>("games:archive-job", ({ payload }) => { if (live) accept(payload); }).catch(() => () => {});
    void stop.then(() => refresh());
    const timer = window.setInterval(() => { if (jobsRef.current.profile === profile && jobsRef.current.jobs.some(job => job.status === "running")) void refresh(); }, 5000);
    window.addEventListener("focus", refresh);
    return () => { live = false; clearInterval(timer); window.removeEventListener("focus", refresh); void stop.then(unlisten => unlisten()); };
  }, [profile, active]);
  const action = async (job: ArchiveJob, action: "cancel" | "remove") => {
    if (job.profile !== profile) return;
    setError("");
    try {
      await invoke(action === "cancel" ? "games_cancel_archive" : "games_remove_archive_job", action === "cancel" ? { profile, operationId: job.id } : { profile, id: job.id });
      if (owner.current === profile) await refreshRef.current();
    } catch (reason) { if (owner.current === profile) setError(archiveError(reason)); }
  };
  return { profile, jobs: state.profile === profile ? state.jobs : [], accept, action, error, dismissError: () => setError(""), refresh: () => refreshRef.current() };
}
export type GameArchives = ReturnType<typeof useGameArchives>;
