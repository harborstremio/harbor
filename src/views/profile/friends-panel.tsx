import { UserPlus, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  PRESENCE_META,
  resolvePresence,
  type PresenceStatus,
} from "@/lib/social/presence";
import { AddFriendsModal } from "./add-friends-modal";
import { Avatar } from "./profile-bits";
import { UserHoverCard } from "./user-hover-card";
import type { Friend } from "./profile-types";

const FRIENDS_PAGE = 6;
const FRIENDS_STEP = 12;

function friendPresence(f: Friend): PresenceStatus {
  return resolvePresence(f.presence ?? f.status, f.online);
}

function friendDotClass(f: Friend): string {
  return PRESENCE_META[friendPresence(f)].dot;
}

function FriendRow({ f, onOpen }: { f: Friend; onOpen?: (h: string) => void }) {
  const presence = friendPresence(f);
  return (
    <UserHoverCard handle={f.handle} presence={presence}>
      <button
        onClick={() => onOpen?.(f.handle)}
        className="flex w-full min-h-11 items-center gap-3 rounded-[10px] px-2 py-1.5 text-start transition-colors hover:bg-elevated"
      >
        <Avatar src={f.avatarUrl} size={40} dotClass={friendDotClass(f)} alias={f.alias} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-ink">{f.alias}</div>
          <div className="truncate text-[12px] text-ink-subtle">{f.slogan || `@${f.handle}`}</div>
        </div>
      </button>
    </UserHoverCard>
  );
}

export function FriendsPanel({
  friends,
  onOpen,
  isOwner = false,
  total,
  visibilityPrivate = false,
}: {
  friends: Friend[];
  onOpen?: (h: string) => void;
  isOwner?: boolean;
  total?: number;
  visibilityPrivate?: boolean;
}) {
  const t = useT();
  const [addOpen, setAddOpen] = useState(false);
  const [shown, setShown] = useState(FRIENDS_PAGE);
  const online = friends.filter((f) => f.online);
  const offline = friends.filter((f) => !f.online);
  const ordered = [...online, ...offline];
  const visible = ordered.slice(0, shown);
  const vOnline = visible.filter((f) => f.online);
  const vOffline = visible.filter((f) => !f.online);
  const remaining = ordered.length - visible.length;
  const paginated = ordered.length > FRIENDS_PAGE;
  const listRef = useRef<HTMLDivElement | null>(null);
  const [lockH, setLockH] = useState<number | null>(null);
  useEffect(() => {
    if (lockH != null || !paginated) return;
    const h = listRef.current?.getBoundingClientRect().height ?? 0;
    if (h > 0) setLockH(h);
  }, [lockH, paginated, friends.length]);
  const mutual = friends.filter((f) => f.mutual);
  return (
    <section
      aria-label={t("Friends")}
      className="rounded-[14px] bg-surface p-4 ring-1 ring-edge-soft"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          <Users size={20} /> {t("Friends")}
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-elevated px-3 text-[12px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink"
            >
              <UserPlus size={14} /> {t("Add")}
            </button>
          )}
          <span className="text-[12px] tabular-nums text-ink-subtle">
            {visibilityPrivate ? (
              total ?? 0
            ) : (
              <>
                <span className="text-success">{online.length}</span> / {total ?? friends.length}
              </>
            )}
          </span>
        </div>
      </div>
      {!isOwner && mutual.length > 0 && (
        <div className="mb-3 flex items-center gap-2.5 border-b border-edge-soft/60 pb-3">
          <div className="flex -space-x-2">
            {mutual.slice(0, 5).map((f) => (
              <span key={f.handle} className="inline-flex rounded-full ring-2 ring-surface">
                <Avatar src={f.avatarUrl} size={24} alias={f.alias} />
              </span>
            ))}
          </div>
          <span className="text-[12.5px] font-medium text-ink-muted">
            {mutual.length === 1
              ? t("1 friend in common")
              : t("{count} friends in common", { count: mutual.length })}
          </span>
        </div>
      )}
      {visibilityPrivate ? (
        <p className="py-6 text-center text-[13px] text-ink-subtle">
          {t("This user keeps their friends private")}
        </p>
      ) : friends.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-subtle">
          {isOwner ? t("Add friends to see them here.") : t("No friends to show yet")}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div
            ref={listRef}
            style={lockH != null ? { height: lockH } : undefined}
            className="harbor-scroll flex max-h-[440px] flex-col gap-0.5 overflow-y-auto pe-0.5"
          >
            {vOnline.length > 0 && (
              <div className="px-2 pb-1 pt-0.5 text-[11px] uppercase tracking-[0.1em] text-success">
                {t("Online now")}
              </div>
            )}
            {vOnline.map((f) => (
              <FriendRow key={f.handle} f={f} onOpen={onOpen} />
            ))}
            {vOffline.length > 0 && (
              <div className="px-2 pb-1 pt-3 text-[11px] uppercase tracking-[0.1em] text-ink-subtle">
                {t("Offline")}
              </div>
            )}
            {vOffline.map((f) => (
              <FriendRow key={f.handle} f={f} onOpen={onOpen} />
            ))}
          </div>
          {remaining > 0 && (
            <button
              onClick={() => setShown((s) => s + FRIENDS_STEP)}
              className="min-h-9 rounded-[10px] text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              {t("Show {count} more", { count: Math.min(remaining, FRIENDS_STEP) })}
            </button>
          )}
        </div>
      )}
      {isOwner && addOpen && (
        <AddFriendsModal
          onClose={() => setAddOpen(false)}
          existingHandles={friends.map((f) => f.handle)}
        />
      )}
    </section>
  );
}
