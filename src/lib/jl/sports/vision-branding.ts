/**
 * JL Vision as the Sports Hub's branding service: teams and conferences, verified palettes,
 * approved logos, layout templates and the artwork a viewer may see, read from the `media.sports_*`
 * views (supabase/jl-vision/0003_sports_branding_api.sql).
 *
 * Everything is read with the viewer's own session, so row-level security decides what comes
 * back: shared rows for every signed-in viewer, a viewer's own generated artwork only for them,
 * and shared artwork only once it is approved. Files sit in the private `media-art` bucket and
 * are shown through signed URLs that are renewed before they lapse.
 *
 * Games are matched to teams by provider id (ESPN today), never by name. A team with no verified
 * palette, approved logo or art gets nothing from here and the views keep their own look.
 *
 * Plain module: the store takes its account ports from the caller, as custom-art.ts does.
 */

import { ART_BUCKET, type ArtKind, isArtKind } from "./custom-art.ts";

export type VisionGroup = {
  slug: string;
  name: string;
  league: string;
  type: string;
  parent: string | null;
};

export type VisionTeam = {
  /** "<conference>/<sport>/<team_slug>": JL Vision's identity for a team. */
  key: string;
  conference: string;
  sport: string;
  slug: string;
  name: string;
  mascot: string | null;
  league: string;
  logoPath: string | null;
  providerIds: Array<{ provider: string; league: string; id: string }>;
};

/** A verified palette. Colours are hex without '#'. */
export type VisionTheme = {
  name: string;
  style: string;
  primary: string;
  secondary: string;
  accent: string;
  gradientStart: string;
  gradientEnd: string;
  glow: string;
  background: string;
  textDark: string;
  textLight: string;
  glassBlurPx: number;
  glassOpacity: number;
};

export type VisionZone = {
  id: string;
  kind: string;
  z: number;
  rect: { x: number; y: number; w: number; h: number };
  fit?: string;
  opacity?: number;
  binding?: string;
  font?: string;
  align?: string;
  sizePct?: number;
  maxLines?: number;
  case?: string;
  glassPreset?: string;
};

export type VisionTemplate = {
  slug: string;
  name: string;
  type: string;
  style: string;
  width: number;
  height: number;
  zones: VisionZone[];
  glass: { blurPx: number; backgroundAlpha: number; borderAlpha: number; radiusPx: number };
};

type Context = { userId: string; generation: number };

export type VisionPorts = {
  context: () => Context | null;
  rest: (path: string, init?: RequestInit, expected?: Context | null) => Promise<Response>;
  storage: (path: string, init?: RequestInit, expected?: Context | null) => Promise<Response>;
  storageUrl: (relative: string) => string;
  subscribe?: (listener: () => void) => () => void;
  now?: () => number;
};

export type VisionStatus = "signed-out" | "loading" | "ready" | "error";

/** New palettes, logos and art show up after this long without a restart. */
const REFRESH_MS = 30 * 60_000;
const SIGN_SECONDS = 24 * 3600;
const RETRY_MS = 60_000;

const HEX = /^#?([0-9a-f]{6})$/i;
const hex = (value: unknown): string | null => {
  const m = typeof value === "string" ? HEX.exec(value) : null;
  return m ? m[1].toLowerCase() : null;
};
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const num = (value: unknown, fallback: number): number => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export function visionTeamKey(conference: string, sport: string, slug: string): string {
  return `${conference}/${sport}/${slug}`;
}

/** The provider index key for a team id ("espn:nfl:26"). */
export function providerKey(provider: string, league: string, id: string): string {
  return `${provider}:${league.toLowerCase()}:${id}`;
}

/**
 * ESPN's league segment for a Harbor league path ("football/college-football" →
 * "college-football"), the form the provider ids are stored in.
 */
export function espnLeagueFromPath(path: string | null | undefined): string | null {
  const segment = path?.split("/")[1];
  return segment ? segment.toLowerCase() : null;
}

export function parseTeam(row: Record<string, unknown>): VisionTeam | null {
  const conference = text(row.conference);
  const sport = text(row.sport);
  const slug = text(row.team_slug);
  const name = text(row.team_name);
  if (!conference || !sport || !slug || !name) return null;
  const ids = Array.isArray(row.provider_ids) ? row.provider_ids : [];
  return {
    key: visionTeamKey(conference, sport, slug),
    conference,
    sport,
    slug,
    name,
    mascot: text(row.mascot),
    league: text(row.league) ?? "",
    logoPath: text(row.logo_path),
    providerIds: ids.flatMap((p) => {
      const item = p as Record<string, unknown>;
      const provider = text(item?.provider);
      const league = text(item?.league);
      const id = item?.id == null ? null : text(String(item.id));
      return provider && league && id ? [{ provider, league, id }] : [];
    }),
  };
}

/** A palette row, or null when any colour is missing (a half palette is not shown). */
export function parseTheme(row: Record<string, unknown>): VisionTheme | null {
  const colours = {
    primary: hex(row.primary_hex),
    secondary: hex(row.secondary_hex),
    accent: hex(row.accent_hex),
    gradientStart: hex(row.gradient_start_hex),
    gradientEnd: hex(row.gradient_end_hex),
    glow: hex(row.glow_hex),
    background: hex(row.background_hex),
    textDark: hex(row.text_dark_hex),
    textLight: hex(row.text_light_hex),
  };
  if (Object.values(colours).some((c) => !c)) return null;
  return {
    ...(colours as { [K in keyof typeof colours]: string }),
    name: text(row.theme_name) ?? "",
    style: text(row.style_family) ?? "",
    glassBlurPx: Math.min(80, Math.max(0, num(row.glass_blur_px, 24))),
    glassOpacity: Math.min(1, Math.max(0, num(row.glass_opacity, 0.28))),
  };
}

export function parseTemplate(row: Record<string, unknown>): VisionTemplate | null {
  const slug = text(row.template_slug);
  const layout = (row.layout_json ?? {}) as Record<string, unknown>;
  const rawZones = Array.isArray(layout.zones) ? layout.zones : [];
  if (!slug || !rawZones.length) return null;
  const zones: VisionZone[] = rawZones.flatMap((z) => {
    const zone = z as Record<string, unknown>;
    const rect = (zone?.rect ?? {}) as Record<string, unknown>;
    const id = text(zone?.id);
    const kind = text(zone?.kind);
    if (!id || !kind) return [];
    const r = {
      x: num(rect.x, NaN),
      y: num(rect.y, NaN),
      w: num(rect.w, NaN),
      h: num(rect.h, NaN),
    };
    if (Object.values(r).some((v) => !Number.isFinite(v))) return [];
    return [
      {
        id,
        kind,
        z: num(zone.z, 0),
        rect: r,
        fit: text(zone.fit) ?? undefined,
        opacity: typeof zone.opacity === "number" ? zone.opacity : undefined,
        binding: text(zone.binding) ?? undefined,
        font: text(zone.font) ?? undefined,
        align: text(zone.align) ?? undefined,
        sizePct: typeof zone.sizePct === "number" ? zone.sizePct : undefined,
        maxLines: typeof zone.maxLines === "number" ? zone.maxLines : undefined,
        case: text(zone.case) ?? undefined,
        glassPreset: text(zone.glassPreset) ?? undefined,
      },
    ];
  });
  const glass = (layout.glass ?? {}) as Record<string, unknown>;
  return {
    slug,
    name: text(row.template_name) ?? slug,
    type: text(row.template_type) ?? "",
    style: text(row.style_family) ?? "",
    width: num(row.canvas_width, 1920),
    height: num(row.canvas_height, 1080),
    zones: zones.sort((a, b) => a.z - b.z),
    glass: {
      blurPx: num(glass.blurPx, 24),
      backgroundAlpha: num(glass.backgroundAlpha, 0.28),
      borderAlpha: num(glass.borderAlpha, 0.48),
      radiusPx: num(glass.cornerRadiusPx, 32),
    },
  };
}

type ArtPick = { path: string; rank: number };

/**
 * One picture per team and slot. The viewer's own artwork beats shared artwork; among their own,
 * the primary one, then the newest.
 */
export function pickArtwork(
  mine: Array<Record<string, unknown>>,
  shared: Array<Record<string, unknown>>,
): Map<string, Map<ArtKind, string>> {
  const best = new Map<string, Map<ArtKind, ArtPick>>();
  const offer = (row: Record<string, unknown>, rank: number) => {
    const conference = text(row.conference);
    const sport = text(row.sport);
    const slug = text(row.team_slug);
    const path = text(row.storage_path);
    if (!conference || !sport || !slug || !path || !isArtKind(row.slot)) return;
    const key = visionTeamKey(conference, sport, slug);
    const slots = best.get(key) ?? new Map<ArtKind, ArtPick>();
    const current = slots.get(row.slot);
    if (!current || rank > current.rank) slots.set(row.slot, { path, rank });
    best.set(key, slots);
  };
  for (const row of shared) offer(row, 0);
  for (const row of mine) {
    const created = Date.parse(String(row.created_at ?? "")) || 0;
    // Own art outranks shared; primary outranks the rest; newer outranks older.
    offer(row, 1e15 + (row.is_primary === true ? 1e14 : 0) + created);
  }
  const out = new Map<string, Map<ArtKind, string>>();
  for (const [key, slots] of best)
    out.set(key, new Map([...slots].map(([kind, pick]) => [kind, pick.path])));
  return out;
}

type Data = {
  groups: VisionGroup[];
  teams: Map<string, VisionTeam>;
  byProvider: Map<string, string>;
  themes: Map<string, VisionTheme>;
  templates: VisionTemplate[];
  art: Map<string, Map<ArtKind, string>>;
  urls: Map<string, string>;
};

const EMPTY: Data = {
  groups: [],
  teams: new Map(),
  byProvider: new Map(),
  themes: new Map(),
  templates: [],
  art: new Map(),
  urls: new Map(),
};

export function createVisionStore(ports: VisionPorts) {
  const now = ports.now ?? Date.now;
  const listeners = new Set<() => void>();
  let owner: string | null = null;
  let generation = -1;
  let data: Data = EMPTY;
  let status: VisionStatus = "signed-out";
  let refreshAt = 0;
  let retryAt = 0;
  let loading: Promise<void> | null = null;
  let version = 0;
  // Links worked out on this device for teams the database hasn't linked, per source
  // (vision-cfbd-link.ts, college-games.ts), merged into extraLinks.
  const linkSources = new Map<string, Map<string, string>>();
  let extraLinks = new Map<string, string>();

  const emit = () => {
    version++;
    for (const fn of listeners) fn();
  };
  const sameAccount = (ctx: Context | null) =>
    !!ctx && ctx.userId === owner && ctx.generation === generation;

  async function rows(path: string, ctx: Context): Promise<Array<Record<string, unknown>>> {
    const res = await ports.rest(path, {}, ctx);
    if (!res.ok) throw new Error(`JL Vision could not be read (${res.status})`);
    const body = (await res.json().catch(() => [])) as unknown;
    return Array.isArray(body) ? (body as Array<Record<string, unknown>>) : [];
  }

  async function sign(paths: string[], ctx: Context): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    if (!paths.length) return urls;
    const res = await ports.storage(
      `object/sign/${ART_BUCKET}`,
      { method: "POST", body: JSON.stringify({ expiresIn: SIGN_SECONDS, paths }) },
      ctx,
    );
    if (!res.ok) return urls;
    const list = (await res.json().catch(() => [])) as Array<{
      path?: string;
      signedURL?: string | null;
      error?: string | null;
    }>;
    for (const item of Array.isArray(list) ? list : [])
      if (item?.path && item.signedURL && !item.error)
        urls.set(item.path, encodeURI(ports.storageUrl(item.signedURL)));
    return urls;
  }

  async function fetchAll(ctx: Context): Promise<void> {
    const [groupRows, teamRows, themeRows, templateRows, sharedRows, mineRows] = await Promise.all([
      rows("sports_groups?select=slug,name,league,group_type,parent_slug", ctx),
      rows("sports_teams?select=*&order=team_name.asc", ctx),
      rows("sports_team_themes?select=*&order=is_default.desc", ctx),
      rows("sports_templates?select=*&order=sort_order.asc", ctx),
      rows("sports_published_art?select=conference,sport,team_slug,slot,storage_path", ctx),
      rows(
        "sports_my_artwork?select=conference,sport,team_slug,slot,storage_path,is_primary,created_at",
        ctx,
      ),
    ]);
    const groups = groupRows.flatMap((r) => {
      const slug = text(r.slug);
      const name = text(r.name);
      return slug && name
        ? [
            {
              slug,
              name,
              league: text(r.league) ?? "",
              type: text(r.group_type) ?? "",
              parent: text(r.parent_slug),
            },
          ]
        : [];
    });
    const teams = new Map<string, VisionTeam>();
    const byProvider = new Map<string, string>();
    for (const row of teamRows) {
      const team = parseTeam(row);
      if (!team) continue;
      teams.set(team.key, team);
      for (const p of team.providerIds)
        byProvider.set(providerKey(p.provider, p.league, p.id), team.key);
    }
    const themes = new Map<string, VisionTheme>();
    for (const row of themeRows) {
      const key = visionTeamKey(String(row.conference), String(row.sport), String(row.team_slug));
      const theme = parseTheme(row);
      // Rows come default-first, so the first valid palette per team wins.
      if (theme && teams.has(key) && !themes.has(key)) themes.set(key, theme);
    }
    const templates = templateRows.map(parseTemplate).filter((t) => t !== null);
    const art = pickArtwork(mineRows, sharedRows);
    const paths = new Set<string>();
    for (const team of teams.values()) if (team.logoPath) paths.add(team.logoPath);
    for (const slots of art.values()) for (const path of slots.values()) paths.add(path);
    const urls = await sign([...paths], ctx);
    if (!sameAccount(ports.context()) || !sameAccount(ctx)) return;
    data = { groups, teams, byProvider, themes, templates, art, urls };
    status = "ready";
    refreshAt = now() + REFRESH_MS;
    emit();
  }

  function load(force = false): Promise<void> {
    const ctx = ports.context();
    if (!ctx) {
      if (owner !== null || status !== "signed-out") {
        owner = null;
        generation = -1;
        data = EMPTY;
        status = "signed-out";
        loading = null;
        emit();
      }
      return Promise.resolve();
    }
    if (!sameAccount(ctx)) {
      owner = ctx.userId;
      generation = ctx.generation;
      // Another account's own artwork never carries over.
      data = EMPTY;
      status = "loading";
      loading = null;
      retryAt = 0;
      emit();
    } else if (!force && (loading || (status === "ready" && now() < refreshAt))) {
      return loading ?? Promise.resolve();
    }
    if (loading && !force) return loading;
    const job = fetchAll(ctx)
      .catch(() => {
        if (!sameAccount(ctx)) return;
        retryAt = now() + RETRY_MS;
        if (status !== "ready") {
          status = "error";
          emit();
        }
      })
      .finally(() => {
        if (loading === job) loading = null;
      });
    loading = job;
    return job;
  }

  /** Starts a load when none has run for this account, a refresh is due, or a retry is due. */
  function ensure(): void {
    const ctx = ports.context();
    if (!ctx) {
      if (owner !== null) void load();
      return;
    }
    if (loading) return;
    if (!sameAccount(ctx)) void load();
    else if (status === "ready" && now() >= refreshAt) void load(true);
    else if (status === "error" && now() >= retryAt) void load(true);
  }

  const current = (): Data => {
    ensure();
    return sameAccount(ports.context()) ? data : EMPTY;
  };

  ports.subscribe?.(() => {
    const ctx = ports.context();
    if (!sameAccount(ctx) || (!ctx && owner !== null)) void load();
  });

  return {
    load,
    ensure,
    status: () => status,
    version: () => version,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Conferences, leagues and divisions. */
    groups: (): VisionGroup[] => current().groups,
    /** Teams of a group, or of a group's divisions (NFL → AFC → AFC East). */
    teams(group?: string): VisionTeam[] {
      const d = current();
      const all = [...d.teams.values()];
      if (!group) return all;
      const within = new Set([group]);
      for (let grew = true; grew; ) {
        grew = false;
        for (const g of d.groups)
          if (g.parent && within.has(g.parent) && !within.has(g.slug)) {
            within.add(g.slug);
            grew = true;
          }
      }
      return all.filter((t) => within.has(t.conference));
    },
    team: (key: string): VisionTeam | null => current().teams.get(key) ?? null,
    /**
     * Provider ids linked on this device, used only where the database has no link. Replaces
     * any earlier set; the database's own links always win.
     */
    setDeviceLinks(source: string, links: ReadonlyMap<string, string>): void {
      const before = linkSources.get(source);
      const same =
        !!before && links.size === before.size && [...links].every(([k, v]) => before.get(k) === v);
      if (same) return;
      linkSources.set(source, new Map(links));
      extraLinks = new Map([...linkSources.values()].flatMap((m) => [...m]));
      emit();
    },
    /** The JL Vision team behind a provider's team id, or null when it isn't linked. */
    byProvider(provider: string, league: string, id: string): VisionTeam | null {
      const d = current();
      const pk = providerKey(provider, league, id);
      const key = d.byProvider.get(pk) ?? extraLinks.get(pk);
      return key ? (d.teams.get(key) ?? null) : null;
    },
    /** A team's id at a provider: the database's link, else one made on this device. */
    providerId(key: string, provider: string, league: string): string | null {
      const own = current()
        .teams.get(key)
        ?.providerIds.find((p) => p.provider === provider && p.league === league);
      if (own) return own.id;
      const prefix = `${provider}:${league.toLowerCase()}:`;
      for (const [pk, teamKey] of extraLinks)
        if (teamKey === key && pk.startsWith(prefix)) return pk.slice(prefix.length);
      return null;
    },
    theme: (key: string): VisionTheme | null => current().themes.get(key) ?? null,
    logoUrl(key: string): string | null {
      const d = current();
      const path = d.teams.get(key)?.logoPath;
      return path ? (d.urls.get(path) ?? null) : null;
    },
    artUrl(key: string, kind: ArtKind): string | null {
      const d = current();
      const path = d.art.get(key)?.get(kind);
      return path ? (d.urls.get(path) ?? null) : null;
    },
    templates(type?: string): VisionTemplate[] {
      const all = current().templates;
      return type ? all.filter((t) => t.type === type) : all;
    },
    template: (slug: string): VisionTemplate | null =>
      current().templates.find((t) => t.slug === slug) ?? null,
  };
}

export type VisionStore = ReturnType<typeof createVisionStore>;
