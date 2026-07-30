import { listNotifications, markNotificationsRead, type ThemeNotification } from "@/lib/theme-store";
import { badgeIconUrl } from "@/views/profile/badge-catalog";
import { socialGet, socialPost } from "./client";

export type SocialNotif = {
  id: string;
  type: string;
  read: boolean;
  createdAt: string | number;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

export type CenterNotif = {
  id: string;
  source: "theme" | "social";
  kind: string;
  title: string;
  body?: string;
  cover?: string;
  count?: number;
  edgeId?: string;
  entityType?: string;
  targetId?: string;
  data?: Record<string, unknown>;
  createdAt: number;
  read: boolean;
};

function ms(x: string | number | undefined): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Date.parse(x) || 0;
  return 0;
}

function themeToCenter(n: ThemeNotification): CenterNotif {
  const name = n.themeName || "Your theme";
  let title = `${n.actor || "Someone"} commented on ${name}`;
  if (n.type === "downloads") title = `${name} hit ${n.count} downloads`;
  else if (n.type === "stars") title = `${name} reached ${n.count} five-star ratings`;
  return {
    id: `t:${n.id}`,
    source: "theme",
    kind: n.type,
    title,
    cover: n.cover || undefined,
    count: n.count ?? undefined,
    createdAt: ms(n.createdAt),
    read: !!n.read,
  };
}

function socialToCenter(n: SocialNotif): CenterNotif {
  if (n.type === "badge-received" || n.type === "badge-earned") {
    const name = typeof n.data?.name === "string" ? n.data.name : undefined;
    const icon = typeof n.data?.icon === "string" ? n.data.icon : name;
    return {
      id: `s:${n.id}`,
      source: "social",
      kind: "badge-received",
      title: n.title || (name ? `You earned the ${name} badge` : "New badge unlocked"),
      body: n.body || (name ? "Congrats! Tap to view your badges." : undefined),
      cover: badgeIconUrl(icon),
      createdAt: ms(n.createdAt),
      read: !!n.read,
    };
  }
  if (n.type === "diagnostics-request") {
    const staff = (n.data?.staff ?? {}) as { name?: string };
    return {
      id: `s:${n.id}`,
      source: "social",
      kind: "diagnostics-request",
      title: n.title || `${staff.name || "Harbor Staff"} requested your diagnostics`,
      body: n.body || undefined,
      data: { ...(n.data || {}), requestId: n.entityId },
      createdAt: ms(n.createdAt),
      read: !!n.read,
    };
  }
  const isRequest = n.type === "friend-request" && n.entityType === "friendEdge";
  return {
    id: `s:${n.id}`,
    source: "social",
    kind: n.type,
    title: n.title || (n.type === "comment" ? "New profile comment" : "Notification"),
    body: n.body || undefined,
    edgeId: isRequest ? n.entityId : undefined,
    entityType: n.entityType,
    targetId: n.entityId,
    data: n.data,
    createdAt: ms(n.createdAt),
    read: !!n.read,
  };
}

export async function fetchAllNotifications(
  signal?: AbortSignal,
): Promise<{ items: CenterNotif[]; unread: number }> {
  const [theme, social] = await Promise.all([
    listNotifications().catch(() => ({ notifications: [] as ThemeNotification[], unread: 0 })),
    socialGet<{ notifications: SocialNotif[]; unread: number }>("/social/me/notifications", signal).catch(
      () => ({ notifications: [] as SocialNotif[], unread: 0 }),
    ),
  ]);
  const items = [
    ...(theme.notifications || []).map(themeToCenter),
    ...(social.notifications || []).map(socialToCenter),
  ].sort((a, b) => b.createdAt - a.createdAt);
  return { items, unread: (theme.unread || 0) + (social.unread || 0) };
}

export async function markAllNotificationsRead(): Promise<void> {
  await Promise.all([
    markNotificationsRead().catch(() => {}),
    socialPost("/social/me/notifications/read", {}).catch(() => {}),
  ]);
}
