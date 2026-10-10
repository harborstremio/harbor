import { getSecret, setSecret } from "../secret-store";

const KEY = "harbor.sports.api-sports.v1";
let revision = 0;
const listeners = new Set<() => void>();
export const sportsApiRevision = () => revision;
export function subscribeSportsApiCredentials(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Uses Harbor's device-local credential store; never include this in metadata URLs. */
export function readSportsApiKey(): string {
  return getSecret(KEY)?.trim() ?? "";
}

export function saveSportsApiKey(value: string): void {
  const key = value.trim();
  setSecret(KEY, key || null);
  if (readSportsApiKey() !== key) throw new Error("Could not save API credential");
  revision++;
  listeners.forEach((listener) => listener());
}
