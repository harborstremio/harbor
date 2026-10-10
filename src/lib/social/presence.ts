import { useEffect, useState } from "react";
import { safeFetch } from "@/lib/safe-fetch";
import { authToken } from "@/lib/theme-auth";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

export type PresenceStatus = "online" | "away" | "dnd" | "offline";

export const PRESENCE_ORDER: PresenceStatus[] = ["online", "away", "dnd", "offline"];

export const PRESENCE_META: Record<
  PresenceStatus,
  { label: string; help: string; dot: string; text: string }
> = {
  online: {
    label: "Online",
    help: "Active and reachable",
    dot: "bg-success",
    text: "text-success",
  },
  away: { label: "Away", help: "Idle for now", dot: "bg-accent", text: "text-accent" },
  dnd: {
    label: "Do not disturb",
    help: "Silence notifications",
    dot: "bg-danger",
    text: "text-danger",
  },
  offline: {
    label: "Appear offline",
    help: "Look offline to others",
    dot: "bg-ink-subtle",
    text: "text-ink-subtle",
  },
};

const KEY = "harbor.presence.status";
const subs = new Set<() => void>();

function load(): PresenceStatus {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "online" || v === "away" || v === "dnd" || v === "offline") return v;
  } catch {
    /* ignore */
  }
  return "online";
}

let status: PresenceStatus = load();

export function currentStatus(): PresenceStatus {
  return status;
}

export function subscribeStatus(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

async function savePresence(next: PresenceStatus): Promise<void> {
  const token = authToken();
  if (!token) return;
  await safeFetch(`${HARBOR_API_BASE}/themes/api/social/me/profile`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ presence: next }),
  });
}

export function resolvePresence(value: unknown, online = false): PresenceStatus {
  if (value === "online" || value === "away" || value === "dnd" || value === "offline") {
    return value;
  }

  return online ? "online" : "offline";
}

export function presenceStatusLabel(value: PresenceStatus): string {
  return value === "offline" ? "Offline" : PRESENCE_META[value].label;
}

export function setStatus(next: PresenceStatus): void {
  if (next === status) return;
  status = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  for (const fn of subs) fn();
  void savePresence(next).catch(() => {});
}

export function useMyPresence(): PresenceStatus {
  const [s, setS] = useState<PresenceStatus>(currentStatus);
  useEffect(() => subscribeStatus(() => setS(currentStatus())), []);
  return s;
}
