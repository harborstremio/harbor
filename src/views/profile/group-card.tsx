import { ChevronRight } from "lucide-react";
import { Avatar } from "./profile-bits";
import { useT } from "@/lib/i18n";
import type { Group } from "@/lib/social/groups";

export function GroupCard({ group, onOpen }: { group: Group; onOpen: (id: string) => void }) {
  const t = useT();
  return (
    <button
      onClick={() => onOpen(group.id)}
      className="flex w-full min-h-11 items-center gap-3 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-elevated"
    >
      <Avatar src={group.avatarUrl} size={40} alias={group.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-ink">{group.name}</div>
        <div className="truncate text-[12px] text-ink-subtle">
          {group.memberCount} {group.memberCount === 1 ? t("member") : t("members")}
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-ink-subtle" aria-hidden />
    </button>
  );
}
