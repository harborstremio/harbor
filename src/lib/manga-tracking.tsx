import { useEffect } from "react";
import {
  listMangaProgress,
  subscribeMangaProgress,
  type MangaProgressEntry,
} from "@/lib/manga-progress";
import { anilistMangaAuthed, pushAnilistManga } from "@/lib/manga/tracking-anilist";
import { malMangaAuthed, pushMalManga } from "@/lib/manga/tracking-mal";
import { useProfiles } from "@/lib/profiles";

const lastSeen = new Map<string, number>();
const pushedAnilist = new Map<string, number>();
const pushedMal = new Map<string, number>();
const inflight = new Set<string>();

function chapterValue(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

function titleKeyOf(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function completedChapter(entry: MangaProgressEntry): number | null {
  const cur = chapterValue(entry.chapterNumber);
  if (cur == null) return null;
  const prev = lastSeen.get(entry.id) ?? 0;
  let done: number | null = null;
  if (entry.totalPages > 0 && entry.page >= entry.totalPages) done = cur;
  else if (cur > prev && prev >= 1) done = prev;
  if (cur > prev) lastSeen.set(entry.id, cur);
  return done;
}

async function pushOne(
  tracker: "anilist" | "mal",
  pushed: Map<string, number>,
  entry: MangaProgressEntry,
  chapter: number,
): Promise<void> {
  if (chapter <= (pushed.get(entry.id) ?? 0)) return;
  const flight = `${tracker}:${entry.id}:${chapter}`;
  if (inflight.has(flight)) return;
  inflight.add(flight);
  const titleKey = titleKeyOf(entry.title);
  const ok =
    tracker === "anilist"
      ? await pushAnilistManga(titleKey, entry.title, chapter)
      : await pushMalManga(titleKey, entry.title, chapter);
  if (ok) pushed.set(entry.id, chapter);
  inflight.delete(flight);
}

function run(pid: string): void {
  const anilistOn = anilistMangaAuthed();
  const malOn = malMangaAuthed();
  if (!anilistOn && !malOn) return;
  for (const entry of listMangaProgress(pid)) {
    if (!entry.title) continue;
    const chapter = completedChapter(entry);
    if (chapter == null) continue;
    if (anilistOn) void pushOne("anilist", pushedAnilist, entry, chapter);
    if (malOn) void pushOne("mal", pushedMal, entry, chapter);
  }
}

export function MangaTrackingRunner() {
  const { activeId } = useProfiles();
  useEffect(() => {
    const pid = activeId ?? "default";
    lastSeen.clear();
    pushedAnilist.clear();
    pushedMal.clear();
    inflight.clear();
    const tick = () => run(pid);
    tick();
    return subscribeMangaProgress(tick);
  }, [activeId]);
  return null;
}
