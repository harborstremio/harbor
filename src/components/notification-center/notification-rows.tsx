import { ArrowDownToLine, AtSign, Award, Check, LifeBuoy, MessageSquare, Star, UserPlus, Users, X } from "lucide-react";
import { CoverImg } from "@/components/cover-img";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import type { CenterNotif } from "@/lib/social/notifications";
import type { PendingRequest } from "@/lib/social/friends";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function timeAgo(ms: number, t: Translate): string {
  if (!ms) return "";
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return t("just now");
  const m = Math.round(s / 60);
  if (m < 60) return t("{n}m ago", { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t("{n}h ago", { n: h });
  const d = Math.round(h / 24);
  if (d < 7) return t("{n}d ago", { n: d });
  return t("{n}w ago", { n: Math.round(d / 7) });
}

function fullDate(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function iconFor(kind: string) {
  if (kind === "downloads") return ArrowDownToLine;
  if (kind === "stars") return Star;
  if (kind === "mention") return AtSign;
  if (kind === "friend-request") return UserPlus;
  if (kind === "group-added" || kind === "group-post") return Users;
  if (kind === "badge-received") return Award;
  if (kind === "diagnostics-request") return LifeBuoy;
  return MessageSquare;
}

function iconTint(kind: string): string {
  if (kind === "badge-received" || kind === "stars" || kind === "downloads" || kind === "mention")
    return "text-accent";
  return "text-ink-muted";
}

const GENERIC_TITLES = new Set(["", "Notification", "New badge unlocked", "New badge"]);

function titleCase(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function badgeName(notif: CenterNotif): string {
  const raw = (notif.body || "").trim();
  if (!raw || raw.length > 24 || /[.!?]/.test(raw)) return "";
  return titleCase(raw);
}

const TITLE_BY_KIND: Record<string, string> = {
  "friend-request": "Friend request",
  comment: "New comment",
  "group-added": "Group invite",
  "group-post": "New group post",
  mention: "You were mentioned",
  downloads: "Downloads milestone",
  stars: "Ratings milestone",
  "diagnostics-request": "Diagnostics requested",
  system: "Message from Harbor",
};

export function notifTitle(notif: CenterNotif, t: Translate): string {
  if (notif.kind === "badge-received") {
    const name = badgeName(notif);
    if (name) return t("You earned the {name} badge", { name });
    if (notif.title && !GENERIC_TITLES.has(notif.title)) return notif.title;
    return t("You earned a new badge");
  }
  const known = TITLE_BY_KIND[notif.kind];
  if (known) return t(known);
  if (notif.title && !GENERIC_TITLES.has(notif.title)) return notif.title;
  return t("Notification");
}

type DetailAction = { label: string; run: () => void };

function detailAction(
  notif: CenterNotif,
  onBack: () => void,
  onOpenProfile: (handle: string) => void,
  ownHandle: string | null | undefined,
  t: Translate,
): DetailAction | null {
  if (notif.kind === "badge-received" && ownHandle)
    return { label: t("View badges"), run: () => onOpenProfile(ownHandle) };
  if (notif.kind === "comment" && notif.source === "social" && ownHandle)
    return { label: t("View profile"), run: () => onOpenProfile(ownHandle) };
  if (notif.kind === "friend-request") return { label: t("Review request"), run: onBack };
  return null;
}

export function RequestRow({
  request,
  busy,
  onAccept,
  onDecline,
  onOpen,
}: {
  request: PendingRequest;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onOpen: (handle: string) => void;
}) {
  const from = request.from;
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-edge-soft bg-canvas/40 p-2.5">
      <button type="button" onClick={() => onOpen(from.handle)} className="shrink-0">
        <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-elevated">
          {from.avatarUrl ? (
            <img src={from.avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <UserPlus size={16} className="text-ink-subtle" />
          )}
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <button type="button" onClick={() => onOpen(from.handle)} className="truncate text-start text-[13px] font-semibold text-ink hover:underline">
          {from.alias || `@${from.handle}`}
        </button>
        <span className="truncate text-[11.5px] text-ink-subtle">{request.slogan || t("wants to connect")}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onAccept}
          disabled={busy}
          className="harbor-press-pop flex h-8 items-center gap-1 rounded-full bg-ink px-3 text-[12px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Check size={13} strokeWidth={2.6} /> {t("Accept")}
        </button>
        <button
          type="button"
          onClick={onDecline}
          disabled={busy}
          className="grid h-8 w-8 place-items-center rounded-full border border-edge-soft text-ink-muted transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-40"
          aria-label={t("Decline")}
        >
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

export function FeedRow({
  notif,
  index,
  onDismiss,
  onOpen,
}: {
  notif: CenterNotif;
  index: number;
  onDismiss: (id: string) => void;
  onOpen: (notif: CenterNotif) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const t = useT();
  const Icon = iconFor(notif.kind);
  const dismiss = () => {
    if (removing) return;
    setRemoving(true);
    window.setTimeout(() => onDismiss(notif.id), 200);
  };
  return (
    <div
      className={`overflow-hidden transition-all duration-200 ease-out ${
        removing ? "max-h-0 scale-[0.98] opacity-0" : "max-h-40 opacity-100"
      } motion-reduce:transition-none`}
    >
      <div
        className={`group relative flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors ${
          notif.read
            ? `hover:bg-white/[0.045] ${index % 2 === 1 ? "bg-white/[0.02]" : ""}`
            : "bg-accent/[0.055] hover:bg-accent/[0.09]"
        }`}
      >
        {!notif.read && (
          <span className="pointer-events-none absolute inset-y-2 start-0 w-0.5 rounded-full bg-accent/50" />
        )}
        <button
          type="button"
          onClick={() => onOpen(notif)}
          className="flex min-w-0 flex-1 items-start gap-3 text-start outline-none"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-elevated/80 ring-1 ring-inset ring-white/[0.06]">
            {notif.cover ? (
              <CoverImg src={notif.cover} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <Icon size={15} className={iconTint(notif.kind)} />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] leading-snug text-ink group-hover:underline">{notifTitle(notif, t)}</span>
            {notif.body && <span className="truncate text-[11.5px] text-ink-subtle">{notif.body}</span>}
            <span className="mt-0.5 text-[10.5px] text-ink-subtle">{timeAgo(notif.createdAt, t)}</span>
          </span>
        </button>
        <div className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
          {!notif.read && (
            <span className="h-2 w-2 rounded-full bg-accent transition-opacity duration-150 group-hover:opacity-0" />
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("Dismiss notification")}
            className="absolute inset-0 grid place-items-center rounded-full text-ink-subtle opacity-0 outline-none transition-all duration-150 hover:bg-elevated hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotificationDetail({
  notif,
  onBack,
  onOpenProfile,
  ownHandle,
}: {
  notif: CenterNotif;
  onBack: () => void;
  onOpenProfile: (handle: string) => void;
  ownHandle?: string | null;
}) {
  const t = useT();
  const Icon = iconFor(notif.kind);
  const action = detailAction(notif, onBack, onOpenProfile, ownHandle, t);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 p-5">
      <div className="flex flex-col items-center gap-3.5 pt-3 text-center">
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-elevated">
          {notif.cover ? (
            <CoverImg src={notif.cover} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <Icon size={26} className={iconTint(notif.kind)} strokeWidth={1.8} />
          )}
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[18px] font-medium leading-snug text-ink">{notifTitle(notif, t)}</span>
          {notif.body && <span className="text-[13px] leading-relaxed text-ink-muted">{notif.body}</span>}
        </div>
        <span className="text-[11.5px] text-ink-subtle">{fullDate(notif.createdAt)}</span>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.run}
          className="harbor-press-pop mt-auto flex h-11 items-center justify-center rounded-xl bg-ink text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
