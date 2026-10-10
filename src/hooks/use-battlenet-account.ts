import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { osClass } from "@/lib/platform";
import { battleNetAccountError, emptyBattleNetAccount, type BattleNetAccountStatus } from "@/lib/games/battlenet-account";

export function useBattleNetAccount(profile: string, active: boolean) {
  const available = isTauri() && osClass() === "windows";
  const [held, setHeld] = useState({ profile, value: emptyBattleNetAccount(), loaded: false });
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [preferences, setPreferences] = useState<{ profile: string; installed: boolean; uninstalled: boolean } | null>(null);
  const owner = useRef(profile), mounted = useRef(true), revision = useRef(0);
  owner.current = profile;
  const running = useRef<{ profile: string; request: string } | null>(null), lock = useRef(false);
  const stored = held.profile === profile ? held.value : emptyBattleNetAccount();
  const status = preferences?.profile === profile
    ? { ...stored, importInstalled: preferences.installed, importUninstalled: preferences.uninstalled }
    : stored;
  const loaded = held.profile === profile && held.loaded;
  const cancel = useCallback(() => {
    const operation = running.current; if (!operation) return;
    running.current = null; revision.current++; lock.current = false;
    void invoke("games_battlenet_cancel", operation).catch(() => {});
    if (mounted.current) setBusy(false);
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cancel(); }; }, [cancel]);
  useEffect(() => { cancel(); revision.current++; lock.current = false; setBusy(false); setPreferences(null); setError(null); }, [profile, cancel]);
  const update = useCallback(async (command: string, args: Record<string, unknown> = {}) => {
    if (!available || lock.current) return false;
    lock.current = true; const serial = ++revision.current; setBusy(true); setError(null);
    if (command === "games_battlenet_preferences") setPreferences({ profile, installed: args.installed as boolean, uninstalled: args.uninstalled as boolean });
    if (command === "games_battlenet_import") running.current = { profile, request: args.request as string };
    try {
      const value = await invoke<BattleNetAccountStatus>(command, { profile, ...args });
      if (mounted.current && owner.current === profile && serial === revision.current) setHeld({ profile, value, loaded: true });
      return serial === revision.current;
    } catch (reason) {
      if (mounted.current && owner.current === profile && serial === revision.current) {
        setError(battleNetAccountError(reason));
      }
      return false;
    } finally {
      if (serial === revision.current) { running.current = null; lock.current = false; if (mounted.current && owner.current === profile) { setBusy(false); setPreferences(null); } }
    }
  }, [available, profile]);
  const attempted = useRef("");
  useEffect(() => {
    if (!active || !available || loaded || attempted.current === profile) return;
    attempted.current = profile; void update("games_battlenet_account");
  }, [active, available, loaded, profile, update]);
  const importAccount = useCallback((fresh: boolean) => update("games_battlenet_import", { fresh, request: crypto.randomUUID() }), [update]);
  return { profile, available, status, loaded, busy, canCancel: busy && running.current?.profile === profile, error, cancel, connect: () => importAccount(true), refresh: () => importAccount(false),
    reload: () => update("games_battlenet_account"), disconnect: () => update("games_battlenet_disconnect"),
    preferences: (installed: boolean, uninstalled: boolean) => update("games_battlenet_preferences", { installed, uninstalled }),
    dismissError: () => setError(null) };
}
export type BattleNetAccount = ReturnType<typeof useBattleNetAccount>;
