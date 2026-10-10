import { useRef } from "react";
import { Camera, Globe, Loader2, Lock, LogOut, UserPlus } from "lucide-react";
import { useT } from "@/lib/i18n";
import { groupPerms, type GroupDetail } from "@/lib/social/groups";
import { Avatar, timeAgo } from "@/views/profile/profile-bits";
import { fileToWebp } from "@/views/profile/group-image-utils";

export function GroupHero({
  detail,
  busy,
  onJoin,
  onLeave,
  onInvite,
  onPhoto,
  onOpenProfile,
}: {
  detail: GroupDetail;
  busy: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onInvite: () => void;
  onPhoto: (blob: Blob) => void;
  onOpenProfile?: (handle: string) => void;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const owner = detail.members.find((m) => m.role === "owner");
  const canEditGroup = groupPerms(detail).editGroup;

  return (
    <header className="relative flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-5">
        <div className="relative shrink-0">
          <Avatar src={detail.avatarUrl} size={104} alias={detail.name} />
          {canEditGroup && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                aria-label={detail.avatarUrl ? t("Change group photo") : t("Add group photo")}
                className="absolute -bottom-1 -end-1 grid h-9 w-9 place-items-center rounded-full bg-elevated text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink disabled:opacity-60"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void fileToWebp(file, 512).then(onPhoto);
                }}
              />
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <h1 className="font-display text-[32px] font-medium leading-[1.08] tracking-tight text-ink sm:text-[40px]">
            {detail.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-subtle">
            <span className="flex items-center gap-1.5">
              {detail.visibility === "public" ? <Globe size={13} /> : <Lock size={13} />}
              {detail.visibility === "public" ? t("Public group") : t("Invite only")}
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {detail.memberCount} {detail.memberCount === 1 ? t("member") : t("members")}
            </span>
            {owner && (
              <>
                <span aria-hidden>·</span>
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(owner.handle)}
                  className="transition-colors hover:text-ink"
                >
                  {t("by @{handle}", { handle: owner.handle })}
                </button>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{t("created {when}", { when: timeAgo(detail.createdAt) })}</span>
          </div>
          {detail.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {detail.tags.map((tg) => (
                <span key={tg} className="rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-muted ring-1 ring-edge-soft">
                  {tg}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {(detail.isOwner || detail.isMember) && (
            <button
              type="button"
              onClick={onInvite}
              className="flex h-11 items-center gap-2 rounded-full bg-surface px-4 text-[13px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-elevated hover:text-ink active:scale-[0.97]"
            >
              <UserPlus size={16} /> {t("Invite")}
            </button>
          )}
          {detail.isPending ? null : !detail.isMember && !detail.isOwner ? (
            <button
              type="button"
              onClick={onJoin}
              disabled={busy}
              className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} strokeWidth={2.4} />}
              {t("Join group")}
            </button>
          ) : detail.isOwner ? null : (
            <button
              type="button"
              onClick={onLeave}
              disabled={busy}
              className="flex h-11 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:text-danger hover:ring-danger/40 disabled:opacity-50"
            >
              <LogOut size={16} /> {t("Leave")}
            </button>
          )}
        </div>
      </div>

      {detail.description && (
        <p className="max-w-[70ch] text-[14px] leading-relaxed text-ink-muted">{detail.description}</p>
      )}
    </header>
  );
}
