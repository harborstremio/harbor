import {
  cloneElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { requestOpenProfile } from "@/lib/social/open-profile";
import { regionFlagSrc } from "@/lib/region-flags";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useT } from "@/lib/i18n";
import { fetchBadges, fetchSummary } from "./profile-api";
import { orderShownBadges } from "./badge-catalog";
import { HoverTooltip } from "@/components/hover-tooltip";
import { Avatar, VerifiedCheck } from "./profile-bits";
import { useSelfAvatar } from "./use-self-avatar";
import type { Badge, ProfileSummary } from "./profile-types";

type CardData = { summary: ProfileSummary; badges: Badge[] };

const TTL = 30000;
const cache = new Map<string, { data: CardData; at: number }>();
const inflight = new Map<string, Promise<CardData>>();

function loadCard(handle: string): Promise<CardData> {
  const key = handle.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL) return Promise.resolve(cached.data);
  const pending = inflight.get(key);
  if (pending) return pending;
  const req = Promise.all([fetchSummary(key), fetchBadges(key).catch(() => [] as Badge[])])
    .then(([summary, badges]) => {
      const data: CardData = { summary, badges };
      cache.set(key, { data, at: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, req);
  return req;
}

const CARD_W = 300;

export function UserHoverCard({ handle, children }: { handle: string; children: ReactElement<any> }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const clearOpen = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = null;
  };
  const clearClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const scheduleOpen = () => {
    clearClose();
    if (openTimer.current || anchor) return;
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      if (ref.current) setAnchor(ref.current.getBoundingClientRect());
    }, HOVER_CARD_OPEN_MS);
  };
  const scheduleClose = () => {
    clearOpen();
    if (closeTimer.current) return;
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setAnchor(null);
    }, HOVER_CARD_CLOSE_MS);
  };

  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [anchor]);

  useEffect(() => () => {
    clearOpen();
    clearClose();
  }, []);

  const childProps = children.props as {
    onMouseEnter?: (e: unknown) => void;
    onMouseLeave?: (e: unknown) => void;
    onFocus?: (e: unknown) => void;
    onBlur?: (e: unknown) => void;
    onClick?: (e: unknown) => void;
  };

  const trigger = cloneElement(children, {
    ref,
    onMouseEnter: (e: ReactMouseEvent) => {
      childProps.onMouseEnter?.(e);
      scheduleOpen();
    },
    onMouseLeave: (e: ReactMouseEvent) => {
      childProps.onMouseLeave?.(e);
      scheduleClose();
    },
    onFocus: (e: ReactFocusEvent) => {
      childProps.onFocus?.(e);
      scheduleOpen();
    },
    onBlur: (e: ReactFocusEvent) => {
      childProps.onBlur?.(e);
      scheduleClose();
    },
    onClick: (e: ReactMouseEvent) => {
      clearOpen();
      clearClose();
      setAnchor(null);
      childProps.onClick?.(e);
    },
  });

  return (
    <>
      {trigger}
      {anchor && (
        <ProfileHoverCard handle={handle} anchor={anchor} onEnter={clearClose} onLeave={scheduleClose} />
      )}
    </>
  );
}

export const HOVER_CARD_OPEN_MS = 250;
export const HOVER_CARD_CLOSE_MS = 180;

export function ProfileHoverCard({
  handle,
  anchor,
  onEnter,
  onLeave,
}: {
  handle: string;
  anchor: DOMRect;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const t = useT();
  const reduced = useReducedMotion();
  const self = useSelfAvatar();
  const key = handle.toLowerCase();
  const [data, setData] = useState<CardData | null>(() => cache.get(key)?.data ?? null);
  const [failed, setFailed] = useState(false);
  const [placed, setPlaced] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadCard(key)
      .then((d) => !cancelled && setData(d))
      .catch(() => {
        if (!cancelled && !cache.get(key)) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const gap = 10;
    const h = el.offsetHeight;
    const leftSlot = anchor.left - gap - CARD_W;
    const left = leftSlot >= 12 ? leftSlot : Math.min(anchor.right + gap, window.innerWidth - CARD_W - 12);
    const top = Math.max(12, Math.min(anchor.top, window.innerHeight - h - 12));
    setPlaced({ top, left });
  }, [anchor, data, failed]);

  const summary = data?.summary;
  const badges = orderShownBadges(data?.badges ?? [], data?.summary?.shownBadges);
  const mine = !!self.handle && self.handle.toLowerCase() === key;
  const cardAvatar = mine ? self.avatar ?? summary?.avatarUrl : summary?.avatarUrl;
  const bio = summary?.slogan?.trim();
  const locationFlag = summary?.location ? regionFlagSrc(summary.location) : null;

  return createPortal(
    <div
      ref={cardRef}
      role="button"
      tabIndex={-1}
      aria-label={t("Open @{handle} profile", { handle: summary?.handle ?? handle })}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={() => requestOpenProfile(handle)}
      style={{
        width: CARD_W,
        left: placed?.left ?? anchor.left,
        top: placed?.top ?? anchor.bottom + 8,
        visibility: placed ? "visible" : "hidden",
      }}
      className={`fixed z-[260] cursor-pointer overflow-hidden rounded-[20px] border border-edge bg-elevated/95 shadow-[0_28px_70px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl ${
        reduced ? "" : "animate-popover-in"
      }`}
    >
      <div className="relative h-[72px] w-full">
        {summary?.bannerUrl ? (
          <img src={summary.bannerUrl} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-accent/25 via-raised to-surface" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-elevated/95 to-transparent" />
      </div>

      <div className="px-4 pb-4">
        <div className="-mt-9 mb-2.5 flex items-end justify-between">
          <span className="rounded-full bg-elevated p-[3px]">
            <Avatar src={cardAvatar} size={60} online={summary?.online} alias={summary?.alias ?? handle} />
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="truncate font-display text-[17px] font-semibold text-ink">
            {summary?.alias ?? `@${handle}`}
          </span>
          {summary?.verified && <VerifiedCheck size={16} />}
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-ink-subtle">@{summary?.handle ?? handle}</div>

        {summary ? (
          <>
            <div className="mt-2 flex items-center gap-2 text-[11.5px] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${summary.online ? "bg-success" : "bg-ink-subtle"}`} />
                {summary.online ? t("Online") : t("Offline")}
              </span>
              {summary.location && (
                <>
                  <span className="text-ink-subtle">·</span>
                  {locationFlag ? (
                    <img
                      src={locationFlag}
                      alt={summary.location}
                      title={summary.location}
                      draggable={false}
                      style={{
                        height: 12,
                        width: 18,
                        borderRadius: 2,
                        objectFit: "cover",
                        boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.4)",
                      }}
                    />
                  ) : (
                    <span className="truncate">{summary.location}</span>
                  )}
                </>
              )}
            </div>

            {badges.length > 0 && (
              <div className="mt-3 flex items-center gap-1.5">
                {badges.slice(0, 6).map((b) => (
                  <BadgeDot key={b.id} badge={b} />
                ))}
                {badges.length > 6 && (
                  <span className="text-[11px] font-medium text-ink-subtle">+{badges.length - 6}</span>
                )}
              </div>
            )}

            {bio && (
              <p className="mt-3 border-t border-edge-soft/60 pt-3 text-[12.5px] leading-relaxed text-ink-muted line-clamp-3">
                {bio}
              </p>
            )}
          </>
        ) : failed ? (
          <p className="mt-3 text-[12px] text-ink-subtle">{t("Preview unavailable. Click to open profile.")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            <div className={`h-3 w-24 rounded bg-raised ${reduced ? "" : "animate-pulse"}`} />
            <div className={`h-3 w-full rounded bg-raised ${reduced ? "" : "animate-pulse"}`} />
            <div className={`h-3 w-3/4 rounded bg-raised ${reduced ? "" : "animate-pulse"}`} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function BadgeDot({ badge }: { badge: Badge }) {
  return (
    <HoverTooltip
      label={badge.name}
      sublabel={badge.description || null}
      side="top"
      align="center"
      className="grid h-6 w-6 place-items-center"
    >
      {badge.iconUrl ? (
        <img src={badge.iconUrl} alt="" draggable={false} className="h-full w-full object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
      ) : (
        <span className="text-[10px] font-semibold text-ink">{badge.name.charAt(0).toUpperCase()}</span>
      )}
    </HoverTooltip>
  );
}
