import { Lock, UsersRound } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { Group } from "@/lib/social/groups";
import { Avatar } from "@/views/profile/profile-bits";

function MemberStack({ group }: { group: Group }) {
  const people = (group.memberPreview ?? []).slice(0, 4);
  if (people.length === 0) return null;
  const extra = group.memberCount - people.length;
  return (
    <span className="flex items-center">
      {people.map((p, i) => (
        <span key={p.userId} className="-ms-1.5 first:ms-0" style={{ zIndex: people.length - i }}>
          <Avatar src={p.avatarUrl} size={22} alias={p.alias} />
        </span>
      ))}
      {extra > 0 && (
        <span className="-ms-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-elevated px-1 text-[10px] font-semibold tabular-nums text-ink-subtle ring-2 ring-edge-soft">
          +{extra}
        </span>
      )}
    </span>
  );
}

export function GroupTile({ group, index = 0, onOpen }: { group: Group; index?: number; onOpen: (id: string) => void }) {
  const t = useT();
  const members = `${group.memberCount} ${group.memberCount === 1 ? t("member") : t("members")}`;
  return (
    <button
      type="button"
      onClick={() => onOpen(group.id)}
      style={{ animationDelay: `${Math.min(index * 35, 420)}ms`, animationDuration: "460ms", animationFillMode: "both" }}
      className="harbor-group-tile group relative flex w-full flex-col gap-3 overflow-hidden rounded-lg bg-surface p-4 text-start ring-1 ring-edge-soft transition-[transform,box-shadow,background-color] duration-200 ease-out hover:bg-elevated hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 active:scale-[0.99] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-reduce:hover:translate-y-0 sm:hover:-translate-y-[3px]"
    >
      {group.avatarUrl && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-8 -z-10 opacity-[0.16] blur-3xl saturate-[1.35] transition-opacity duration-300 group-hover:opacity-[0.28]"
          style={{ backgroundImage: `url(${group.avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}

      <div className="flex min-w-0 items-center gap-3">
        <span className="transition-transform duration-200 ease-out motion-safe:group-hover:scale-[1.04]">
          <Avatar src={group.avatarUrl} size={48} alias={group.name} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-ink">{group.name}</span>
            {group.visibility === "invite" && <Lock size={12} className="shrink-0 text-ink-subtle" aria-label={t("Invite only")} />}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-subtle">
            <UsersRound size={12} className="shrink-0" />
            <span className="tabular-nums">{members}</span>
            {group.owner && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">@{group.owner.handle}</span>
              </>
            )}
          </span>
        </span>
      </div>

      {group.description && (
        <p className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">{group.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-0.5">
        <MemberStack group={group} />
        <span className="flex min-w-0 flex-wrap items-center justify-end gap-1">
          {group.tags.slice(0, 3).map((tg) => (
            <span key={tg} className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-medium text-ink-subtle ring-1 ring-edge-soft transition-colors group-hover:text-ink-muted">
              {tg}
            </span>
          ))}
        </span>
      </div>
    </button>
  );
}
