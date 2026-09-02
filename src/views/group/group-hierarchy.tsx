import { useT } from "@/lib/i18n";
import type { GroupDetail, GroupMember, GroupRole } from "@/lib/social/groups";
import { Avatar } from "@/views/profile/profile-bits";
import { UserHoverCard } from "@/views/profile/user-hover-card";
import { RoleBadge } from "./role-badge";

const TIERS: Array<{ role: GroupRole; title: string; blurb: string }> = [
  { role: "owner", title: "Owner", blurb: "Runs the group" },
  { role: "admin", title: "Admins", blurb: "Manage members and posts" },
  { role: "manager", title: "Managers", blurb: "Post, moderate and invite" },
  { role: "member", title: "Members", blurb: "Everyone else" },
];

const MEMBER_PREVIEW = 12;

export function GroupHierarchy({
  detail,
  onOpenProfile,
}: {
  detail: GroupDetail;
  onOpenProfile?: (handle: string) => void;
}) {
  const t = useT();
  const byRole = new Map<GroupRole, GroupMember[]>();
  for (const m of detail.members) {
    const list = byRole.get(m.role);
    if (list) list.push(m);
    else byRole.set(m.role, [m]);
  }
  for (const list of byRole.values()) list.sort((a, b) => a.alias.localeCompare(b.alias));

  const tiers = TIERS.filter((tier) => (byRole.get(tier.role) ?? []).length > 0);
  if (tiers.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 ring-1 ring-edge-soft">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          {t("Who runs this group")}
        </span>
        <span className="text-[12.5px] text-ink-subtle">
          {t("{count} members in total", { count: String(detail.memberCount) })}
        </span>
      </div>

      {tiers.map((tier) => {
        const list = byRole.get(tier.role) ?? [];
        const shown = tier.role === "member" ? list.slice(0, MEMBER_PREVIEW) : list;
        const rest = list.length - shown.length;
        return (
          <div key={tier.role} className="flex flex-col gap-2 border-t border-edge-soft/60 pt-3.5 first:border-0 first:pt-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-ink">{t(tier.title)}</span>
              <RoleBadge role={tier.role} />
              <span className="ms-auto text-[12px] tabular-nums text-ink-subtle">{list.length}</span>
            </div>
            <span className="-mt-1 text-[11.5px] text-ink-subtle">{t(tier.blurb)}</span>
            <div className="flex flex-wrap gap-1.5">
              {shown.map((m) => (
                <UserHoverCard key={m.userId} handle={m.handle}>
                  <button
                    type="button"
                    onClick={() => onOpenProfile?.(m.handle)}
                    className="flex min-h-11 items-center gap-2 rounded-full bg-elevated py-1 pe-3 ps-1 text-start transition-colors hover:bg-raised"
                  >
                    <Avatar src={m.avatarUrl} size={28} online={m.online} alias={m.alias} />
                    <span className="max-w-[140px] truncate text-[12.5px] font-medium text-ink">{m.alias}</span>
                  </button>
                </UserHoverCard>
              ))}
              {rest > 0 && (
                <span className="flex min-h-11 items-center px-2 text-[12px] text-ink-subtle">
                  {t("and {count} more", { count: String(rest) })}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
