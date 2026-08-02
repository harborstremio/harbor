import { safeFetch } from "@/lib/safe-fetch";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

export type NoteMedia = {
  src: string;
  kind?: "image" | "sprite";
  alt?: string;
  height?: number;
};

export type NoteSection = { heading?: string; items: string[] };

export type ReleaseNote = {
  title?: string;
  intro?: string;
  media?: NoteMedia;
  sections?: NoteSection[];
};

const URL = `${HARBOR_API_BASE}/release-notes.json`;

let cache: Record<string, ReleaseNote> | null = null;
let loading: Promise<void> | null = null;

async function load(): Promise<void> {
  try {
    const res = await safeFetch(URL);
    const j = res.ok ? ((await res.json()) as { notes?: Record<string, ReleaseNote> }) : null;
    cache = j?.notes ?? {};
  } catch {
    cache = {};
  }
}

export async function releaseNote(version: string | null | undefined): Promise<ReleaseNote | null> {
  if (!version) return null;
  if (!cache) {
    if (!loading) loading = load();
    await loading;
  }
  return cache?.[version] ?? null;
}

export function hasRichNote(n: ReleaseNote | null | undefined): n is ReleaseNote {
  return !!n && !!(n.media || n.title || (n.sections && n.sections.length > 0));
}
