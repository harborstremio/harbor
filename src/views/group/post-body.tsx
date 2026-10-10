import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { renderBbcode } from "@/lib/social/bbcode";
import { handleLinkOutActivation } from "@/lib/social/link-out-activation";
import { scanMentions } from "@/lib/social/mentions";
import { openLinkOut } from "@/lib/social/link-out";
import { requestOpenProfile } from "@/lib/social/open-profile";
import { useView } from "@/lib/view";
import {
  HOVER_CARD_CLOSE_MS,
  HOVER_CARD_OPEN_MS,
  ProfileHoverCard,
} from "@/views/profile/user-hover-card";

function mentionAt(target: EventTarget | null): { el: HTMLElement; handle: string } | null {
  const el = (target as HTMLElement | null)?.closest?.(
    "[data-harbor-mention]",
  ) as HTMLElement | null;
  const handle = el?.getAttribute("data-harbor-mention");
  return el && handle ? { el, handle } : null;
}

export function PostBody({
  body,
  onOpenProfile,
}: {
  body: string;
  onOpenProfile?: (handle: string) => void;
}) {
  const { openMeta, openManga } = useView();
  const [card, setCard] = useState<{ handle: string; anchor: DOMRect } | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const html = useMemo(() => renderBbcode(body, new Set(scanMentions(body).notified)), [body]);

  const clearOpen = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = null;
  };
  const clearClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    clearOpen();
    if (closeTimer.current) return;
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setCard(null);
    }, HOVER_CARD_CLOSE_MS);
  };

  useEffect(
    () => () => {
      clearOpen();
      clearClose();
    },
    [],
  );

  useEffect(() => {
    if (!card) return;
    const close = () => setCard(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [card]);

  const openProfile = (handle: string) => {
    clearOpen();
    clearClose();
    setCard(null);
    if (onOpenProfile) onOpenProfile(handle);
    else requestOpenProfile(handle);
  };

  const onClick = (e: ReactMouseEvent) => {
    const mention = mentionAt(e.target);
    if (mention) {
      e.preventDefault();
      openProfile(mention.handle);
      return;
    }
    const el = e.target as HTMLElement;
    const cardEl = el.closest?.("[data-harbor-media]");
    const mediaId = cardEl?.getAttribute("data-harbor-media");
    if (mediaId) {
      e.preventDefault();
      const kind = cardEl?.getAttribute("data-harbor-media-kind") ?? "movie";
      const name = cardEl?.getAttribute("data-harbor-media-title") ?? "";
      const poster = cardEl?.getAttribute("data-harbor-media-poster") || undefined;
      if (kind === "manga") openManga(mediaId);
      else
        openMeta({
          id: mediaId,
          type: kind === "series" || kind === "anime" ? "series" : "movie",
          name,
          poster,
        });
      return;
    }
    handleLinkOutActivation(e, openLinkOut);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const mention = mentionAt(e.target);
    if (!mention) return;
    e.preventDefault();
    openProfile(mention.handle);
  };

  const onMouseOver = (e: ReactMouseEvent) => {
    const mention = mentionAt(e.target);
    if (!mention) return;
    clearClose();
    if (card?.handle === mention.handle) return;
    clearOpen();
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      setCard({ handle: mention.handle, anchor: mention.el.getBoundingClientRect() });
    }, HOVER_CARD_OPEN_MS);
  };

  const onMouseOut = (e: ReactMouseEvent) => {
    if (mentionAt(e.target)) scheduleClose();
  };

  return (
    <>
      <div
        className="max-w-none break-words text-[14px] leading-relaxed text-ink-muted [&_a]:break-words"
        onClick={onClick}
        onAuxClick={(e) => handleLinkOutActivation(e, openLinkOut)}
        onKeyDown={onKeyDown}
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {card && (
        <ProfileHoverCard
          handle={card.handle}
          anchor={card.anchor}
          onEnter={clearClose}
          onLeave={scheduleClose}
        />
      )}
    </>
  );
}
