import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { customLaunchHealth, inspectCustomLaunches, launchConfigKey, launchHealthObservation, type CustomLaunchHealthMap } from "@/lib/games/custom-launch-health";
import type { CustomGame } from "@/lib/games/custom-library";

export function useCustomLaunchHealth(profile: string, games: CustomGame[], active: boolean, available: boolean) {
  const [state, setState] = useState<{ profile: string; values: CustomLaunchHealthMap }>({ profile, values: {} });
  const [scan, setScan] = useState({ profile, pending: false }), [revision, setRevision] = useState(0);
  const latest = useRef({ profile, games }), cache = useRef(state), force = useRef(false);
  const observations = useRef(new Map<string, number>());
  // Native filesystem calls cannot be cancelled. A new scan waits for the old workers to drain.
  const queue = useRef(Promise.resolve());
  latest.current = { profile, games }; cache.current = state;
  const signature = JSON.stringify(games.map(game => [game.id, launchConfigKey(game.config), !!game.launchPending]));
  useEffect(() => {
    if (!active || !available) { setScan({ profile, pending: false }); return; }
    const controller = new AbortController();
    setScan({ profile, pending: true });
    const current = () => !controller.signal.aborted && latest.current.profile === profile;
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (!current()) return;
      const forced = force.current, previous = cache.current.profile === profile ? cache.current.values : {};
      const pending = games.filter(game => { if(game.launchPending)return false;const known = customLaunchHealth(game, previous); return forced || !known || Date.now() - known.checkedAt >= 60_000; });
      const versions = new Map(pending.map(game => [game.id, observations.current.get(`${profile}:${game.id}`) ?? 0]));
      await inspectCustomLaunches(pending, config => invoke("games_validate_custom_launch", { config }), controller.signal, (id, result) => {
        const game = latest.current.games.find(item => item.id === id);
        if (!current() || !game || launchConfigKey(game.config) !== result.configKey || versions.get(id) !== (observations.current.get(`${profile}:${id}`) ?? 0)) return;
        setState(old => ({ profile, values: { ...(old.profile === profile ? old.values : {}), [id]: result } }));
      });
      if (current()) { force.current = false; setScan({ profile, pending: false }); }
    });
    return () => controller.abort();
  }, [profile, active, available, signature, revision]);
  useEffect(() => {
    if (!active || !available) return;
    const focus = () => setRevision(value => value + 1);
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [active, available]);
  const health = useMemo(() => Object.fromEntries(games.flatMap(game => { const value = state.profile === profile ? customLaunchHealth(game,state.values) : undefined; return value ? [[game.id,value]] : []; })), [state,profile,games]);
  const checking = active && available && (scan.profile === profile && scan.pending || games.some(game => !customLaunchHealth(game, health)));
  const reportFailure = (game: CustomGame, error: unknown) => {
    const result = launchHealthObservation(game.config, error ?? Error("launch_failed"));
    if (result.state !== "attention" || latest.current.profile !== profile || !latest.current.games.some(item => item.id === game.id && launchConfigKey(item.config) === result.configKey)) return;
    // Definitive Play validation supersedes a background check that started earlier.
    const key = `${profile}:${game.id}`;
    observations.current.set(key, (observations.current.get(key) ?? 0) + 1);
    setState(old => ({ profile, values: { ...(old.profile === profile ? old.values : {}), [game.id]: result } }));
  };
  return { health, checking, reportFailure, recheck: () => { force.current = true; setRevision(value => value + 1); } };
}
