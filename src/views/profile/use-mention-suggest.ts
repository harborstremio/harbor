import { useEffect, useMemo, useState } from "react";
import { searchUsers, type UserHit } from "@/lib/social/user-search";
import type { Friend } from "./profile-types";

export type MentionHit = { handle: string; alias: string; avatarUrl?: string };

const MAX_HITS = 6;

export function useMentionSuggest(query: string | null, friends: Friend[] = []): MentionHit[] {
  const [remote, setRemote] = useState<MentionHit[]>([]);

  useEffect(() => {
    if (query === null || query.trim().length < 2) {
      setRemote([]);
      return;
    }
    const ctrl = new AbortController();
    const id = window.setTimeout(() => {
      searchUsers(query.trim(), ctrl.signal)
        .then((hits: UserHit[]) => {
          if (ctrl.signal.aborted) return;
          setRemote(hits.map((h) => ({ handle: h.handle, alias: h.alias, avatarUrl: h.avatarUrl })));
        })
        .catch(() => !ctrl.signal.aborted && setRemote([]));
    }, 220);
    return () => {
      ctrl.abort();
      window.clearTimeout(id);
    };
  }, [query]);

  return useMemo(() => {
    if (query === null) return [];
    const q = query.trim().toLowerCase();
    const local = friends.filter(
      (f) => !q || f.handle.toLowerCase().startsWith(q) || f.alias.toLowerCase().includes(q),
    );
    const seen = new Set<string>();
    const out: MentionHit[] = [];
    for (const f of local) {
      const k = f.handle.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ handle: f.handle, alias: f.alias, avatarUrl: f.avatarUrl });
      if (out.length >= MAX_HITS) return out;
    }
    for (const r of remote) {
      const k = r.handle.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
      if (out.length >= MAX_HITS) break;
    }
    return out;
  }, [query, friends, remote]);
}