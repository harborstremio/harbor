import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { fetchFriends, type Friend } from "@/lib/social/friends";
import { mentionToken } from "@/lib/social/mentions";
import { Avatar } from "./profile-bits";

const MAX_OPTIONS = 6;
const TTL = 60000;

let cache: { at: number; data: Friend[] } | null = null;
let inflight: Promise<Friend[]> | null = null;

function loadFriends(): Promise<Friend[]> {
  if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.data);
  if (inflight) return inflight;
  inflight = fetchFriends()
    .then((friends) => {
      cache = { at: Date.now(), data: friends };
      inflight = null;
      return friends;
    })
    .catch(() => {
      inflight = null;
      return [] as Friend[];
    });
  return inflight;
}

function rank(friends: Friend[], query: string): Friend[] {
  const q = query.toLowerCase();
  if (!q) return friends.slice(0, MAX_OPTIONS);
  const hit = (f: Friend, fn: (v: string) => boolean) => fn(f.handle.toLowerCase()) || fn(f.alias.toLowerCase());
  const starts = friends.filter((f) => hit(f, (v) => v.startsWith(q)));
  const rest = friends.filter((f) => !starts.includes(f) && hit(f, (v) => v.includes(q)));
  return [...starts, ...rest].slice(0, MAX_OPTIONS);
}

export type MentionSuggest = ReturnType<typeof useMentionSuggest>;

export function useMentionSuggest(text: string, caret: number) {
  const token = useMemo(() => mentionToken(text, caret), [text, caret]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!token) {
      setDismissedAt(null);
      return;
    }
    let live = true;
    void loadFriends().then((f) => live && setFriends(f));
    return () => {
      live = false;
    };
  }, [token]);

  const options = useMemo(() => (token ? rank(friends, token.query) : []), [friends, token]);
  const open = !!token && options.length > 0 && dismissedAt !== token.start;
  const active = Math.max(0, Math.min(index, options.length - 1));

  useEffect(() => {
    setIndex(0);
  }, [token?.query]);

  return {
    token,
    options,
    open,
    index: active,
    move: (step: number) => setIndex((i) => (options.length ? (i + step + options.length) % options.length : 0)),
    hover: setIndex,
    dismiss: () => setDismissedAt(token?.start ?? null),
  };
}

export function MentionPicker({
  suggest,
  onPick,
}: {
  suggest: MentionSuggest;
  onPick: (friend: Friend) => void;
}) {
  const t = useT();
  if (!suggest.open) return null;
  return (
    <div
      role="listbox"
      aria-label={t("People you can mention")}
      className="absolute bottom-full start-0 z-30 mb-2 w-full overflow-hidden rounded-[12px] border border-edge-soft bg-elevated py-1 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
    >
      {suggest.options.map((f, i) => (
        <button
          key={f.handle}
          type="button"
          role="option"
          aria-selected={i === suggest.index}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => suggest.hover(i)}
          onClick={() => onPick(f)}
          className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-start transition-colors ${
            i === suggest.index ? "bg-raised" : ""
          }`}
        >
          <Avatar src={f.avatarUrl} size={28} online={f.online} alias={f.alias} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{f.alias}</span>
          <span className="shrink-0 text-[12px] text-ink-subtle">@{f.handle}</span>
        </button>
      ))}
    </div>
  );
}
