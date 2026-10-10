import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  groupPerms,
  myGroupRole,
  ROLE_RANK,
  setMemberRole,
  type GroupDetail,
  type GroupMember,
  type GroupRole,
} from "@/lib/social/groups";
import { Avatar } from "@/views/profile/profile-bits";
import { UserHoverCard } from "@/views/profile/user-hover-card";
import { MemberRoleMenu } from "./member-role-menu";
import { RoleBadge } from "./role-badge";

export function GroupMembers({
  detail,
  onInvite,
  onKick,
  onOpenProfile,
  onApply,
}: {
  detail: GroupDetail;
  onInvite: () => void;
  onKick: (userId: string) => void;
  onOpenProfile?: (handle: string) => void;
  onApply?: (d: GroupDetail) => void;
}) {
  const t = useT();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const perms = groupPerms(detail);
  const myRank = ROLE_RANK[myGroupRole(detail)];
  const ordered = [...detail.members].sort(
    (a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.alias.localeCompare(b.alias),
  );

  const changeRole = async (userId: string, role: GroupRole) => {
    setPending(userId);
    setError(null);
    try {
      onApply?.(await setMemberRole(detail.id, userId, role));
    } catch (e) {
      setError((e as Error).message || t("Could not change that role."));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {perms.invite && (
        <button
          type="button"
          onClick={onInvite}
          className="flex min-h-[64px] items-center gap-3 rounded-lg border border-dashed border-edge bg-surface/30 px-4 text-start text-ink-muted transition-colors hover:border-edge hover:bg-surface hover:text-ink"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-elevated ring-1 ring-edge-soft">
            <UserPlus size={18} />
          </span>
          <span className="flex flex-col">
            <span className="text-[13.5px] font-semibold">{t("Invite a member")}</span>
            <span className="text-[12px] text-ink-subtle">{t("Add someone by their handle")}</span>
          </span>
        </button>
      )}
      {error && <p className="rounded-md bg-danger/15 px-3 py-2 text-[12.5px] text-danger">{error}</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ordered.map((m, i) => (
          <MemberCard
            key={m.userId}
            member={m}
            index={i}
            myRank={myRank}
            canManageRoles={perms.manageRoles}
            canRemove={perms.kick && m.role !== "owner" && ROLE_RANK[m.role] < myRank}
            busy={pending === m.userId}
            onOpen={onOpenProfile}
            onRole={(role) => void changeRole(m.userId, role)}
            onRemove={() => onKick(m.userId)}
          />
        ))}
      </div>
    </div>
  );
}

function MemberCard({
  member,
  index,
  myRank,
  canManageRoles,
  canRemove,
  busy,
  onOpen,
  onRole,
  onRemove,
}: {
  member: GroupMember;
  index: number;
  myRank: number;
  canManageRoles: boolean;
  canRemove: boolean;
  busy: boolean;
  onOpen?: (h: string) => void;
  onRole: (role: GroupRole) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const editableRole = canManageRoles && member.role !== "owner" && ROLE_RANK[member.role] < myRank;
  return (
    <div
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms`, animationDuration: "400ms", animationFillMode: "both" }}
      className="group/member flex items-center gap-3 rounded-lg bg-surface p-3 ring-1 ring-edge-soft transition-colors hover:bg-elevated motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
    >
      <UserHoverCard handle={member.handle}>
        <button
          type="button"
          onClick={() => onOpen?.(member.handle)}
          className="flex min-w-0 flex-1 items-center gap-3 text-start"
        >
          <Avatar src={member.avatarUrl} size={42} online={member.online} alias={member.alias} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-ink">{member.alias}</span>
            <span className="block truncate text-[12px] text-ink-subtle">
              {member.slogan || `@${member.handle}`}
            </span>
          </span>
        </button>
      </UserHoverCard>
      {editableRole ? (
        <MemberRoleMenu role={member.role} myRank={myRank} busy={busy} onPick={onRole} />
      ) : (
        <RoleBadge role={member.role} />
      )}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("Remove {alias}", { alias: member.alias })}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-subtle opacity-0 transition-[opacity,color,background-color] hover:bg-danger/15 hover:text-danger focus-visible:opacity-100 group-hover/member:opacity-100"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
