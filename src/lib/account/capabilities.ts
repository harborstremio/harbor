import { useEffect, useState } from "react";
import { getJson } from "./client";

/**
 * What the CONNECTED instance supports, asked at runtime rather than compiled in.
 *
 * One client binary serves harbor.site, self-hosted instances and anyone running
 * their own backend, so an email feature cannot be a build flag -- a self-hoster
 * with no SMTP configured would get a signup form promising a verification mail
 * that never arrives, which is worse than not offering it.
 *
 * So the server is asked, and every email affordance in the UI is rendered only
 * if it answers yes. An instance that has not configured mail -- or one running a
 * backend older than this endpoint, where the request 404s -- looks exactly as it
 * does today.
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
