import { useEffect, useState } from "react";
import { getJson } from "./client";

/**
 * What the CONNECTED backend supports, asked at runtime rather than compiled in.
 *
 * NOTE ON WHO THIS PROTECTS, because the obvious answer is wrong. It is NOT
 * self-hosters: HARBOR_API_BASE defaults to https://harbor.site, so a
 * self-hosted client still uses the primary backend for its Harbor account, and
 * would get a working mailer. Repointing needs a build-time VITE_HARBOR_API_BASE
 * and a harbor-themes of your own.
 *
 * It earns its place for three narrower reasons:
 *
 *   1. ROLLOUT ORDER. This lands before the endpoints exist. Every backend 404s
 *      today, so today every client renders exactly as it does now, and the two
 *      halves can ship independently in either order.
 *   2. KILL SWITCH. A provider outage or an abuse wave is one config flip away
 *      from the UI disappearing, rather than a client release.
 *   3. Backends that genuinely differ -- the maintainer's dev instances, CI, and
 *      a self-hostable harbor-themes if that ever exists.
 */
export type AccountCapabilities = {
  /** Instance can send mail: verification and email password reset are available. */
  email: boolean;
  newsletter: {
    enabled: boolean;
    /** Operator-supplied checkbox label. Never hardcode one; not every instance runs a list. */
    label: string;
    defaultChecked: boolean;
  };
};

const NONE: AccountCapabilities = {
  email: false,
  newsletter: { enabled: false, label: "", defaultChecked: false },
};

let cache: AccountCapabilities | null = null;
let inflight: Promise<AccountCapabilities> | null = null;

function coerce(raw: unknown): AccountCapabilities {
  const d = (raw ?? {}) as Record<string, unknown>;
  const n = (d.newsletter ?? {}) as Record<string, unknown>;
  return {
    email: d.email === true,
    newsletter: {
      // Newsletter is meaningless without a mailer, so it cannot be enabled alone.
      enabled: d.email === true && n.enabled === true,
      label: typeof n.label === "string" ? n.label : "",
      defaultChecked: n.defaultChecked === true,
    },
  };
}

/**
 * Cached for the session. Deliberately fails CLOSED: any error -- offline, 404
 * from an older backend, malformed body -- yields "no email support", so a
 * transient failure hides the UI rather than showing controls that cannot work.
 */
export async function fetchCapabilities(): Promise<AccountCapabilities> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = getJson<unknown>("/identity/api/capabilities")
    .then((d) => {
      cache = coerce(d);
      return cache;
    })
    .catch(() => NONE)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Test seam, and used when signing out of one instance and into another. */
export function resetCapabilities(): void {
  cache = null;
}

export function useCapabilities(): AccountCapabilities {
  const [caps, setCaps] = useState<AccountCapabilities>(cache ?? NONE);
  useEffect(() => {
    let live = true;
    void fetchCapabilities().then((c) => {
      if (live) setCaps(c);
    });
    return () => {
      live = false;
    };
  }, []);
  return caps;
}
