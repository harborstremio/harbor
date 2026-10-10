import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { SkinModel } from "@/lib/games/minecraft-skin";

export type MinecraftSkin = { id: string; url: string; variant: SkinModel; active: boolean };
export type MinecraftCape = { id: string; url: string; name: string; active: boolean };
export type MinecraftProfile = { id: string; name: string; skins: MinecraftSkin[]; capes: MinecraftCape[] };
type Status = { configured: boolean; account: MinecraftProfile | null; updated_at: number | null };
type Challenge = { flow: string; user_code: string; verification_uri: string; expires_at: number; interval: number };
const ERROR_KEYS: Record<string, string> = {
  minecraft_app_config: "setup", minecraft_network: "network", minecraft_unavailable: "network", minecraft_rate_limit: "rateLimit",
  minecraft_reconnect: "reconnect", minecraft_expired: "expired", minecraft_declined: "declined", minecraft_not_owned: "notOwned", minecraft_no_profile: "notOwned",
  minecraft_xbox_profile: "xbox", minecraft_xbox_restricted: "restricted", minecraft_skin: "skinError", minecraft_cape: "skinError", minecraft_store: "storeError",
};
export const minecraftAccountError = (reason: unknown) => `games.minecraft.account.${ERROR_KEYS[String(reason)] ?? "error"}`;

export function useMinecraftAccount(profile: string, active: boolean) {
  const available = isTauri();
  const [status, setStatus] = useState<Status | null>(null), [challenge, setChallenge] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const mounted = useRef(true), pending = useRef(false), connecting = useRef(false), generation = useRef(0), statusRead = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current++; if (available) void invoke("games_minecraft_cancel", { profile, flow: null }).catch(() => {}); };
  }, [profile, available]);
  useEffect(() => {
    if (!available || !active || statusRead.current) return;
    statusRead.current = true;
    void invoke<Status>("games_minecraft_status", { profile }).then(value => { if (mounted.current) setStatus(value); }).catch(reason => { if (mounted.current) { statusRead.current = false; setError(minecraftAccountError(reason)); } });
  }, [available, active, profile]);
  const cancel = () => {
    if (!connecting.current && !challenge) return;
    connecting.current = false;
    generation.current++; setChallenge(null); setBusy(false); pending.current = false;
    if (available) void invoke("games_minecraft_cancel", { profile, flow: null }).catch(() => {});
  };
  useEffect(() => { if (!active && (challenge || connecting.current)) cancel(); }, [active]);
  const connect = async () => {
    if (!available || pending.current || challenge) return;
    pending.current = true; connecting.current = true; setBusy(true); setError(""); const ticket = ++generation.current;
    try {
      const value = await invoke<Challenge>("games_minecraft_begin", { profile });
      if (mounted.current && ticket === generation.current) setChallenge(value);
      else void invoke("games_minecraft_cancel", { profile, flow: value.flow }).catch(() => {});
    } catch (reason) { if (mounted.current && ticket === generation.current) setError(minecraftAccountError(reason)); }
    finally { if (mounted.current && ticket === generation.current) { connecting.current = false; setBusy(false); pending.current = false; } }
  };
  useEffect(() => {
    if (!challenge) return;
    let disposed = false; const ticket = generation.current;
    const timer = setTimeout(async () => {
      if (Date.now() >= challenge.expires_at * 1000) { cancel(); setError("games.minecraft.account.expired"); return; }
      try {
        const value = await invoke<{ pending: boolean; interval: number; status: Status | null }>("games_minecraft_poll", { profile, flow: challenge.flow });
        if (disposed || !mounted.current || ticket !== generation.current) return;
        if (value.pending) setChallenge({ ...challenge, interval: value.interval });
        else { if (value.status) setStatus(value.status); setChallenge(null); setError(""); }
      } catch (reason) {
        if (!disposed && mounted.current && ticket === generation.current) { cancel(); setError(minecraftAccountError(reason)); }
      }
    }, Math.max(5, challenge.interval) * 1000);
    return () => { disposed = true; clearTimeout(timer); };
  }, [challenge, profile]);
  const operation = async (command: string, args: Record<string, unknown> = {}) => {
    if (!available || pending.current) return false;
    pending.current = true; setBusy(true); setError(""); const ticket = generation.current;
    try {
      const value = await invoke<Status>(command, { profile, ...args });
      if (mounted.current && ticket === generation.current) { setStatus(value); return true; }
    } catch (reason) { if (mounted.current && ticket === generation.current) setError(minecraftAccountError(reason)); }
    finally { if (mounted.current && ticket === generation.current) { setBusy(false); pending.current = false; } }
    return false;
  };
  const disconnect = async () => {
    if (!available || pending.current) return;
    cancel(); pending.current = true; setBusy(true); setError("");
    try { await invoke("games_minecraft_disconnect", { profile }); if (mounted.current) setStatus(previous => ({ configured: previous?.configured ?? false, account: null, updated_at: null })); }
    catch (reason) { if (mounted.current) setError(minecraftAccountError(reason)); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return {
    available, status, challenge, busy, error, connect, cancel, disconnect,
    refresh: () => operation(status?.account ? "games_minecraft_refresh" : "games_minecraft_status"),
    applySkin: (png: string, variant: SkinModel) => operation("games_minecraft_apply_skin", { png, variant }),
    applyCape: (capeId: string | null) => operation("games_minecraft_apply_cape", { capeId }),
    texture: (kind: "skin" | "cape", id: string) => invoke<string>("games_minecraft_texture", { profile, kind, id }),
  };
}
export type MinecraftAccountController = ReturnType<typeof useMinecraftAccount>;
