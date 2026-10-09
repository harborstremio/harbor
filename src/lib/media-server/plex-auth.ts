import { openUrl } from "@/lib/window";
import { getSecret, setSecret } from "@/lib/secret-store";
import { activeProfileId } from "@/lib/active-profile-id";
import { mediaServerRequest } from "./transport";

const PLEX_ORIGIN = "https://plex.tv";
const DEVICE_KEY = "harbor.plex-auth.device.v1";
type PlexPin = { id: number; code: string; authToken?: string; expiresAt?: string };
type PlexConnection = {
  uri?: string;
  local?: boolean;
  relay?: boolean;
  protocol?: string;
  address?: string;
  port?: number;
};
type PlexResource = {
  name?: string;
  provides?: string;
  owned?: boolean;
  presence?: boolean;
  accessToken?: string;
  clientIdentifier?: string;
  connections?: PlexConnection[];
};
export type PlexServerCandidate = {
  id: string;
  name: string;
  owned: boolean;
  available: boolean;
  origin: string;
  token: string;
};

function clientId(): string {
  const key = `${DEVICE_KEY}.${activeProfileId()}`;
  const existing = getSecret(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  setSecret(key, value);
  return value;
}
function headers(id = clientId()) {
  return {
    Accept: "application/json",
    "X-Plex-Product": "Harbor",
    "X-Plex-Version": "1",
    "X-Plex-Client-Identifier": id,
  };
}
const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Plex sign-in was cancelled", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

export async function signInWithPlex(
  signal?: AbortSignal,
  onWaiting?: () => void,
): Promise<PlexServerCandidate[]> {
  signal?.throwIfAborted();
  const id = clientId();
  const created = await mediaServerRequest<PlexPin>(PLEX_ORIGIN, "/api/v2/pins?strong=true", {
    method: "POST",
    headers: headers(id),
  });
  const pin = created.body;
  signal?.throwIfAborted();
  const params = new URLSearchParams({
    clientID: id,
    code: pin.code,
    "context[device][product]": "Harbor",
  });
  openUrl(`https://app.plex.tv/auth#?${params}`);
  onWaiting?.();
  const deadline = pin.expiresAt ? Date.parse(pin.expiresAt) : Date.now() + 5 * 60_000;
  let token = "";
  while (!token && Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException("Plex sign-in was cancelled", "AbortError");
    await delay(1500, signal);
    signal?.throwIfAborted();
    const polled = await mediaServerRequest<PlexPin>(PLEX_ORIGIN, `/api/v2/pins/${pin.id}`, {
      headers: headers(id),
    });
    signal?.throwIfAborted();
    token = polled.body.authToken ?? "";
  }
  if (!token) throw new Error("Plex sign-in expired. Try again.");
  const resources = await mediaServerRequest<PlexResource[]>(
    PLEX_ORIGIN,
    "/api/v2/resources?includeHttps=1&includeRelay=1",
    { headers: { ...headers(id), "X-Plex-Token": token } },
  );
  signal?.throwIfAborted();
  return (resources.body ?? [])
    .filter((resource) => resource.provides?.split(",").includes("server") && resource.accessToken)
    .flatMap((resource) => {
      const connections = [...(resource.connections ?? [])].sort(
        (a, b) => Number(a.relay) - Number(b.relay) || Number(!a.local) - Number(!b.local),
      );
      const endpoint =
        connections.find((entry) => entry.uri) ??
        connections.find((entry) => entry.address && entry.port);
      const origin =
        endpoint?.uri ??
        (endpoint?.address
          ? `${endpoint.protocol ?? "http"}://${endpoint.address}:${endpoint.port}`
          : "");
      return origin
        ? [
            {
              id: resource.clientIdentifier ?? `${resource.name}:${origin}`,
              name: resource.name ?? "Plex",
              owned: resource.owned !== false,
              available: resource.presence !== false,
              origin,
              token: resource.accessToken!,
            },
          ]
        : [];
    });
}
