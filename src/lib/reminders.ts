import { useSyncExternalStore } from "react";
import { setItemWithRecovery } from "@/lib/storage-recovery";

const KEY = "harbor.reminders.v1";

export type ReminderTone = "chime" | "pulse" | "silent";

export type ReminderEntry = {
  id: string;
  name: string;
  poster?: string;
  type: "movie" | "series";
  episodes: boolean;
  seasons: boolean;
  tone: ReminderTone;
  lastNotifiedAt: number;
  createdAt: number;
  seenKeys?: string[];
};

type Store = Record<string, ReminderEntry>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

let cache: Store = read();
const subs = new Set<() => void>();

function emit() {
  for (const s of subs) s();
}

function persist() {
  setItemWithRecovery(KEY, JSON.stringify(cache));
}

function subscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function listReminders(): ReminderEntry[] {
  return Object.values(cache).sort((a, b) => b.createdAt - a.createdAt);
}

export function getReminder(metaId: string): ReminderEntry | undefined {
  return cache[metaId];
}

export function setReminder(entry: ReminderEntry): void {
  cache = { ...cache, [entry.id]: entry };
  persist();
  emit();
}

export function touchReminder(metaId: string, lastNotifiedAt: number): void {
  const cur = cache[metaId];
  if (!cur) return;
  cache = { ...cache, [metaId]: { ...cur, lastNotifiedAt } };
  persist();
  emit();
}

export function setReminderSeen(metaId: string, seenKeys: string[], lastNotifiedAt: number): void {
  const cur = cache[metaId];
  if (!cur) return;
  cache = { ...cache, [metaId]: { ...cur, seenKeys: seenKeys.slice(-800), lastNotifiedAt } };
  persist();
  emit();
}

export function removeReminder(metaId: string): void {
  if (!(metaId in cache)) return;
  const next = { ...cache };
  delete next[metaId];
  cache = next;
  persist();
  if (unseen.includes(metaId)) {
    unseen = unseen.filter((x) => x !== metaId);
    persistUnseen();
  }
  emit();
}

const UNSEEN_KEY = "harbor.reminders.unseen.v1";

function readUnseen(): string[] {
  try {
    const raw = localStorage.getItem(UNSEEN_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

let unseen: string[] = readUnseen();

function persistUnseen(): void {
  setItemWithRecovery(UNSEEN_KEY, JSON.stringify(unseen));
}

export function markReminderUnseen(metaId: string): void {
  if (unseen.includes(metaId)) return;
  unseen = [...unseen, metaId];
  persistUnseen();
  emit();
}

export function clearUnseenReminders(): void {
  if (unseen.length === 0) return;
  unseen = [];
  persistUnseen();
  emit();
}

export function useUnseenReminderCount(): number {
  return useSyncExternalStore(subscribe, () => unseen.length, () => 0);
}

export function useReminder(metaId: string | undefined): ReminderEntry | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (metaId ? cache[metaId] : undefined),
    () => undefined,
  );
}

export function useReminders(): ReminderEntry[] {
  return useSyncExternalStore(subscribe, listSnapshot, () => []);
}

let snapshot: ReminderEntry[] = listReminders();
function listSnapshot(): ReminderEntry[] {
  return snapshot;
}
subs.add(() => {
  snapshot = listReminders();
});

function note(ctx: AudioContext, freq: number, at: number, dur: number, kind: OscillatorType) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = kind;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(0.18, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

export function playTone(tone: ReminderTone): void {
  if (tone === "silent") return;
  try {
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const t0 = ctx.currentTime + 0.02;
    if (tone === "chime") {
      note(ctx, 880, t0, 0.22, "sine");
      note(ctx, 1174.7, t0 + 0.16, 0.3, "sine");
    } else {
      note(ctx, 523.25, t0, 0.18, "triangle");
      note(ctx, 523.25, t0 + 0.24, 0.26, "triangle");
    }
    window.setTimeout(() => void ctx.close(), 900);
  } catch {
    /* no audio */
  }
}

export async function ensureNotifyPermission(): Promise<boolean> {
  try {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const res = await Notification.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}

export function fireReminderNotification(entry: ReminderEntry, title: string, body: string): void {
  playTone(entry.tone);
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, silent: true });
    }
  } catch {
    /* notification unavailable */
  }
}
