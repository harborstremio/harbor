import { ArrowRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useTogether } from "@/lib/together/provider";
import { useView } from "@/lib/view";
import type { Meta } from "@/lib/cinemeta";

const AUTO_JOIN_MS = 4000;
const TICK_MS = 60;

export function TogetherInviteToast() {
  const { incomingInvite, dismissInvite } = useTogether();
  const { openPicker } = useView();
  const t = useT();
  const handledRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!incomingInvite) {
      handledRef.current = null;
      setProgress(0);
      return;
    }
    if (handledRef.current === incomingInvite.at) return;
    setProgress(0);
    const start = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const next = Math.min(1, elapsed / AUTO_JOIN_MS);
      setProgress(next);
      if (elapsed >= AUTO_JOIN_MS) {
        window.clearInterval(id);
        triggerJoin();
      }
    }, TICK_MS);
    return () => window.clearInterval(id);

    function triggerJoin() {
      if (!incomingInvite) return;
      if (handledRef.current === incomingInvite.at) return;
      handledRef.current = incomingInvite.at;
      const { invite } = incomingInvite;
      const meta: Meta = {
        id: invite.mediaId,
        type: invite.mediaType,
        name: invite.mediaTitle,
        poster: invite.posterUrl,
        background: invite.backgroundUrl,
        logo: invite.logoUrl,
        releaseInfo: invite.releaseInfo,
      };
      openPicker(meta, invite.episode, { autoPlay: invite.guestPick !== true });
      dismissInvite();
    }
  }, [incomingInvite, openPicker, dismissInvite]);

  if (!incomingInvite) return null;
  if (handledRef.current === incomingInvite.at) return null;
  const { name, invite } = incomingInvite;
  const guestPick = invite.guestPick === true;
  const subtitle = invite.episode
    ? `S${invite.episode.imdbSeason ?? invite.episode.season} · E${String(invite.episode.imdbEpisode ?? invite.episode.episode).padStart(2, "0")}`
    : null;

  const onJoin = () => {
    handledRef.current = incomingInvite.at;
    const meta: Meta = {
      id: invite.mediaId,
      type: invite.mediaType,
      name: invite.mediaTitle,
      poster: invite.posterUrl,
      background: invite.backgroundUrl,
      logo: invite.logoUrl,
      releaseInfo: invite.releaseInfo,
    };
    openPicker(meta, invite.episode, { autoPlay: !guestPick });
    dismissInvite();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[120] flex justify-center px-6">
      <div className="harbor-together-pill pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-full border border-edge bg-surface/98 px-2 py-2 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.75)] animate-popover-in">
        <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-full bg-canvas/60 ring-1 ring-edge-soft/60">
          {invite.backgroundUrl || invite.posterUrl ? (
            <img
              src={invite.backgroundUrl || invite.posterUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-canvas to-elevated" />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-0.5 pe-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-accent">
            {guestPick ? t("Pick your source") : t("{name} started watching", { name })}
          </span>
          <span className="flex items-center gap-2 truncate text-[13.5px] font-semibold text-ink">
            <span className="max-w-[280px] truncate">{invite.mediaTitle}</span>
            {subtitle && (
              <span className="font-mono text-[11px] tracking-[0.1em] text-ink-subtle">
                {subtitle}
              </span>
            )}
          </span>
        </div>

        <button
          onClick={onJoin}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-transform hover:scale-[1.04]"
        >
          {guestPick ? t("Choose") : t("Join")}{" "}
          <ArrowRight size={13} strokeWidth={2.4} className="dir-icon" />
        </button>

        <button
          onClick={dismissInvite}
          aria-label={t("Dismiss")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={15} strokeWidth={2.2} />
        </button>

        <div
          aria-hidden
          className="absolute inset-x-2 bottom-1 h-[2px] origin-left rtl:origin-right rounded-full bg-accent/70 transition-transform"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  );
}
