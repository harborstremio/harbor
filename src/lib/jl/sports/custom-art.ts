/**
 * The account owner's own sports art (media.custom_art + the private `media-art` bucket), so
 * the art they pick for a team, athlete or college follows their JL account to every device.
 *
 * Each row is one slot: `ref_id` names the subject ("team:<league>:<espnTeamId>",
 * "athlete:<league>:<espnId>", "college:<id>") and `kind` the slot (hero, wordmark, story, card,
 * wallpaper). Files live under `<owner>/<ref>/<kind>.<ext>`; the bucket is private, so images
 * are shown through signed URLs, which are refreshed before they expire.
 *
 * Plain module: the store takes its account ports (REST, Storage, session) from the caller, so
 * it can be exercised without a browser.
 */

export const ART_BUCKET = "media-art";

export const ART_KINDS = ["hero", "wordmark", "story", "card", "wallpaper"] as const;
export type ArtKind = (typeof ART_KINDS)[number];

/** What each slot is for, shown next to its upload button. */
export const ART_GUIDE: Record<ArtKind, { label: string; size: string; hint: string }> = {
  hero: { label: "Hero", size: "3840×2160", hint: "Keep the subject on the right half." },
  wordmark: { label: "Wordmark", size: "Transparent PNG", hint: "Shown over the hero art." },
  story: { label: "Story", size: "1080×1080", hint: "Game Stories bubble." },
  card: { label: "Card", size: "1920×1080", hint: "Live Sports Channels card." },
  wallpaper: { label: "Wallpaper", size: "3840×2160", hint: "Pinned page wallpaper." },
};

/**
 * Where a missing slot borrows its picture from. A missing wordmark has no picture: the views
 * set the team's name in display type instead.
 */
export const ART_FALLBACK: Record<ArtKind, ArtKind | null> = {
  hero: null,
  wordmark: null,
  story: "hero",
  card: "hero",
  wallpaper: "hero",
};

/** Image types the bucket accepts, with the extension each is stored under. */
export const ART_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Larger than this is refused before upload (the bucket enforces its own limit too). */
export const MAX_ART_BYTES = 15 * 1024 * 1024;

const SIGN_SECONDS = 24 * 3600;
// Signed URLs are renewed this long before they lapse, so an open page never shows a dead one.
const RENEW_BEFORE_MS = 60 * 60_000;
const RETRY_MS = 60_000;

const REF =
  /^(?:team:[a-z0-9-]{1,24}:[A-Za-z0-9._-]{1,40}|athlete:[a-z0-9-]{1,24}:[A-Za-z0-9._-]{1,40}|college:[A-Za-z0-9._:-]{1,60})$/;

/** A subject key this store accepts (the keys `artKey` builds). */
export function isArtRef(ref: string): boolean {
  return REF.test(ref);
}

export function isArtKind(kind: unknown): kind is ArtKind {
  return typeof kind === "string" && (ART_KINDS as readonly string[]).includes(kind);
}

export type ArtRow = {
  kind: string;
  ref_id: string;
  label?: string | null;
  storage_path: string;
};

export type ArtSlot = { ref: string; kind: ArtKind; path: string; label: string | null };

/**
 * A row as a slot. Rows written before slots existed (kind "team"/"player") count as the hero;
 * channel art isn't sports art and is left out.
 */
export function slotFromRow(row: ArtRow): { slot: ArtSlot; legacy: boolean } | null {
  if (!row || typeof row.ref_id !== "string" || typeof row.storage_path !== "string") return null;
  if (!row.storage_path || !isArtRef(row.ref_id)) return null;
  const legacy = row.kind === "team" || row.kind === "player";
  const kind: ArtKind | null = isArtKind(row.kind) ? row.kind : legacy ? "hero" : null;
  if (!kind) return null;
  return {
    slot: { ref: row.ref_id, kind, path: row.storage_path, label: row.label ?? null },
    legacy,
  };
}

/** Rows grouped by subject, one slot per kind; a slot row beats a legacy row for the same kind. */
export function slotsFromRows(rows: readonly ArtRow[]): Map<string, Map<ArtKind, ArtSlot>> {
  const out = new Map<string, Map<ArtKind, ArtSlot>>();
  const parsed = rows.map(slotFromRow).filter((p) => p !== null);
  // Slot rows first, then legacy rows only where the slot is still empty.
  for (const pass of [false, true]) {
    for (const { slot, legacy } of parsed) {
      if (legacy !== pass) continue;
      const slots = out.get(slot.ref) ?? new Map<ArtKind, ArtSlot>();
      if (legacy && slots.has(slot.kind)) continue;
      slots.set(slot.kind, slot);
      out.set(slot.ref, slots);
    }
  }
  return out;
}

/** `<owner>/<ref>/<kind>.<ext>`, the object path inside the bucket. */
export function artObjectPath(owner: string, ref: string, kind: ArtKind, ext: string): string {
  return `${owner}/${ref}/${kind}.${ext}`;
}

/** An object path as a URL path (each segment escaped, the slashes kept). */
export function encodeObjectPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** The picture for a slot, borrowing from its fallback slot when it is empty. */
export function resolveArt(
  lookup: (ref: string, kind: ArtKind) => string | null,
  ref: string,
  kind: ArtKind,
): { url: string; kind: ArtKind; borrowed: boolean } | null {
  const own = lookup(ref, kind);
  if (own) return { url: own, kind, borrowed: false };
  const from = ART_FALLBACK[kind];
  const url = from ? lookup(ref, from) : null;
  return url && from ? { url, kind: from, borrowed: true } : null;
}

/** Why a file can't be used for a slot, or null when it can. */
export function artFileProblem(file: { type: string; size: number }): string | null {
  if (!ART_TYPES[file.type]) return "Use a PNG, JPEG or WebP image.";
  if (file.size > MAX_ART_BYTES) return "That image is larger than 15 MB.";
  if (file.size <= 0) return "That file is empty.";
  return null;
}

type Context = { userId: string; generation: number };

export type CustomArtPorts = {
  context: () => Context | null;
  rest: (path: string, init?: RequestInit, expected?: Context | null) => Promise<Response>;
  storage: (path: string, init?: RequestInit, expected?: Context | null) => Promise<Response>;
  storageUrl: (relative: string) => string;
  /** Session changes (sign-in, sign-out, token refresh). */
  subscribe?: (listener: () => void) => () => void;
  now?: () => number;
};

export type CustomArtStatus = "signed-out" | "loading" | "ready" | "error";

type State = {
  owner: string | null;
  generation: number;
  slots: Map<string, Map<ArtKind, ArtSlot>>;
  urls: Map<string, string>;
  renewAt: number;
  status: CustomArtStatus;
};

async function failure(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
  const detail = body?.message || body?.error;
  return new Error(detail ? `${fallback} (${detail})` : `${fallback} (${res.status})`);
}

export function createCustomArtStore(ports: CustomArtPorts) {
  const now = ports.now ?? Date.now;
  const listeners = new Set<() => void>();
  let state: State = {
    owner: null,
    generation: -1,
    slots: new Map(),
    urls: new Map(),
    renewAt: 0,
    status: "signed-out",
  };
  let version = 0;
  let loading: Promise<void> | null = null;
  let retryAt = 0;

  const emit = () => {
    version++;
    for (const fn of listeners) fn();
  };

  const sameAccount = (ctx: Context | null) =>
    !!ctx && ctx.userId === state.owner && ctx.generation === state.generation;

  async function sign(paths: string[], ctx: Context): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    if (!paths.length) return urls;
    const res = await ports.storage(
      `object/sign/${ART_BUCKET}`,
      { method: "POST", body: JSON.stringify({ expiresIn: SIGN_SECONDS, paths }) },
      ctx,
    );
    if (!res.ok) throw await failure(res, "Art links could not be prepared");
    const list = (await res.json().catch(() => [])) as Array<{
      path?: string;
      signedURL?: string | null;
      error?: string | null;
    }>;
    for (const item of Array.isArray(list) ? list : []) {
      if (item?.path && item.signedURL && !item.error)
        urls.set(item.path, encodeURI(ports.storageUrl(item.signedURL)));
    }
    return urls;
  }

  async function fetchAll(ctx: Context): Promise<void> {
    const res = await ports.rest(
      "custom_art?select=kind,ref_id,label,storage_path&order=created_at.asc",
      {},
      ctx,
    );
    if (!res.ok) throw await failure(res, "Your sports art could not be loaded");
    const rows = (await res.json().catch(() => [])) as ArtRow[];
    const slots = slotsFromRows(Array.isArray(rows) ? rows : []);
    const paths = [...slots.values()].flatMap((m) => [...m.values()].map((s) => s.path));
    const urls = await sign([...new Set(paths)], ctx);
    if (!sameAccount(ports.context()) || !sameAccount(ctx)) return;
    state = {
      ...state,
      slots,
      urls,
      renewAt: now() + SIGN_SECONDS * 1000 - RENEW_BEFORE_MS,
      status: "ready",
    };
    emit();
  }

  /** Loads (or reloads) the signed-in owner's art; resolves once it is in. */
  function load(force = false): Promise<void> {
    const ctx = ports.context();
    if (!ctx) {
      if (state.owner !== null || state.status !== "signed-out") {
        state = {
          owner: null,
          generation: -1,
          slots: new Map(),
          urls: new Map(),
          renewAt: 0,
          status: "signed-out",
        };
        emit();
      }
      return Promise.resolve();
    }
    if (!sameAccount(ctx)) {
      // Another account (or a new sign-in): nothing of the previous owner's survives.
      state = {
        owner: ctx.userId,
        generation: ctx.generation,
        slots: new Map(),
        urls: new Map(),
        renewAt: 0,
        status: "loading",
      };
      loading = null;
      retryAt = 0;
      emit();
    } else if (!force && (loading || (state.status === "ready" && now() < state.renewAt))) {
      return loading ?? Promise.resolve();
    }
    if (loading && !force) return loading;
    const job = fetchAll(ctx)
      .catch(() => {
        if (!sameAccount(ctx)) return;
        retryAt = now() + RETRY_MS;
        if (state.status !== "ready") {
          state = { ...state, status: "error" };
          emit();
        }
      })
      .finally(() => {
        if (loading === job) loading = null;
      });
    loading = job;
    return job;
  }

  /** Starts a load when none has run for this account, the links are due, or a retry is due. */
  function ensure(): void {
    const ctx = ports.context();
    if (!ctx) {
      if (state.owner !== null) void load();
      return;
    }
    if (loading) return;
    if (!sameAccount(ctx)) void load();
    else if (state.status === "ready" && now() >= state.renewAt) void load(true);
    else if (state.status === "error" && now() >= retryAt) void load(true);
  }

  function url(ref: string, kind: ArtKind): string | null {
    ensure();
    if (!sameAccount(ports.context())) return null;
    const slot = state.slots.get(ref)?.get(kind);
    return slot ? (state.urls.get(slot.path) ?? null) : null;
  }

  function slots(ref: string): Partial<Record<ArtKind, ArtSlot & { url: string | null }>> {
    ensure();
    const out: Partial<Record<ArtKind, ArtSlot & { url: string | null }>> = {};
    if (!sameAccount(ports.context())) return out;
    for (const [kind, slot] of state.slots.get(ref) ?? [])
      out[kind] = { ...slot, url: state.urls.get(slot.path) ?? null };
    return out;
  }

  /** Every subject that has at least one slot. */
  function refs(): string[] {
    ensure();
    return sameAccount(ports.context()) ? [...state.slots.keys()] : [];
  }

  function requireAccount(): Context {
    const ctx = ports.context();
    if (!ctx) throw new Error("Sign in to your JL account to save sports art.");
    return ctx;
  }

  /** Uploads a picture into a slot, replacing what was there. */
  async function upload(
    ref: string,
    kind: ArtKind,
    file: Blob,
    label: string | null = null,
  ): Promise<void> {
    if (!isArtRef(ref)) throw new Error("This team can't hold custom art.");
    const problem = artFileProblem(file);
    if (problem) throw new Error(problem);
    const ctx = requireAccount();
    const path = artObjectPath(ctx.userId, ref, kind, ART_TYPES[file.type]);
    const put = await ports.storage(
      `object/${ART_BUCKET}/${encodeObjectPath(path)}`,
      {
        method: "POST",
        headers: { "Content-Type": file.type, "x-upsert": "true", "Cache-Control": "3600" },
        body: file,
      },
      ctx,
    );
    if (!put.ok) throw await failure(put, "The picture could not be uploaded");
    const previous = state.slots.get(ref)?.get(kind)?.path ?? null;
    const row = await ports.rest(
      "custom_art?on_conflict=owner,kind,ref_id",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ kind, ref_id: ref, label, storage_path: path }),
      },
      ctx,
    );
    if (!row.ok) throw await failure(row, "The picture was uploaded but could not be saved");
    // A replaced picture of another type leaves its old file behind; tidy it (best effort).
    if (previous && previous !== path && previous.startsWith(`${ctx.userId}/`))
      await removeObjects([previous], ctx).catch(() => {});
    await load(true);
  }

  async function removeObjects(paths: string[], ctx: Context): Promise<void> {
    const res = await ports.storage(
      `object/${ART_BUCKET}`,
      { method: "DELETE", body: JSON.stringify({ prefixes: paths }) },
      ctx,
    );
    if (!res.ok) throw await failure(res, "The old picture could not be removed");
  }

  /** Clears a slot: its row and its file. */
  async function remove(ref: string, kind: ArtKind): Promise<void> {
    const ctx = requireAccount();
    const slot = state.slots.get(ref)?.get(kind);
    const kinds = kind === "hero" ? "in.(hero,team,player)" : `eq.${kind}`;
    const res = await ports.rest(
      `custom_art?kind=${kinds}&ref_id=eq.${encodeURIComponent(ref)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
      ctx,
    );
    if (!res.ok) throw await failure(res, "The picture could not be removed");
    if (slot && slot.path.startsWith(`${ctx.userId}/`))
      await removeObjects([slot.path], ctx).catch(() => {});
    await load(true);
  }

  ports.subscribe?.(() => {
    const ctx = ports.context();
    if (!sameAccount(ctx) || (!ctx && state.owner !== null)) void load();
  });

  return {
    load,
    ensure,
    url,
    slots,
    refs,
    upload,
    remove,
    status: () => state.status,
    version: () => version,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type CustomArtStore = ReturnType<typeof createCustomArtStore>;
