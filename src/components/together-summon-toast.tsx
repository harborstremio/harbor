import { ArrowRight, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useTogether } from "@/lib/together/provider";
import { useSelfIdentity } from "@/lib/together/use-self-identity";
import { useView, type View } from "@/lib/view";
import type { Meta } from "@/lib/cinemeta";
import { Avatar } from "./together-modal/avatar";

export function TogetherSummonToast() {
  const t = useT();
  const { incomingSummon, dismissSummon, snapshot, clientId } = useTogether();
  const { avatar: selfAvatar, color: selfColor } = useSelfIdentity();
  const { openMeta, setView, openQueue, openAddonDetail, player } = useView();
  if (player || !incomingSummon) return null;
  const { from, name, target } = incomingSummon;
  const isSelf = from === clientId;
  const sender = snapshot.participants.find((p) => p.id === from);
  const avatarSrc = isSelf ? selfAvatar : (sender?.avatar ?? null);
  const avatarColor = isSelf ? selfColor : (sender?.color ?? null);

  const isViewTarget = target.view != null;
  const headline = target.addonId
    ? target.label || t("an addon")
    : isViewTarget
      ? target.label || viewLabel(target.view!)
      : target.mediaTitle || t("a title");

  const handleAccept = () => {
    if (target.view) {
      if (target.view === "queue") openQueue();
      else setView(target.view as View);
    } else if (target.addonId) {
      openAddonDetail(target.addonId);
    } else if (target.mediaId && target.mediaType && target.mediaTitle) {
      const meta: Meta = {
        id: target.mediaId,
        type: target.mediaType,
        name: target.mediaTitle,
        poster: target.posterUrl,
        background: target.backgroundUrl,
        releaseInfo: target.releaseInfo,
      };
      openMeta(meta);
    }
    dismissSummon();
  };

  function viewLabel(v: string): string {
    if (v === "home") return t("Home");
    if (v === "discover") return t("Discover");
    if (v === "anime") return t("Anime");
    if (v === "queue") return t("My Library");
    return v;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[260] flex justify-center px-6">
      <div className="harbor-together-pill pointer-events-auto flex items-center gap-3 rounded-full border border-edge bg-surface/98 py-2 ps-2 pe-2 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.75)] animate-popover-in">
        <span className="shrink-0 ps-0.5">
          <Avatar name={name} src={avatarSrc} color={avatarColor} size={36} />
        </span>

        <div className="flex min-w-0 flex-col gap-0.5 pe-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-accent">
            {t("{name} wants you here", { name })}
          </span>
          <span className="max-w-[280px] truncate text-[13.5px] font-semibold text-ink">
            {headline}
          </span>
        </div>

        <button
          onClick={handleAccept}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-transform hover:scale-[1.04]"
        >
          {t("Sure")}
          <ArrowRight size={13} strokeWidth={2.4} />
        </button>

        <button
          onClick={dismissSummon}
          aria-label={t("Dismiss")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={15} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
