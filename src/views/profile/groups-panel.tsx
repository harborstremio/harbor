import { ChevronRight, Plus, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { fetchGroupInvites, fetchMyGroups, fetchUserGroups, type Group } from "@/lib/social/groups";
import { CreateGroupModal } from "./create-group-modal";
import { Avatar } from "@/views/profile/profile-bits";
import { GroupCard } from "./group-card";
import { PeopleSearchIcon } from "./people-search-icon";

function FindGroupRow({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      className="flex w-full min-h-11 items-center gap-3 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-elevated"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-elevated text-ink-muted ring-1 ring-edge-soft">
        <PeopleSearchIcon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-ink">{t("Find a group")}</div>
        <div className="truncate text-[12px] text-ink-subtle">{t("Browse public groups")}</div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-ink-subtle" aria-hidden />
    </button>
  );
}

export function GroupsPanel({ isOwner, handle }: { isOwner: boolean; handle: string }) {
  const t = useT();
  const { openGroup, openGroups } = useView();
  const [groups, setGroups] = useState<Group[]>([]);
  const [invites, setInvites] = useState<Group[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setPhase("loading");
      if (isOwner) {
        fetchGroupInvites(signal)
          .then((list) => !signal?.aborted && setInvites(list))
          .catch(() => {});
      }
      const req = isOwner ? fetchMyGroups(signal) : fetchUserGroups(handle, signal);
      req
        .then((list) => {
          if (signal?.aborted) return;
          setGroups(list);
          setPhase("ready");
        })
        .catch(() => {
          if (signal?.aborted) return;
          setPhase("error");
        });
    },
    [isOwner, handle],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  // On other people's profiles, only show the panel when they have public groups to show.
  if (!isOwner && (phase !== "ready" || groups.length === 0)) return null;

  return (
    <section aria-label={t("Groups")} className="mt-6 rounded-lg bg-surface p-4 ring-1 ring-edge-soft">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          <UsersRound size={20} /> {t("Groups")}
        </div>
        {isOwner && (
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-elevated px-3.5 text-[12px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink"
          >
            <Plus size={16} /> {t("Create")}
          </button>
        )}
      </div>

      {isOwner && invites.length > 0 && (
        <div className="mb-3 flex flex-col gap-2 rounded-md bg-elevated/60 p-2.5 ring-1 ring-accent/20">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
            {t("Invites")}
          </span>
          <div className={invites.length > 1 ? "flex flex-wrap gap-2" : "flex flex-col gap-1.5"}>
            {invites.map((g) => (
              <button
                key={g.id}
                onClick={() => openGroup(g.id)}
                className={`flex min-h-11 items-center gap-2.5 rounded-[8px] px-1.5 py-1 text-start transition-colors hover:bg-raised ${
                  invites.length > 1 ? "w-[calc(50%-0.25rem)]" : "w-full"
                }`}
              >
                <Avatar src={g.avatarUrl} size={32} alias={g.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{g.name}</span>
                  <span className="block truncate text-[11.5px] text-ink-subtle">
                    {t("Invited by {name}", { name: g.owner?.alias || g.owner?.handle || "?" })}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-ink-subtle" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "loading" ? (
        <p className="py-6 text-center text-[13px] text-ink-subtle">{t("Loading groups")}</p>
      ) : phase === "error" ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <p className="text-[13px] text-ink-subtle">{t("Could not load your groups.")}</p>
          <button
            onClick={() => load()}
            className="text-[12px] font-semibold text-accent transition-opacity hover:opacity-80"
          >
            {t("Try again")}
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-6 text-center">
          <p className="text-[13px] text-ink-subtle">{t("Create a group to watch and share together.")}</p>
          <button
            onClick={openGroups}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent transition-opacity hover:opacity-80"
          >
            <PeopleSearchIcon size={15} /> {t("or find a group")}
          </button>
        </div>
      ) : (
        <div className="harbor-scroll flex max-h-[380px] flex-col gap-0.5 overflow-y-auto pe-0.5">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} onOpen={openGroup} />
          ))}
          {isOwner && <FindGroupRow onClick={openGroups} />}
        </div>
      )}

      {createOpen && (
        <CreateGroupModal
          onClose={() => setCreateOpen(false)}
          onCreated={(g) => {
            load();
            openGroup(g.id);
          }}
        />
      )}
    </section>
  );
}
