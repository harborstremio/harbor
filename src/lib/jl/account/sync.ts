import { useEffect, useSyncExternalStore } from "react";
import { activeProfileId } from "@/lib/active-profile-id";
import {
  readJlFavorites,
  subscribeJlFavoriteChanges,
  writeJlFavorites,
  type JlFavoritePlayer,
} from "@/lib/jl/sports/favorites";
import { playerForFollow } from "@/lib/jl/sports/people";
import {
  assertJlAccountCurrent,
  jlAccountContext,
  jlRest,
  useJlSession,
  type JlAccountContext,
} from "./client";
import {
  diffRows,
  parseFavoriteRows,
  playerToRow,
  rowsToFavorites,
  teamToRow,
  type MediaFavoriteRow,
  type RemoteFavoriteRow,
} from "./mapping";
import { createJlLinkStore, type JlLink } from "./profile-links";
import { syncFavoriteRows } from "./favorites-sync";
import { syncJlProfileData } from "./profile-data-sync";
import { setJlSyncStatus } from "./sync-status";

export type { JlLink } from "./profile-links";
export type JlProfile = { id: string; owner: string; name: string; avatar: string | null };
export type JlProfileContext = {
  account: JlAccountContext;
  localId: string;
  revision: number;
  signal?: AbortSignal;
};
const PULL_EVERY_MS = 30_000;
const links = createJlLinkStore({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
const PROFILE_SELECT = "id,owner,name,avatar";

if (typeof window !== "undefined") {
  window.addEventListener("harbor:active-profile-changed", () => links.changedExternally());
  window.addEventListener("storage", (event) => {
    if (
      event.key === null ||
      event.key.startsWith("jl.account.link.") ||
      event.key === "harbor.profiles.v1"
    )
      links.changedExternally();
  });
}

export function jlProfileContext(): JlProfileContext {
  const account = jlAccountContext();
  if (!account) throw new Error("Not signed in");
  const localId = activeProfileId();
  links.read(localId);
  return { account, localId, revision: links.revision() };
}

function assertProfileContext(context: JlProfileContext): void {
  if (context.signal?.aborted) throw new Error("JL profile selection cancelled");
  assertJlAccountCurrent(context.account);
  links.read(context.localId);
  if (activeProfileId() !== context.localId || links.revision() !== context.revision) {
    throw new Error("JL profile changed. Try again.");
  }
}

/** Explicit user selections may supersede a pending automatic selection, but never another owner. */
export function refreshJlProfileContext(context: JlProfileContext): JlProfileContext {
  assertJlAccountCurrent(context.account);
  if (activeProfileId() !== context.localId) throw new Error("JL profile changed. Try again.");
  return jlProfileContext();
}

function readLink(): JlLink | null {
  const account = jlAccountContext();
  return account ? links.link(activeProfileId(), account.userId) : null;
}

export function useJlLink(): JlLink | null {
  useJlSession();
  return useSyncExternalStore(links.subscribe, readLink, () => null);
}

async function ok(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`JL sync failed (${res.status})`);
  return res;
}

function profilesFrom(value: unknown, accountId: string): JlProfile[] {
  if (!Array.isArray(value)) throw new Error("Invalid JL profiles response");
  return value.map((v: Partial<JlProfile>) => {
    if (
      !v ||
      typeof v.id !== "string" ||
      v.owner !== accountId ||
      typeof v.name !== "string" ||
      !(v.avatar === null || typeof v.avatar === "string")
    )
      throw new Error("Invalid JL profile");
    return { id: v.id, owner: v.owner, name: v.name, avatar: v.avatar };
  });
}

export async function listJlProfiles(context = jlProfileContext()): Promise<JlProfile[]> {
  assertProfileContext(context);
  const res = await ok(
    await jlRest(
      `profiles?select=${PROFILE_SELECT}&order=position,created_at`,
      {},
      context.account,
    ),
  );
  const profiles = profilesFrom(await res.json(), context.account.userId);
  assertProfileContext(context);
  return profiles;
}

export function linkJlProfile(profile: JlProfile, context = jlProfileContext()): void {
  assertProfileContext(context);
  if (profile.owner !== context.account.userId)
    throw new Error("JL profile belongs to another account");
  const previous = links.read(context.localId);
  if (previous?.profileId && previous.profileId !== profile.id && previous.status !== "pending") {
    throw new Error(
      "This local profile already belongs to another JL profile. Create or choose a separate local profile first; its saved data will be preserved.",
    );
  }
  links.write(context.localId, {
    accountId: profile.owner,
    profileId: profile.id,
    name: profile.name,
    merged: false,
    status: "linked",
  });
  void syncNow();
}

export function unlinkJlProfile(): void {
  const context = jlProfileContext();
  const previous = links.read(context.localId);
  links.write(context.localId, {
    accountId: context.account.userId,
    profileId: previous?.profileId ?? "",
    name: previous?.name ?? "",
    merged: false,
    status: "manual",
  });
}

/** Persist a proposed UUID before the request, so retrying a lost response cannot duplicate it. */
export async function createAndLinkJlProfile(
  name: string,
  avatar: string | null = null,
  context = jlProfileContext(),
): Promise<void> {
  assertProfileContext(context);
  const previous = links.read(context.localId);
  const id =
    previous?.accountId === context.account.userId && previous.status === "pending"
      ? previous.profileId
      : crypto.randomUUID();
  links.write(
    context.localId,
    { accountId: context.account.userId, profileId: id, name, merged: false, status: "pending" },
    true,
  );
  const pending = { ...jlProfileContext(), signal: context.signal };
  await ok(
    await jlRest(
      "profiles?on_conflict=id",
      {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({ id, name: name.trim().slice(0, 40) || "Me", avatar }),
      },
      pending.account,
    ),
  );
  assertProfileContext(pending);
  const res = await ok(
    await jlRest(
      `profiles?select=${PROFILE_SELECT}&id=eq.${encodeURIComponent(id)}`,
      {},
      pending.account,
    ),
  );
  const [profile] = profilesFrom(await res.json(), pending.account.userId);
  assertProfileContext(pending);
  if (!profile) throw new Error("JL profile was not created");
  linkJlProfile(profile, pending);
}

/** Only bootstrap an empty account; existing profiles require an explicit UUID selection. */
export async function autoLinkJlProfile(
  name: string,
  avatar: string | null,
  context = jlProfileContext(),
): Promise<void> {
  assertProfileContext(context);
  if (!links.canAutoCreate(context.localId, context.account.userId)) return;
  const profiles = await listJlProfiles(context);
  const pending = links.read(context.localId);
  if (pending?.status === "pending" && pending.accountId === context.account.userId) {
    const profile = profiles.find((p) => p.id === pending.profileId);
    if (profile) {
      linkJlProfile(profile, context);
      return;
    }
  } else if (
    profiles.length &&
    localStorage.getItem(`jl.account.profile-created.v1.${context.localId}`) !== "1"
  )
    return;
  await createAndLinkJlProfile(name, avatar, context);
}

function localRows(profileId: string): MediaFavoriteRow[] {
  const { teams, players } = readJlFavorites();
  return [
    ...teams.map((t) => teamToRow(profileId, t)),
    ...players.map((p) => playerToRow(profileId, p)),
  ].filter((row): row is MediaFavoriteRow => !!row);
}

type Scope = {
  account: JlAccountContext;
  localId: string;
  link: JlLink;
  key: string;
  revision: number;
};
function scopeNow(): Scope | null {
  const account = jlAccountContext();
  const link = readLink();
  if (!account || !link) return null;
  const localId = activeProfileId();
  return {
    account,
    localId,
    link,
    revision: links.revision(),
    key: `jl.account.favorites.base.v1.${account.userId}.${localId}.${link.profileId}`,
  };
}
function assertScope(scope: Scope): void {
  assertJlAccountCurrent(scope.account);
  const current = readLink();
  if (
    activeProfileId() !== scope.localId ||
    current?.profileId !== scope.link.profileId ||
    current.accountId !== scope.link.accountId ||
    links.revision() !== scope.revision
  ) {
    throw new Error("JL profile changed");
  }
}

async function pullRows(scope: Scope): Promise<RemoteFavoriteRow[]> {
  assertScope(scope);
  const res = await ok(
    await jlRest(
      `favorites?select=kind,item_id,meta&kind=in.(team,player)&profile_id=eq.${encodeURIComponent(scope.link.profileId)}`,
      {},
      scope.account,
    ),
  );
  const rows = parseFavoriteRows(await res.json());
  assertScope(scope);
  return rows;
}

async function pushDiff(
  scope: Scope,
  desired: RemoteFavoriteRow[],
  remote: RemoteFavoriteRow[],
): Promise<void> {
  const { upsert, remove } = diffRows(
    desired.map((row) => ({ ...row, profile_id: scope.link.profileId })),
    remote,
  );
  assertScope(scope);
  if (upsert.length)
    await ok(
      await jlRest(
        "favorites?on_conflict=profile_id,kind,item_id",
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(upsert),
        },
        scope.account,
      ),
    );
  for (const row of remove) {
    assertScope(scope);
    const q = `profile_id=eq.${encodeURIComponent(scope.link.profileId)}&kind=eq.${row.kind}&item_id=eq.${encodeURIComponent(row.item_id)}`;
    await ok(
      await jlRest(
        `favorites?${q}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
        scope.account,
      ),
    );
  }
}

let applyingRemote = false;
const runs = new Map<string, { again: boolean; promise: Promise<void> }>();

function applyRows(scope: Scope, rows: RemoteFavoriteRow[]): void {
  assertScope(scope);
  const fromRemote = rowsToFavorites(rows, readJlFavorites().players);
  applyingRemote = true;
  try {
    writeJlFavorites({ teams: fromRemote.teams, players: fromRemote.players }, true);
  } finally {
    applyingRemote = false;
  }
}

/** Enrichment cannot restore membership that was removed while a lookup was in flight. */
async function enrichPlayers(scope: Scope): Promise<void> {
  assertScope(scope);
  const unresolved = readJlFavorites().players.filter((p) => !p.teamId);
  if (!unresolved.length) return;
  const looked = await Promise.all(
    unresolved.map((p) =>
      playerForFollow({
        kind: "player",
        league: p.league,
        id: p.id,
        name: p.name,
        subtitle: "",
        image: null,
      }).catch(() => p),
    ),
  );
  assertScope(scope);
  const byKey = new Map(looked.map((p) => [`${p.league}:${p.id}`, p]));
  const players: JlFavoritePlayer[] = readJlFavorites().players.map((p) =>
    p.teamId ? p : (byKey.get(`${p.league}:${p.id}`) ?? p),
  );
  applyingRemote = true;
  try {
    writeJlFavorites({ players });
  } finally {
    applyingRemote = false;
  }
}

async function runSync(scope: Scope): Promise<number> {
  const conflicts = await syncJlProfileData({
    account: scope.account,
    localId: scope.localId,
    profileId: scope.link.profileId,
    assertCurrent: () => assertScope(scope),
  });
  await syncFavoriteRows({
    assertCurrent: () => assertScope(scope),
    readBase: () => {
      try {
        const raw = localStorage.getItem(scope.key);
        return raw ? parseFavoriteRows(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },
    writeBase: (rows) => {
      localStorage.setItem(scope.key, JSON.stringify(rows));
    },
    readLocal: () => localRows(scope.link.profileId),
    writeLocal: (rows) => applyRows(scope, rows),
    pull: () => pullRows(scope),
    push: (desired, remote) => pushDiff(scope, desired, remote),
  });
  assertScope(scope);
  // Resolution is supplemental. Membership and its checkpoint are already durable.
  void enrichPlayers(scope).catch(() => {});
  return conflicts;
}

/** User-initiated local recovery export; contains only allowlisted sync records, never service keys. */
export async function saveJlSyncConflictBackup(): Promise<void> {
  const scope = scopeNow();
  if (!scope) throw new Error("Choose a linked JL profile first.");
  assertScope(scope);
  const key = `jl.account.data.base.v1.${scope.account.userId}.${scope.localId}.${scope.link.profileId}.conflicts`;
  const conflicts = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
  if (!Array.isArray(conflicts) || !conflicts.length)
    throw new Error("There are no saved sync conflicts for this profile.");
  const text = JSON.stringify({ version: 1, profile: scope.link.name, conflicts }, null, 2);
  if ("__TAURI_INTERNALS__" in window) {
    const [{ save }, { writeTextFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const path = await save({
      defaultPath: "JL-profile-conflicts.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    assertScope(scope);
    if (path) await writeTextFile(path, text);
  } else {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "JL-profile-conflicts.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function syncNow(): Promise<void> {
  const scope = scopeNow();
  if (!scope) return Promise.resolve();
  const key = `${scope.key}.${scope.account.generation}.${scope.revision}`;
  const running = runs.get(key);
  if (running) {
    running.again = true;
    return running.promise;
  }
  const run = { again: false, promise: Promise.resolve() };
  setJlSyncStatus({ phase: "syncing", message: "Syncing JL profile changes…" });
  run.promise = (async () => {
    let conflicts = 0;
    do {
      run.again = false;
      conflicts = await runSync(scope);
    } while (run.again);
    setJlSyncStatus({
      phase: "idle",
      message: conflicts
        ? `Synced with ${conflicts} saved conflicts. The account version won; your earlier edits are available in the conflict backup.`
        : "JL profile changes are synced. Configured addon URLs and device-only settings stay local.",
    });
  })()
    .catch(() => {
      // Keep both local pending values and the old base; focus/online/interval retries.
      try {
        assertScope(scope);
        setJlSyncStatus({
          phase: "pending",
          message: "Changes are saved on this device. Account sync will retry when available.",
        });
      } catch {
        /* An older account must not replace the current status. */
      }
    })
    .finally(() => {
      if (runs.get(key) === run) runs.delete(key);
    });
  runs.set(key, run);
  return run.promise;
}

export function useJlSync(): void {
  const session = useJlSession();
  const link = useJlLink();
  const accountId = session?.userId ?? "";
  const localId = activeProfileId();
  const linkedProfile = link?.profileId ?? "";
  useEffect(() => {
    if (!accountId || !linkedProfile) return;
    const run = () => {
      void syncNow();
    };
    run();
    const timer = window.setInterval(run, PULL_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", run);
    window.addEventListener("jl:library-changed", run);
    const unsubscribe = subscribeJlFavoriteChanges(() => {
      if (!applyingRemote) run();
    });
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", run);
      window.removeEventListener("jl:library-changed", run);
      unsubscribe();
    };
  }, [accountId, localId, linkedProfile]);
}
