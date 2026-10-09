import { isLauncherGameId, launcherDispatchId, type LauncherGame, type LauncherScan } from "./launchers";

type Identity = { key: string; id: string; productId: string };
export type LauncherIdentities = { version: 1; entries: Identity[] };
export const launcherIdentityKey = "harbor.games.launcher-identities.v1";
const MAX_BYTES = 4 * 1024 * 1024;
const validKey = (key: unknown): key is string => typeof key === "string" && /^(?:machine|user):[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(key);
const validEaId = (id: unknown): id is string => typeof id === "string" && id.startsWith("ea:") && isLauncherGameId(id);
const overlaps = (left: string, right: string) => { const ids = new Set(left.split(",")); return right.split(",").some(id => ids.has(id)); };

export function parseLauncherIdentities(raw: string | null): LauncherIdentities {
  if (raw === null) return { version: 1, entries: [] };
  if (raw.length > MAX_BYTES) throw Error("launcher_identity_limit");
  const value = JSON.parse(raw) as LauncherIdentities;
  if (!value || value.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 2048) throw Error("launcher_identity_invalid");
  const keys = new Set<string>(), ids = new Set<string>();
  const entries = value.entries.map(entry => {
    if (!entry || !validKey(entry.key) || !validEaId(entry.id) || typeof entry.productId !== "string" || !validEaId(`ea:${entry.productId}`) || keys.has(entry.key) || ids.has(entry.id)) throw Error("launcher_identity_invalid");
    keys.add(entry.key); ids.add(entry.id);
    return { key: entry.key, id: entry.id, productId: entry.productId };
  });
  return { version: 1, entries };
}

function eligible(game: LauncherGame) {
  return game.launcher === "ea" && game.state === "installed" && validKey(game.installKey)
    && validEaId(game.id) && game.id === launcherDispatchId(game);
}

/** Registration and overlapping provider aliases must both agree; titles never establish identity. */
export function reconcileLauncherIdentities(scan: LauncherScan, previous: LauncherIdentities) {
  const entries = new Map(previous.entries.map(entry => [entry.key, entry]));
  const owners = new Map(previous.entries.map(entry => [entry.id, entry.key]));
  const counts = new Map<string, number>();
  for (const game of scan.games) if (validKey(game.installKey)) counts.set(game.installKey, (counts.get(game.installKey) ?? 0) + 1);
  const proposed = scan.games.map(game => {
    const key = game.installKey;
    if (!eligible(game) || !key || counts.get(key) !== 1) return { game, identity: null };
    const old = entries.get(key);
    if (old && !overlaps(old.productId, game.productId)) return { game, identity: null };
    // Another registered install can reuse content aliases. It must not inherit
    // the previous install's saved state simply because the other game is absent.
    const id = old?.id ?? (owners.has(game.id) ? `ea:install.${key.replace(":", ".")}` : game.id);
    return { game, identity: { key, id, productId: game.productId } };
  });
  const ids = new Map<string, number>();
  for (const { game, identity } of proposed) { const id = identity?.id ?? game.id; ids.set(id, (ids.get(id) ?? 0) + 1); }
  const games = proposed.map(({ game, identity }) => {
    if (!identity || ids.get(identity.id) !== 1) return game;
    entries.set(identity.key, identity);
    return { ...game, id: identity.id };
  });
  const identities = parseLauncherIdentities(JSON.stringify({ version: 1, entries: [...entries.values()] }));
  return { scan: { ...scan, games }, identities };
}

let pending: Promise<unknown> = Promise.resolve();
export function observeLauncherIdentities(scan: LauncherScan): Promise<LauncherScan> {
  if (!scan.games.some(eligible)) return Promise.resolve(scan);
  const commit = () => {
    const raw = localStorage.getItem(launcherIdentityKey);
    const next = reconcileLauncherIdentities(scan, parseLauncherIdentities(raw));
    const updated = JSON.stringify(next.identities);
    // Publish remapped IDs only after storage succeeds. Preferences remain in
    // their existing per-profile stores; this stores installation identity only.
    if (updated !== raw) localStorage.setItem(launcherIdentityKey, updated);
    return next.scan;
  };
  const result = pending.catch(() => {}).then(() => typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request(launcherIdentityKey, commit) : commit());
  pending = result;
  return result;
}
