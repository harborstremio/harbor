import {
  Activity,
  Check,
  ImagePlus,
  Loader2,
  MapPin,
  Settings2,
  Share2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ShareModal } from "./share-modal";
import { countryFlagSrc } from "@/components/flag";
import { acceptFriend, removeFriend, sendFriendRequest } from "@/lib/social/friends";
import { PRESENCE_META, useMyPresence } from "@/lib/social/presence";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import {
  sanitizeStatLayout,
  STAT_ORDER,
  watchMinutes,
  type StatKey,
} from "@/lib/profile-card-layout";
import { countryName } from "./flags";
import { saveSlogan } from "./profile-api";
import { orderShownBadges } from "./badge-catalog";
import { EditProfileHint } from "./edit-profile-hint";
import {
  Avatar,
  compactNumber,
  FeaturedBadge,
  formatWatchTime,
  StatPill,
  VerifiedCheck,
} from "./profile-bits";
import { StatusBubble } from "./status-bubble";
import type { ProfileSummary } from "./profile-types";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

type HeroBadge = { id: string; name: string; iconUrl?: string };

const STAT_GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-3 sm:grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-6",
};

export function ProfileHero({
  p,
  avatar,
  avatarFallback,
  mangaReadOverride,
  badges,
  userFont,
  hideBanner,
  onEdit,
  onPatch,
}: {
  p: ProfileSummary;
  avatar?: string;
  avatarFallback?: string;
  mangaReadOverride?: number;
  badges?: HeroBadge[];
  userFont?: string;
  hideBanner?: boolean;
  onEdit?: () => void;
  onPatch?: (next: ProfileSummary) => void;
}) {
  const t = useT();
  const { openFeed } = useView();
  const nameFont = userFont ? { fontFamily: `"${userFont}", var(--font-display)` } : undefined;
  const nameBadges = orderShownBadges(badges ?? [], p.shownBadges)
    .filter((b) => b.iconUrl)
    .slice(0, 6);
  const [sharing, setSharing] = useState(false);
  const shareUrl = `${HARBOR_API_BASE}/u/${p.customUrl || p.handle}`;
  const myStatus = useMyPresence();
  const meta = PRESENCE_META[myStatus];
  const dotClass = p.isOwner ? meta.dot : p.online ? "bg-success" : "bg-ink-subtle";
  const presenceLabel = p.isOwner
    ? myStatus === "online"
      ? t("Online now")
      : meta.label
    : p.online
      ? t("Online now")
      : t("Offline");
  const presenceText = p.isOwner ? meta.text : p.online ? "text-success" : "";
  const hiddenStats = new Set(sanitizeStatLayout(p.statLayout).hidden);
  const showStat = (k: StatKey) => !hiddenStats.has(k);
  const shownCount = STAT_ORDER.filter(showStat).length;
  const statCols = STAT_GRID[shownCount] || "grid-cols-3 sm:grid-cols-6";
  return (
    <header className="relative w-full overflow-hidden">
      <div className="relative h-48 w-full sm:h-60">
        {!hideBanner &&
          (p.bannerUrl ? (
            <img
              src={p.bannerUrl}
              alt=""
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-elevated), var(--color-surface) 55%, var(--color-canvas))",
              }}
            />
          ))}
        {!hideBanner && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to bottom, transparent 28%, var(--color-canvas))",
            }}
          />
        )}
        {p.isOwner && !p.bannerUrl && !hideBanner && onEdit && (
          <button
            onClick={onEdit}
            className="absolute end-4 top-24 inline-flex items-center gap-1.5 rounded-full bg-elevated/70 px-3 py-1.5 text-[12px] font-medium text-ink ring-1 ring-edge-soft backdrop-blur transition-colors hover:bg-elevated"
          >
            <ImagePlus size={14} /> {t("Add background")}
          </button>
        )}
      </div>

      <div className="relative mx-auto -mt-20 w-full max-w-6xl px-6 pb-6 lg:px-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-6">
          <div className="relative flex h-[124px] w-[124px] shrink-0">
            <Avatar
              src={avatar}
              fallbackSrc={avatarFallback}
              size={124}
              dotClass={dotClass}
              alias={p.alias}
            />
            <StatusBubble
              slogan={p.slogan}
              isOwner={p.isOwner}
              onSave={async (next) => {
                const s = await saveSlogan(next);
                onPatch?.(s);
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[30px] leading-tight text-ink" style={nameFont}>
                {p.alias}
              </h1>
              {p.verified && <VerifiedCheck size={22} />}
              {nameBadges.map((b) => (
                <HeroBadge key={b.id} badge={b} />
              ))}
              {p.featured && <FeaturedBadge />}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-subtle">
              <span className="text-ink-muted">@{p.handle}</span>
              {p.pronouns && <span>{p.pronouns}</span>}
              <span className={presenceText}>{presenceLabel}</span>
              {p.location && (
                <span className="inline-flex items-center gap-1.5">
                  {countryFlagSrc(p.location) ? (
                    <img
                      src={countryFlagSrc(p.location) ?? ""}
                      alt=""
                      draggable={false}
                      className="shrink-0"
                      style={{ height: 12, width: 18, borderRadius: 2, objectFit: "cover" }}
                    />
                  ) : (
                    <MapPin size={13} />
                  )}
                  {countryName(p.location)}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {p.isOwner && onEdit ? (
              <>
                <button
                  onClick={openFeed}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-surface px-4 text-[14px] font-medium text-ink ring-1 ring-edge transition-colors hover:bg-raised"
                >
                  <Activity size={18} /> {t("Activity")}
                </button>
                <button
                  onClick={() => setSharing(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-surface px-4 text-[14px] font-medium text-ink ring-1 ring-edge transition-colors hover:bg-raised"
                >
                  <Share2 size={18} /> {t("Share")}
                </button>
                <EditProfileHint enabled={p.isOwner}>
                  <button
                    onClick={onEdit}
                    className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-surface px-4 text-[14px] font-medium text-ink ring-1 ring-edge transition-colors hover:bg-raised"
                  >
                    <Settings2 size={18} /> {t("Edit profile")}
                  </button>
                </EditProfileHint>
              </>
            ) : (
              !p.isOwner && (
                <FriendButton
                  handle={p.handle}
                  initial={p.friendStatus ?? "none"}
                  edgeId={p.friendEdgeId}
                />
              )
            )}
          </div>
        </div>
        {sharing && (
          <ShareModal
            target={{
              heading: t("Share profile"),
              linkLabel: t("Profile link"),
              url: shareUrl,
              cardUrl: `${shareUrl}/card.png`,
              text: t("{name} on Harbor", { name: p.alias }),
              name: p.alias,
            }}
            onClose={() => setSharing(false)}
          />
        )}

        <div className={`mt-5 grid gap-2 sm:gap-3 ${statCols}`}>
          {showStat("watchTime") && <WatchTimePill totalMinutes={watchMinutes(p.counts)} />}
          {showStat("episodes") && (
            <StatPill value={compactNumber(p.counts.episodesWatched ?? 0)} label={t("Episodes")} />
          )}
          {showStat("movies") && (
            <StatPill value={compactNumber(p.counts.moviesWatched ?? 0)} label={t("Movies")} />
          )}
          {showStat("read") && (
            <StatPill
              value={compactNumber(
                mangaReadOverride ?? (p.counts as { mangaRead?: number }).mangaRead ?? 0,
              )}
              label={t("Read")}
            />
          )}
          {showStat("friends") && (
            <StatPill value={compactNumber(p.counts.friends)} label={t("Friends")} />
          )}
          {showStat("badges") && (
            <StatPill value={compactNumber(p.counts.badges)} label={t("Badges")} />
          )}
        </div>
      </div>
    </header>
  );
}

function HeroBadge({ badge }: { badge: HeroBadge }) {
  return (
    <span className="group/badge relative inline-flex">
      <img
        src={badge.iconUrl}
        width={22}
        height={22}
        alt={badge.name}
        draggable={false}
        className="inline-block"
      />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-elevated px-2 py-1 text-[11px] font-medium text-ink opacity-0 shadow-lg ring-1 ring-edge-soft transition-opacity duration-150 group-hover/badge:opacity-100">
        {badge.name}
      </span>
    </span>
  );
}

function WatchTimePill({ totalMinutes }: { totalMinutes: number }) {
  const t = useT();
  const { a, aVal, b, bVal, c, cVal } = formatWatchTime(totalMinutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="flex flex-col items-center rounded-[10px] bg-surface px-2 py-2.5 ring-1 ring-edge-soft">
      <span className="flex items-baseline tabular-nums">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {a}
        </span>
        <span className="ml-1 text-[17px] font-semibold text-ink">{pad(aVal)}</span>
        <span className="ml-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {b}
        </span>
        <span className="ml-1 text-[17px] font-semibold text-ink">{pad(bVal)}</span>
        <span className="ml-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {c}
        </span>
        <span className="ml-1 text-[17px] font-semibold text-ink">{pad(cVal)}</span>
      </span>
      <span className="text-[11px] uppercase tracking-[0.1em] text-ink-subtle">
        {t("Watch Time")}
      </span>
    </div>
  );
}

type FriendRel = NonNullable<ProfileSummary["friendStatus"]>;

const FRIEND_BTN =
  "inline-flex min-h-11 items-center gap-2 rounded-[10px] px-4 text-[14px] font-semibold transition-colors disabled:opacity-70";

function FriendButton({
  handle,
  initial,
  edgeId,
}: {
  handle: string;
  initial: FriendRel;
  edgeId?: string;
}) {
  const t = useT();
  const [rel, setRel] = useState<FriendRel>(initial);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const [error, setError] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const act = async (fn: () => Promise<unknown>, next: FriendRel) => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await fn();
      setRel(next);
      setHover(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  if (rel === "blocked") return null;

  if (rel === "friends") {
    return (
      <>
        <button
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={() => setConfirming(true)}
          disabled={busy}
          className={`${FRIEND_BTN} ${hover ? "bg-danger/12 text-danger ring-1 ring-danger/30" : "bg-surface text-ink ring-1 ring-edge"}`}
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : hover ? (
            <UserMinus size={18} />
          ) : (
            <Check size={18} strokeWidth={2.6} />
          )}
          {busy ? t("Removing...") : hover ? t("Remove friend") : t("Friends")}
        </button>
        {confirming && (
          <ConfirmRemoveFriend
            handle={handle}
            busy={busy}
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false);
              void act(() => removeFriend(handle), "none");
            }}
          />
        )}
      </>
    );
  }

  if (rel === "incoming") {
    return (
      <button
        onClick={() => (edgeId ? act(() => acceptFriend(edgeId), "friends") : undefined)}
        disabled={busy || !edgeId}
        className={`${FRIEND_BTN} bg-ink text-canvas hover:opacity-90`}
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Check size={18} strokeWidth={2.6} />
        )}
        {busy ? t("Accepting...") : t("Accept request")}
      </button>
    );
  }

  if (rel === "outgoing") {
    return (
      <button
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => act(() => removeFriend(handle), "none")}
        disabled={busy}
        className={`${FRIEND_BTN} ${hover ? "bg-danger/12 text-danger ring-1 ring-danger/30" : "bg-surface text-ink-muted ring-1 ring-edge"}`}
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" />
        ) : hover ? (
          <UserMinus size={18} />
        ) : (
          <Check size={18} strokeWidth={2.6} />
        )}
        {busy ? t("Canceling...") : hover ? t("Cancel request") : t("Requested")}
      </button>
    );
  }

  return (
    <button
      onClick={() => act(() => sendFriendRequest(handle), "outgoing")}
      disabled={busy}
      className={`${FRIEND_BTN} ${error ? "bg-surface text-ink ring-1 ring-edge" : "bg-ink text-canvas hover:opacity-90"}`}
    >
      {busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
      {busy ? t("Sending...") : error ? t("Try again") : t("Add friend")}
    </button>
  );
}

function ConfirmRemoveFriend({
  handle,
  busy,
  onCancel,
  onConfirm,
}: {
  handle: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      className="fixed inset-0 z-[200] grid place-items-center bg-canvas/70 p-6 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[380px] rounded-[16px] bg-elevated p-5 shadow-[0_28px_70px_-20px_rgba(0,0,0,0.85)] ring-1 ring-edge-soft"
      >
        <h2 className="text-[15px] font-semibold text-ink">{t("Remove friend?")}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-subtle">
          {t("@{handle} will be removed from your friends. You can add them again later.", {
            handle,
          })}
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 items-center rounded-full px-4 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex h-10 items-center gap-2 rounded-full bg-danger px-4 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} {t("Remove")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
