import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { currentAuthor } from "@/lib/theme-auth";
import { useView } from "@/lib/view";
import { InviteMemberModal } from "@/views/profile/invite-member-modal";
import { CanvasCard } from "@/views/profile/customization/canvas-frame";
import { useFontLink } from "@/views/profile/customization/apply";
import { GroupAbout } from "./group/group-about";
import { GroupInviteBanner } from "./group/group-invite-banner";
import { GroupHero } from "./group/group-hero";
import { GroupMembers } from "./group/group-members";
import { GroupPosts } from "./group/group-posts";
import { resolveGroupCustom } from "./group/group-custom";
import { useGroup } from "./group/use-group";

type Tab = "posts" | "members" | "about";

export function GroupView({ id, onOpenProfile }: { id: string; onOpenProfile?: (handle: string) => void }) {
  const t = useT();
  const { goBack, openGroups } = useView();
  const g = useGroup(id, goBack);
  const [tab, setTab] = useState<Tab>("posts");
  const [inviting, setInviting] = useState(false);
  const me = currentAuthor();
  const custom = g.detail ? resolveGroupCustom(g.detail) : null;
  useFontLink(custom?.fontHref ?? "");

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "posts", label: t("Posts") },
    { key: "members", label: t("Members"), count: g.detail?.memberCount },
    { key: "about", label: t("About") },
  ];

  return (
    <div
      className="relative h-full overflow-y-auto bg-canvas"
      style={{
        background: custom?.background || undefined,
        fontFamily: custom?.font ? `"${custom.font}", Inter, sans-serif` : undefined,
      }}
    >
      {g.detail?.avatarUrl && !custom?.background && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
          <div
            className="h-full w-full scale-125 opacity-[0.18] blur-[80px] saturate-[1.4]"
            style={{ backgroundImage: `url(${g.detail.avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/10 via-canvas/60 to-canvas" />
        </div>
      )}

      <div className="relative mx-auto w-full max-w-[980px] px-6 pb-24 pt-28 sm:px-10">
        {g.phase === "loading" && (
          <div className="grid place-items-center py-28 text-ink-subtle">
            <Loader2 size={24} className="animate-spin" />
          </div>
        )}

        {g.phase === "error" && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-edge bg-surface/30 px-6 py-20 text-center">
            <span className="text-[15px] font-semibold text-ink">{t("This group could not be loaded.")}</span>
            <span className="max-w-sm text-[13px] text-ink-subtle">
              {t("It may be invite only, or it no longer exists.")}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={g.reload}
                className="flex h-10 items-center rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
              >
                {t("Try again")}
              </button>
              <button
                type="button"
                onClick={openGroups}
                className="flex h-10 items-center rounded-full border border-edge-soft px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                {t("Browse groups")}
              </button>
            </div>
          </div>
        )}

        {g.phase === "ready" && g.detail && (
          <>
            <GroupHero
              detail={g.detail}
              busy={g.busy}
              onJoin={() => void g.join()}
              onLeave={() => void g.leave()}
              onInvite={() => setInviting(true)}
              onPhoto={(blob) => void g.changePhoto(blob)}
              onOpenProfile={onOpenProfile}
            />

            {g.error && (
              <p className="mt-4 rounded-md bg-danger/15 px-3 py-2 text-[12.5px] text-danger">{g.error}</p>
            )}

            {g.detail.isPending && (
              <div className="mt-6">
                <GroupInviteBanner detail={g.detail} onAccepted={g.apply} onDeclined={goBack} />
              </div>
            )}

            <nav className="sticky top-20 z-10 -mx-1 mb-5 mt-9 flex items-center gap-1 rounded-full bg-canvas/85 px-1 py-1 backdrop-blur-md">
              {tabs.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => setTab(x.key)}
                  className={`relative flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors duration-150 ${
                    tab === x.key ? "bg-elevated text-ink" : "text-ink-subtle hover:text-ink-muted"
                  }`}
                >
                  {x.label}
                  {x.count !== undefined && x.count > 0 && (
                    <span className="text-[11.5px] tabular-nums text-ink-subtle">{x.count}</span>
                  )}
                </button>
              ))}
            </nav>

            {tab === "posts" && custom?.hasCanvas && (
              <div className="mb-4">
                <CanvasCard
                  html={custom.html}
                  css={custom.css}
                  height={custom.height}
                  hiddenFromVisitors={custom.hiddenFromMembers}
                />
              </div>
            )}
            {tab === "posts" && (
              <GroupPosts
                detail={g.detail}
                meAvatar={me?.avatar ?? undefined}
                meAlias={me?.username}
                onOpenProfile={onOpenProfile}
              />
            )}
            {tab === "members" && (
              <GroupMembers
                detail={g.detail}
                onInvite={() => setInviting(true)}
                onKick={(userId) => void g.kick(userId)}
                onOpenProfile={onOpenProfile}
                onApply={g.apply}
              />
            )}
            {tab === "about" && (
              <GroupAbout
                detail={g.detail}
                busy={g.busy}
                onApply={g.apply}
                onDestroy={() => void g.destroy()}
                onOpenProfile={onOpenProfile}
              />
            )}
          </>
        )}
      </div>

      {inviting && g.detail && (
        <InviteMemberModal
          groupId={id}
          existingHandles={g.detail.members.map((m) => m.handle)}
          onClose={() => setInviting(false)}
          onChanged={g.apply}
        />
      )}
    </div>
  );
}
