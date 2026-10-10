import { useT } from "@/lib/i18n";
import type { GroupRole } from "@/lib/social/groups";

const STYLE: Record<GroupRole, string> = {
  owner: "bg-accent/12 text-accent",
  admin: "bg-ink/10 text-ink",
  manager: "bg-elevated text-ink-subtle ring-1 ring-edge-soft",
  member: "",
};

const LABEL: Record<GroupRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
};

export function roleLabel(role: GroupRole): string {
  return LABEL[role];
}

export function RoleBadge({ role, className = "" }: { role: GroupRole; className?: string }) {
  const t = useT();
  if (role === "member") return null;
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] ${STYLE[role]} ${className}`}
    >
      {t(LABEL[role])}
    </span>
  );
}
