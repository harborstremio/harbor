export const REQUIRED_RELAY_VERSION = 10;
export const HARBOR_PUBLIC_RELAY = (import.meta.env.VITE_PUBLIC_RELAY_URL as string | undefined) || "";

export function relayOutdated(version: number | null | undefined): boolean {
  return version == null || version < REQUIRED_RELAY_VERSION;
}

export function isPublicRelay(url: string): boolean {
  if (!HARBOR_PUBLIC_RELAY) return false;
  const host = url
    .trim()
    .toLowerCase()
    .replace(/^(wss?|https?):\/\//, "")
    .replace(/\/.*$/, "");
  const pubHost = HARBOR_PUBLIC_RELAY
    .trim()
    .toLowerCase()
    .replace(/^(wss?|https?):\/\//, "")
    .replace(/\/.*$/, "");
  return Boolean(pubHost && host === pubHost);
}
