import { useMemo } from "react";
import { useDebridSecrets } from "@/lib/secret-store";
import { createAllDebrid } from "./alldebrid";
import { createDebridLink } from "./debridlink";
import { createPremiumize } from "./premiumize";
import { createRealDebrid } from "./realdebrid";
import { createTorbox } from "./torbox";
import type { DebridSlug, DebridStore } from "./types";

export type DebridKeys = {
  rdKey: string;
  tbKey: string;
  adKey: string;
  pmKey: string;
  dlKey: string;
};

export function buildDebridClients(keys: DebridKeys): DebridStore[] {
  const clients: DebridStore[] = [];
  if (keys.rdKey) clients.push(createRealDebrid(keys.rdKey));
  if (keys.tbKey) clients.push(createTorbox(keys.tbKey));
  if (keys.adKey) clients.push(createAllDebrid(keys.adKey));
  if (keys.pmKey) clients.push(createPremiumize(keys.pmKey));
  if (keys.dlKey) clients.push(createDebridLink(keys.dlKey));
  return clients;
}

export function useDebridClients(): DebridStore[] {
  const keys = useDebridSecrets();
  return useMemo(
    () => buildDebridClients(keys),
    [keys.rdKey, keys.tbKey, keys.adKey, keys.pmKey, keys.dlKey],
  );
}

export function useDebridSlugs(): DebridSlug[] {
  const clients = useDebridClients();
  return useMemo(() => clients.map((c) => c.slug), [clients]);
}
