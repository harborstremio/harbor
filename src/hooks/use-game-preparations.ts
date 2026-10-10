import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { preparationError, mergePreparation, type PreparationChoice } from "@/lib/games/download-preparation";

export function useGamePreparations(profile: string, active: boolean, retainedIntake: boolean) {
  const [state, setState] = useState<{ profile: string; choices: PreparationChoice[] }>({ profile, choices: [] });
  const [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const owner = useRef(profile); owner.current = profile;
  const latest = useRef({ state, retainedIntake }); latest.current = { state, retainedIntake };
  const refreshRef = useRef<() => Promise<boolean>>(async () => false);
  const accept = (choice: PreparationChoice) => {
    if (owner.current === profile) setState(previous => ({ profile, choices: mergePreparation(previous.profile === profile ? previous.choices : [], choice, profile) }));
  };
  useEffect(() => {
    setError(""); setLoading(false);
    if (!active || !isTauri()) { refreshRef.current = async () => false; return; }
    let live = true, pending: Promise<boolean> | undefined;
    const refresh = () => {
      if (!live) return Promise.resolve(false);
      if (pending) return pending;
      setLoading(true);
      const before = latest.current.state.profile === profile ? latest.current.state.choices : [];
      pending = (async () => {
        try {
          const choices = await invoke<PreparationChoice[]>("games_preparation_choices", { profile });
          if (!live) return false;
          setState(previous => ({ profile, choices: choices.reduce((items, choice) => mergePreparation(items, choice, profile), previous.profile === profile ? previous.choices.filter(choice => !before.includes(choice)) : []) }));
          setError(""); return true;
        } catch (reason) { if (live) setError(preparationError(reason)); return false; }
        finally { pending = undefined; if (live) setLoading(false); }
      })();
      return pending;
    };
    refreshRef.current = refresh;
    const stop = listen<PreparationChoice>("games:preparation", ({ payload }) => { if (live) accept(payload); }).catch(reason => { if (live) setError(preparationError(reason)); return () => {}; });
    void stop.then(refresh);
    const timer = window.setInterval(() => {
      const value = latest.current;
      if (value.retainedIntake || value.state.profile === profile && value.state.choices.some(choice => ["waiting", "queued", "dispatching"].includes(choice.status))) void refresh();
    }, 5000);
    window.addEventListener("focus", refresh);
    return () => { live = false; clearInterval(timer); window.removeEventListener("focus", refresh); void stop.then(unlisten => unlisten()); };
  }, [profile, active]);
  return { choices: state.profile === profile ? state.choices : [], error, loading, refresh: () => refreshRef.current(), accept };
}
export type GamePreparations = ReturnType<typeof useGamePreparations>;
