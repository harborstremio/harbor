import { simklRequest, SimklApiError } from "./client";
import { fetchWatchedHistory, type SimklHistoryItem } from "./history";
import { getSession, subscribeSession } from "./session";

type SimklSettings = {
  user?: {
    name?: string;
    avatar?: string | null;
  };
};

export async function fetchSimklAvatar(): Promise<string | null> {
  try {
    const settings = await simklRequest<SimklSettings>("/users/settings", { method: "POST" });
    return settings.user?.avatar ?? null;
  } catch {
    return null;
  }
}

export type SimklAccountType = "free" | "vip" | "vip_plus" | "unknown";

export type SimklProfile = {
  userId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  joinedAt: string | null;
  bio: string | null;
  location: string | null;
  gender: string | null;
  accountType: SimklAccountType;
  profileUrl: string | null;
};

export type SimklProfileErrorReason =
  | "not-connected"
  | "unauthorized"
  | "throttled"
  | "network"
  | "server"
  | "malformed";

export type SimklProfileResult =
  | { ok: true; profile: SimklProfile }
  | { ok: false; reason: SimklProfileErrorReason; detail: string };

export type SimklProfileStats = {
  moviesCompleted: number;
  showsCompleted: number;
  totalCompleted: number;
  lastWatchedAt: string | null;
};

export type SimklProfileStatsResult =
  | { ok: true; stats: SimklProfileStats }
  | { ok: false; reason: "not-connected" | "indeterminate" };

type RawSettings = {
  user?: {
    name?: string | null;
    avatar?: string | null;
    joined_at?: string | null;
    bio?: string | null;
    loc?: string | null;
    gender?: string | null;
    url?: string | null;
  };
  account?: {
    id?: number | string | null;
    type?: string | null;
  };
};

const PROFILE_TTL_MS = 600000;

let cached: { at: number; token: string; profile: SimklProfile } | null = null;
let inflight: Promise<SimklProfileResult> | null = null;
let generation = 0;

subscribeSession(() => invalidateSimklProfileCache());

export function invalidateSimklProfileCache(): void {
  cached = null;
  inflight = null;
  generation += 1;
}

function str(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
}

function accountType(v: string | null | undefined): SimklAccountType {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "free" || s === "vip" || s === "vip_plus") return s;
  return "unknown";
}

function webUrl(v: string | null | undefined): string | null {
  const s = str(v);
  if (!s) return null;
  const abs = s.startsWith("//") ? `https:${s}` : s;
  return /^https:\/\/[^\s<>"']+$/i.test(abs) ? abs : null;
}

function mapProfile(input: unknown): SimklProfile | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as RawSettings;
  if (!raw.user || typeof raw.user !== "object") return null;
  const id = raw.account?.id;
  return {
    userId: id == null || id === "" ? null : String(id),
    displayName: str(raw.user.name) ?? getSession()?.username ?? null,
    avatarUrl: webUrl(raw.user.avatar),
    joinedAt: str(raw.user.joined_at),
    bio: str(raw.user.bio),
    location: str(raw.user.loc),
    gender: str(raw.user.gender),
    accountType: accountType(raw.account?.type),
    profileUrl: webUrl(raw.user.url),
  };
}

function classify(e: unknown): { reason: SimklProfileErrorReason; detail: string } {
  if (e instanceof SimklApiError) {
    if (e.status === 401) return { reason: "unauthorized", detail: e.message };
    if (e.status === 412) return { reason: "throttled", detail: e.message };
    return { reason: "server", detail: e.message };
  }
  return { reason: "network", detail: e instanceof Error ? e.message : String(e) };
}

async function pullProfile(token: string, gen: number): Promise<SimklProfileResult> {
  try {
    const raw = await simklRequest<RawSettings>("/users/settings", { method: "POST" });
    const profile = mapProfile(raw);
    if (!profile) {
      return { ok: false, reason: "malformed", detail: "settings response carried no user object" };
    }
    if (gen === generation) cached = { at: Date.now(), token, profile };
    return { ok: true, profile };
  } catch (e) {
    return { ok: false, ...classify(e) };
  }
}

export async function fetchSimklProfile(
  opts: { force?: boolean } = {},
): Promise<SimklProfileResult> {
  const session = getSession();
  if (!session) return { ok: false, reason: "not-connected", detail: "no simkl session" };
  if (opts.force) invalidateSimklProfileCache();
  if (cached && cached.token === session.accessToken && Date.now() - cached.at < PROFILE_TTL_MS) {
    return { ok: true, profile: cached.profile };
  }
  if (inflight) return inflight;
  const run = pullProfile(session.accessToken, generation);
  const clear = () => {
    if (inflight === run) inflight = null;
  };
  inflight = run;
  void run.then(clear, clear);
  return run;
}

export async function fetchSimklProfileStats(): Promise<SimklProfileStatsResult> {
  if (!getSession()) return { ok: false, reason: "not-connected" };
  let items: SimklHistoryItem[];
  try {
    items = await fetchWatchedHistory(Number.MAX_SAFE_INTEGER);
  } catch {
    return { ok: false, reason: "indeterminate" };
  }
  if (items.length === 0) return { ok: false, reason: "indeterminate" };

  let moviesCompleted = 0;
  let showsCompleted = 0;
  let lastWatchedAt: string | null = null;
  for (const it of items) {
    if (it.type === "movie") moviesCompleted += 1;
    else showsCompleted += 1;
    if (it.watchedAt && (lastWatchedAt === null || it.watchedAt > lastWatchedAt)) {
      lastWatchedAt = it.watchedAt;
    }
  }

  return {
    ok: true,
    stats: { moviesCompleted, showsCompleted, totalCompleted: items.length, lastWatchedAt },
  };
}
