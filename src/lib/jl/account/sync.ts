import { useEffect, useSyncExternalStore } from "react";
import { activeProfileId } from "@/lib/active-profile-id";
import {
  readJlFavorites,
  subscribeJlFavoriteChanges,
  writeJlFavorites,
  type JlFavoritePlayer,
} from "@/lib/jl/sports/favorites";
import { playerForFollow } from "@/lib/jl/sports/people";
import { currentJlSession, jlRest, useJlSession } from "./client";
import { diffRows, playerToRow, rowsToFavorites, teamToRow, type MediaFavoriteRow, type RemoteFavoriteRow } from "./mapping";

/**
 * Keeps this device's followed teams and players in step with a JL Media Vision account profile, so
 * every device signed in to the same profile shows the same favorites.
 */

const LINK_KEY = "jl.account.link.v1";
const PULL_EVERY_MS = 5 * 60_000;

export type JlProfile = { id: string; name: string; avatar: string | null };
/** The JL profile this app profile syncs with; `merged` once the first two-way merge is done. */
export type JlLink = { profileId: string; name: string; merged: boolean };

const listeners = new Set<() => void>();
let cache: { key: string; raw: string | null; link: JlLink | null } | null = null;

function linkKey(): string {
  return `${LINK_KEY}.${activeProfileId()}`;
}

function readLink(): JlLink | null {
  const key = linkKey();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = null;
  }
  if (cache && cache.key === key && cache.raw === raw) return cache.link;
  let link: JlLink | null = null;
  try {
    const v = raw ? (JSON.parse(raw) as Partial<JlLink>) : null;
    if (v && typeof v.profileId === "string" && typeof v.name === "string") {
      link = { profileId: v.profileId, name: v.name, merged: v.merged === true };
    }
  } catch {
    link = null;
  }
  cache = { key, raw, link };
  return link;
}

function writeLink(link: JlLink | null): void {
  try {
    if (link) localStorage.setItem(linkKey(), JSON.stringify(link));
    else localStorage.removeItem(linkKey());
  } catch {
    /* storage unavailable: the link lasts until the app closes */
  }
  for (const fn of listeners) fn();
}

export function useJlLink(): JlLink | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    readLink,
    () => null,
  );
}

async function ok(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`JL sync failed (${res.status})`);
  return res;
}

export async function listJlProfiles(): Promise<JlProfile[]> {
  const res = await ok(await jlRest("profiles?select=id,name,avatar&order=position,created_at"));
  return (await res.json()) as JlProfile[];
}

export async function createJlProfile(name: string, avatar: string | null = null): Promise<JlProfile> {
  if (!currentJlSession()) throw new Error("Not signed in");
  const res = await ok(
    await jlRest("profiles?select=id,name,avatar", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ name: name.trim().slice(0, 40) || "Me", avatar }),
    }),
  );
  const [row] = (await res.json()) as JlProfile[];
  return row;
}

export function linkJlProfile(profile: JlProfile): void {
  writeLink({ profileId: profile.id, name: profile.name, merged: false });
  void syncNow();
}

export function unlinkJlProfile(): void {
  writeLink(null);
}

type RemoteRow = RemoteFavoriteRow;

async function pullRows(profileId: string): Promise<RemoteRow[]> {
  const res = await ok(
    await jlRest(`favorites?select=kind,item_id,meta&kind=in.(team,player)&profile_id=eq.${encodeURIComponent(profileId)}`),
  );
  return (await res.json()) as RemoteRow[];
}

function localRows(profileId: string): MediaFavoriteRow[] {
  const { teams, players } = readJlFavorites();
  return [
    ...teams.map((t) => teamToRow(profileId, t)),
    ...players.map((p) => playerToRow(profileId, p)),
  ].filter((r): r is MediaFavoriteRow => !!r);
}

async function pushDiff(profileId: string, remote: RemoteRow[]): Promise<void> {
  const { upsert, remove } = diffRows(localRows(profileId), remote);
  if (upsert.length) {
    await ok(
      await jlRest("favorites?on_conflict=profile_id,kind,item_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(upsert),
      }),
    );
  }
  for (const r of remove) {
    const q = [
      `profile_id=eq.${encodeURIComponent(profileId)}`,
      `kind=eq.${r.kind}`,
      `item_id=eq.${encodeURIComponent(r.item_id)}`,
    ].join("&");
    await ok(await jlRest(`favorites?${q}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }));
  }
}

/** Fills in team details for players followed on another device, so Game Day follows their teams. */
async function resolvePlayers(players: JlFavoritePlayer[], unresolved: JlFavoritePlayer[]): Promise<JlFavoritePlayer[]> {
  if (!unresolved.length) return players;
  const looked = await Promise.all(
    unresolved.map((p) =>
      playerForFollow({ kind: "player", league: p.league, id: p.id, name: p.name, subtitle: "", image: null }).catch(
        () => p,
      ),
    ),
  );
  const byKey = new Map(looked.map((p) => [`${p.league}:${p.id}`, p]));
  return players.map((p) => byKey.get(`${p.league}:${p.id}`) ?? p);
}

// The last remote state this device knows; local changes are pushed as a diff against it.
let lastRemote: { profileId: string; rows: RemoteRow[] } | null = null;
let applyingRemote = false;
let running: Promise<void> | null = null;
let pushQueue: Promise<void> = Promise.resolve();

async function runSync(): Promise<void> {
  const link = readLink();
  if (!link || !currentJlSession()) return;
  const remote = await pullRows(link.profileId);
  if (!link.merged) {
    // First link: keep everything from both sides, then send the union up.
    const local = readJlFavorites();
    const fromRemote = rowsToFavorites(remote, local.players);
    const has = (list: Array<{ league: string; id: string }>, x: { league: string; id: string }) =>
      list.some((y) => y.league === x.league && y.id === x.id);
    const teams = [...local.teams, ...fromRemote.teams.filter((t) => !has(local.teams, t))];
    const players = await resolvePlayers(
      [...local.players, ...fromRemote.players.filter((p) => !has(local.players, p))],
      fromRemote.unresolved,
    );
    applyingRemote = true;
    try {
      writeJlFavorites({ teams, players });
    } finally {
      applyingRemote = false;
    }
    await pushDiff(link.profileId, remote);
    writeLink({ ...link, merged: true });
    lastRemote = { profileId: link.profileId, rows: await pullRows(link.profileId) };
    return;
  }
  // After that the account is the source of truth for this profile.
  const local = readJlFavorites();
  const fromRemote = rowsToFavorites(remote, local.players);
  const players = await resolvePlayers(fromRemote.players, fromRemote.unresolved);
  applyingRemote = true;
  try {
    writeJlFavorites({ teams: fromRemote.teams, players });
  } finally {
    applyingRemote = false;
  }
  lastRemote = { profileId: link.profileId, rows: remote };
}

export function syncNow(): Promise<void> {
  running ??= runSync()
    .catch(() => {
      /* offline or signed out: the next focus or interval retries */
    })
    .finally(() => {
      running = null;
    });
  return running;
}

async function pushLocalChange(): Promise<void> {
  const link = readLink();
  if (applyingRemote || !link?.merged || !currentJlSession()) return;
  const base = lastRemote?.profileId === link.profileId ? lastRemote.rows : await pullRows(link.profileId);
  await pushDiff(link.profileId, base);
  lastRemote = { profileId: link.profileId, rows: localRows(link.profileId).map(({ kind, item_id, meta }) => ({ kind, item_id, meta })) };
}

/** Runs the sync while signed in and linked: on start, on focus, every few minutes, and on each change. */
export function useJlSync(): void {
  const session = useJlSession();
  const link = useJlLink();
  const active = !!session && !!link;
  const linkedProfile = link?.profileId ?? "";

  useEffect(() => {
    if (!active) return;
    void syncNow();
    const timer = window.setInterval(() => void syncNow(), PULL_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    const unsubscribe = subscribeJlFavoriteChanges(() => {
      // One push at a time, each against the state the previous one left.
      pushQueue = pushQueue.then(pushLocalChange).catch(() => {
        /* the next pull brings the account's state back */
      });
    });
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, [active, linkedProfile]);
}
