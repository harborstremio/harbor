import { useCallback, useEffect, useState } from "react";
import { safeFetch } from "@/lib/safe-fetch";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

export type AnnouncementSection = { heading?: string; items: string[] };

export type Announcement = {
  id: string;
  active?: boolean;
  global?: boolean;
  label?: string;
  title: string;
  hero?: string;
  logo?: string;
  cta?: string;
  intro?: string;
  body?: AnnouncementSection[];
};

export type AnnouncementScope = "anime" | "global";

const URL = `${HARBOR_API_BASE}/announcements.json`;
const SEEN_KEY = "harbor.announce.seen";

function isSeen(id: string): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === id;
  } catch {
    return false;
  }
}

function markSeen(id: string): void {
  try {
    localStorage.setItem(SEEN_KEY, id);
  } catch {
    /* ignore */
  }
}

async function fetchAnnouncement(): Promise<Announcement | null> {
  try {
    const res = await safeFetch(URL);
    if (!res.ok) return null;
    const j = (await res.json()) as Announcement;
    return j?.id && j.active ? j : null;
  } catch {
    return null;
  }
}

export function useAnnouncement(scope: AnnouncementScope = "anime") {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchAnnouncement().then((a) => {
      if (cancelled || !a || isSeen(a.id)) return;
      const aScope: AnnouncementScope = a.global ? "global" : "anime";
      if (aScope === scope) setAnnouncement(a);
    });
    return () => {
      cancelled = true;
    };
  }, [scope]);
  const seen = useCallback(() => {
    if (announcement) markSeen(announcement.id);
  }, [announcement]);
  const dismiss = useCallback(() => {
    if (announcement) markSeen(announcement.id);
    setAnnouncement(null);
  }, [announcement]);
  return { announcement, seen, dismiss };
}
