import { lruSet } from "@/lib/cache";
import type { Collaborator } from "./collaborator-rank";

const STORE_KEY = "harbor.person.collabs.v1";
const MAX_PEOPLE = 24;
const SAVE_DELAY_MS = 5000;

const store = new Map<number, Collaborator[]>();
let loaded = false;
let saveTimer: number | null = null;

function isCollaborator(v: unknown): v is Collaborator {
  const c = v as Collaborator | null;
  return (
    !!c &&
    typeof c.id === "number" &&
    typeof c.name === "string" &&
    typeof c.titles === "number" &&
    typeof c.popularity === "number"
  );
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      const id = Number(k);
      if (!Number.isFinite(id) || !Array.isArray(v)) continue;
      store.set(id, v.filter(isCollaborator));
    }
  } catch {
    /* ignore */
  }
}

function persistSoon() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(store)));
    } catch {
      /* ignore */
    }
  }, SAVE_DELAY_MS);
}

export function readCollaborators(personId: number): Collaborator[] | null {
  load();
  return store.get(personId) ?? null;
}

export function writeCollaborators(personId: number, people: Collaborator[]): void {
  load();
  lruSet(store, personId, people, MAX_PEOPLE);
  persistSoon();
}
