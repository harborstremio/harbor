import { safeFetch as fetch } from "@/lib/safe-fetch";
import type { Addon } from "@/lib/addons";
import { dlog, dwarn } from "@/lib/debug";
import type { DebridSlug } from "./types";
import { isStatusOnlyAddon } from "./addon-detect";

const SERVICE_NAME_TO_SLUG: Record<string, DebridSlug> = {
  premiumize: "pm",
  realdebrid: "rd",
  "real-debrid": "rd",
  rd: "rd",
  torbox: "tb",
  alldebrid: "ad",
  "all-debrid": "ad",
  ad: "ad",
  debridlink: "dl",
  "debrid-link": "dl",
  dl: "dl",
};

export type ServiceHealthStatus = "active" | "expiring" | "expired" | "unknown";

export type ServiceHealth = {
  slug: DebridSlug;
  status: ServiceHealthStatus;
  daysLeft: number | null;
  quotaUsedPercent: number | null;
  rawLine: string;
};

export type AioService = {
  id: string;
  name: string;
  poster: string | null;
  status: ServiceHealthStatus;
  daysLeft: number | null;
  quotaUsedPercent: number | null;
  rawLine: string;
};

export type AioStatusSnapshot = {
  fetchedAt: number;
  addonName: string;
  addonLogo: string | null;
  health: Map<DebridSlug, ServiceHealth>;
  services: AioService[];
};

type CatalogMeta = {
  id: string;
  name?: string;
  type?: string;
  poster?: string;
};

type StatusStream = {
  name?: string;
  title?: string;
  description?: string;
};

export async function fetchAioStatusHealth(
  addons: Addon[],
  signal?: AbortSignal,
): Promise<AioStatusSnapshot | null> {
  const status = addons.find(isStatusOnlyAddon);
  if (!status) {
    dlog(`[aiostatus] no AIOStatus addon detected`);
    return null;
  }
  dlog(`[aiostatus] found: ${status.manifest.name}`);
  const base = status.transportUrl.replace(/\/manifest\.json$/, "");

  const catalogDefs =
    status.manifest.catalogs && status.manifest.catalogs.length > 0
      ? status.manifest.catalogs.filter((c) => !c.extra?.some((e) => e.isRequired))
      : [{ id: "debridstatus_catalog", type: "other", name: "Status" }];

  const seen = new Set<string>();
  const metas: Array<CatalogMeta & { resType: string }> = [];
  await Promise.all(
    catalogDefs.map(async (def) => {
      const catalogUrl = `${base}/catalog/${encodeURIComponent(def.type)}/${encodeURIComponent(def.id)}.json`;
      try {
        const res = await fetch(catalogUrl, { signal });
        if (!res.ok) return;
        const json = (await res.json()) as { metas?: CatalogMeta[] };
        for (const meta of json.metas ?? []) {
          if (!meta.id || seen.has(meta.id)) continue;
          seen.add(meta.id);
          metas.push({ ...meta, resType: def.type });
        }
      } catch (e) {
        dwarn(`[aiostatus] catalog ${def.id} fetch failed: ${e instanceof Error ? e.message : e}`);
      }
    }),
  );
  dlog(`[aiostatus] ${catalogDefs.length} catalogs -> ${metas.length} services`);

  const health = new Map<DebridSlug, ServiceHealth>();
  const services: AioService[] = [];
  await Promise.all(
    metas.map(async (meta) => {
      const url = `${base}/stream/${encodeURIComponent(meta.resType)}/${encodeURIComponent(meta.id)}.json`;
      try {
        const res = await fetch(url, { signal });
        if (!res.ok) return;
        const json = (await res.json()) as { streams?: StatusStream[] };
        const stream = json.streams?.[0];
        if (!stream) return;
        const parsed = parseStatus(stream);
        services.push({
          id: meta.id,
          name: meta.name?.trim() || cleanServiceId(meta.id),
          poster: meta.poster ?? null,
          ...parsed,
        });
        const slug = mapDsServiceId(meta.id);
        if (slug) health.set(slug, { slug, ...parsed });
      } catch {
        /* ignore individual failures */
      }
    }),
  );
  services.sort((a, b) => a.name.localeCompare(b.name));

  if (health.size === 0) {
    const fallback = await tryStreamFallback(base, signal);
    for (const [slug, h] of fallback) {
      health.set(slug, h);
      if (!services.some((s) => mapDsServiceId(s.id) === slug)) {
        services.push({
          id: `ds:${slug}`,
          name: slug.toUpperCase(),
          poster: null,
          status: h.status,
          daysLeft: h.daysLeft,
          quotaUsedPercent: h.quotaUsedPercent,
          rawLine: h.rawLine,
        });
      }
    }
  }

  dlog(`[aiostatus] resolved ${health.size} known + ${services.length} total services`);
  return {
    fetchedAt: Date.now(),
    addonName: status.manifest.name,
    addonLogo: (status.manifest.logo as string | undefined) ?? null,
    health,
    services,
  };
}

function mapDsServiceId(id: string): DebridSlug | null {
  const tail = (id.startsWith("ds:") ? id.slice(3) : id).toLowerCase();
  return SERVICE_NAME_TO_SLUG[tail] ?? null;
}

function cleanServiceId(id: string): string {
  return id.replace(/^[a-z]+:/i, "");
}

function parseStatus(stream: StatusStream): {
  status: ServiceHealthStatus;
  daysLeft: number | null;
  quotaUsedPercent: number | null;
  rawLine: string;
} {
  const text = `${stream.name ?? ""}\n${stream.title ?? ""}\n${stream.description ?? ""}`;
  const daysMatch =
    text.match(/Days?\s+left[:\s]+(-?\d+)/i) ??
    text.match(/(-?\d{1,4})\s*days?\s+(?:left|remaining)/i);
  let days = daysMatch ? parseInt(daysMatch[1], 10) : null;
  // A debrid subscription is realistically days to a couple of years. A 4-digit
  // reading (e.g. Premiumize loyalty points like 4234) is a misparse, not days-left.
  if (days != null && (days < 0 || days > 2000)) days = null;
  const quotaMatch = text.match(/(\d{1,3})\s*%/);
  const quota = quotaMatch ? parseInt(quotaMatch[1], 10) : null;
  let status: ServiceHealthStatus = "unknown";
  if (/🔴|⛔|✗|❌|\bEXPIRED\b|\bINACTIVE\b|\bSUSPENDED\b|NOT[\s_-]*PREMIUM/iu.test(text)) {
    status = "expired";
  } else if (/🟡|\bEXPIRING\b/iu.test(text) || (days != null && days <= 7)) {
    status = "expiring";
  } else if (/🟢|✅|\bACTIVE\b|\bPREMIUM\b/iu.test(text) || (days != null && days > 7)) {
    status = "active";
  }
  const rawLine =
    (stream.name ?? "").split(/\r?\n/).find((l) => l.trim().length > 2) ??
    (stream.title ?? "").split(/\r?\n/).find((l) => l.trim().length > 2) ??
    text.trim().slice(0, 100);
  return { status, daysLeft: days, quotaUsedPercent: quota, rawLine };
}

function parseStatusRow(slug: DebridSlug, stream: StatusStream): ServiceHealth {
  return { slug, ...parseStatus(stream) };
}

async function tryStreamFallback(
  base: string,
  signal?: AbortSignal,
): Promise<Map<DebridSlug, ServiceHealth>> {
  const out = new Map<DebridSlug, ServiceHealth>();
  const probes = [
    { type: "movie", id: "tt0111161" },
    { type: "series", id: "tt0944947" },
  ];
  for (const probe of probes) {
    try {
      const res = await fetch(`${base}/stream/${probe.type}/${probe.id}.json`, { signal });
      if (!res.ok) continue;
      const json = (await res.json()) as { streams?: StatusStream[] };
      const streams = json.streams ?? [];
      if (streams.length === 0) continue;
      for (const s of streams) {
        const text = `${s.name ?? ""}\n${s.title ?? ""}\n${s.description ?? ""}`;
        const slug = matchService(text);
        if (!slug || out.has(slug)) continue;
        out.set(slug, parseStatusRow(slug, s));
      }
      if (out.size > 0) return out;
    } catch {
      /* ignore */
    }
  }
  return out;
}

function matchService(text: string): DebridSlug | null {
  const lower = text.toLowerCase();
  if (/\bpremiumize\b/.test(lower)) return "pm";
  if (/\breal[\s\-]?debrid\b/.test(lower)) return "rd";
  if (/\btorbox\b/.test(lower)) return "tb";
  if (/\ball[\s\-]?debrid\b/.test(lower)) return "ad";
  if (/\bdebrid[\s\-]?link\b/.test(lower)) return "dl";
  return null;
}
