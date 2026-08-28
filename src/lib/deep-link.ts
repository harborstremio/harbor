import { makeSafeTauriUnlisten } from "@/lib/tauri-unlisten";

const EVENT = "harbor:deeplink-install";
const OPEN_EVENT = "harbor:deeplink-open";
const OPEN_LIST_EVENT = "harbor:deeplink-open-list";
const PROFILE_EDIT_EVENT = "harbor:deeplink-profile-edit";

type DeepLinkDetail = { rawUrl: string };
type DeepLinkOpen = { type: string; id: string; videoId?: string };
type DeepLinkOpenDetail = { open: DeepLinkOpen };
export type DeepLinkList = { handle: string; listId: string };
type DeepLinkListDetail = { list: DeepLinkList };

let pendingUrl: string | null = null;

export function emitDeepLinkInstall(rawUrl: string): void {
  pendingUrl = rawUrl;
  window.dispatchEvent(new CustomEvent<DeepLinkDetail>(EVENT, { detail: { rawUrl } }));
}

export function consumePendingDeepLink(): string | null {
  const url = pendingUrl;
  pendingUrl = null;
  return url;
}

export function peekPendingDeepLink(): string | null {
  return pendingUrl;
}

export function clearPendingDeepLink(): void {
  pendingUrl = null;
}

export function onDeepLinkInstall(handler: (rawUrl: string) => void): () => void {
  const listener = (e: Event) => {
    const ev = e as CustomEvent<DeepLinkDetail>;
    if (ev.detail?.rawUrl) handler(ev.detail.rawUrl);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function emitDeepLinkOpen(open: DeepLinkOpen): void {
  window.dispatchEvent(new CustomEvent<DeepLinkOpenDetail>(OPEN_EVENT, { detail: { open } }));
}

export function onDeepLinkOpen(handler: (open: DeepLinkOpen) => void): () => void {
  const listener = (e: Event) => {
    const ev = e as CustomEvent<DeepLinkOpenDetail>;
    if (ev.detail?.open) handler(ev.detail.open);
  };
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}

export function emitDeepLinkOpenList(list: DeepLinkList): void {
  window.dispatchEvent(new CustomEvent<DeepLinkListDetail>(OPEN_LIST_EVENT, { detail: { list } }));
}

export function onDeepLinkOpenList(handler: (list: DeepLinkList) => void): () => void {
  const listener = (e: Event) => {
    const ev = e as CustomEvent<DeepLinkListDetail>;
    if (ev.detail?.list) handler(ev.detail.list);
  };
  window.addEventListener(OPEN_LIST_EVENT, listener);
  return () => window.removeEventListener(OPEN_LIST_EVENT, listener);
}

export function emitOpenProfileEdit(): void {
  window.dispatchEvent(new CustomEvent(PROFILE_EDIT_EVENT));
}

export function onOpenProfileEdit(handler: () => void): () => void {
  const listener = () => handler();
  window.addEventListener(PROFILE_EDIT_EVENT, listener);
  return () => window.removeEventListener(PROFILE_EDIT_EVENT, listener);
}

export function isProfileEditUrl(url: string): boolean {
  return url.startsWith("harbor://profile");
}

const OPEN_FILE_EVENT = "harbor:open-local-file";

export function emitOpenLocalFile(path: string): void {
  window.dispatchEvent(new CustomEvent<{ path: string }>(OPEN_FILE_EVENT, { detail: { path } }));
}

export function onOpenLocalFile(handler: (path: string) => void): () => void {
  const listener = (e: Event) => {
    const ev = e as CustomEvent<{ path: string }>;
    if (ev.detail?.path) handler(ev.detail.path);
  };
  window.addEventListener(OPEN_FILE_EVENT, listener);
  return () => window.removeEventListener(OPEN_FILE_EVENT, listener);
}

function parseDetailPath(path: string): DeepLinkOpen | null {
  const parts = path.split("/").filter((p) => p.length > 0);
  if (parts[0] !== "detail" || parts.length < 3) return null;
  const type = decodeURIComponent(parts[1]);
  const id = decodeURIComponent(parts[2]);
  if (!type || !id) return null;
  const videoId = parts[3] ? decodeURIComponent(parts[3]) : undefined;
  return { type, id, videoId };
}

export function parseStremioOpen(url: string): DeepLinkOpen | null {
  if (url.startsWith("stremio://")) return parseDetailPath(url.slice("stremio://".length));
  const hash = url.indexOf("#");
  if (hash !== -1 && url.includes("stremio.com")) {
    let frag = url.slice(hash + 1);
    if (frag.startsWith("/")) frag = frag.slice(1);
    return parseDetailPath(frag);
  }
  return null;
}

export function parseHarborOpen(url: string): DeepLinkOpen | null {
  if (!url.startsWith("harbor://")) return null;
  return parseDetailPath(url.slice("harbor://".length));
}

export function parseHarborList(url: string): DeepLinkList | null {
  if (!url.startsWith("harbor://")) return null;
  const parts = url
    .slice("harbor://".length)
    .split("/")
    .filter((p) => p.length > 0);
  if (parts[0] !== "list" || parts.length < 3) return null;
  const handle = decodeURIComponent(parts[1]);
  const listId = decodeURIComponent(parts[2]);
  if (!handle || !listId) return null;
  return { handle, listId };
}

function shouldForward(url: string): boolean {
  if (url.startsWith("harbor://")) return true;
  if (url.startsWith("stremio://")) {
    if (window.__harborInstallerOpen) return true;
    return !!window.__harborStremioDeeplink;
  }
  return url.includes("manifest.json");
}

// Windows can relaunch the app with its original deep-link argv (app-restart
// features, self-restarts), redelivering an old install URL on every start.
const LAUNCH_SEEN_KEY = "harbor.deeplink.launchseen.v1";
const LAUNCH_SEEN_MAX = 50;

function loadLaunchSeen(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LAUNCH_SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLaunchSeen(map: Record<string, number>): void {
  try {
    const entries = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, LAUNCH_SEEN_MAX);
    localStorage.setItem(LAUNCH_SEEN_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    return;
  }
}

export async function startDeepLinkBridge(): Promise<() => void> {
  const isTauri =
    typeof window !== "undefined" && ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);
  if (!isTauri) return () => {};
  try {
    const mod = await import("@tauri-apps/plugin-deep-link");
    const handle = (urls: string[]) => {
      for (const u of urls) {
        if (typeof u !== "string" || u.length === 0) continue;
        const open = parseStremioOpen(u) || parseHarborOpen(u);
        if (open) {
          emitDeepLinkOpen(open);
          continue;
        }
        const list = parseHarborList(u);
        if (list) {
          emitDeepLinkOpenList(list);
          continue;
        }
        if (isProfileEditUrl(u)) {
          emitOpenProfileEdit();
          continue;
        }
        if (shouldForward(u)) emitDeepLinkInstall(u);
      }
    };
    const unlisten = makeSafeTauriUnlisten(await mod.onOpenUrl(handle));
    const { listen } = await import("@tauri-apps/api/event");
    const unlistenNative = makeSafeTauriUnlisten(
      await listen<string>("harbor:stremio-deeplink", (e) => {
        const u = e.payload;
        if (typeof u !== "string" || !u) return;
        const open = parseStremioOpen(u) || parseHarborOpen(u);
        if (open) {
          emitDeepLinkOpen(open);
          return;
        }
        const list = parseHarborList(u);
        if (list) {
          emitDeepLinkOpenList(list);
          return;
        }
        if (isProfileEditUrl(u)) {
          emitOpenProfileEdit();
          return;
        }
        if (shouldForward(u)) emitDeepLinkInstall(u);
      }),
    );
    let lastCap = "";
    let lastCapAt = 0;
    const forwardLinuxBrowserInstall = async (e: { payload: string }) => {
      const u = e.payload;
      if (typeof u !== "string" || !u) return;
      const open = parseStremioOpen(u) || parseHarborOpen(u);
      if (open) {
        emitDeepLinkOpen(open);
        return;
      }
      const list = parseHarborList(u);
      if (list) {
        emitDeepLinkOpenList(list);
        return;
      }
      if (isProfileEditUrl(u)) {
        emitOpenProfileEdit();
        return;
      }
      const now = Date.now();
      if (u === lastCap && now - lastCapAt < 2500) return;
      lastCap = u;
      lastCapAt = now;
      emitDeepLinkInstall(u);
      const { invoke } = await import("@tauri-apps/api/core");
      invoke("browser_close").catch(() => {});
    };
    const unlistenBrowserCap = makeSafeTauriUnlisten(
      await listen<string>("harbor://browser-stremio-capture", forwardLinuxBrowserInstall),
    );
    const unlistenOpenFile = makeSafeTauriUnlisten(
      await listen<string>("harbor:open-file", (e) => {
        if (typeof e.payload === "string" && e.payload) emitOpenLocalFile(e.payload);
      }),
    );
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const pending = await invoke<string | null>("harbor_take_pending_file");
      if (typeof pending === "string" && pending) emitOpenLocalFile(pending);
    } catch {}
    try {
      const initial = await mod.getCurrent();
      if (initial && initial.length > 0) {
        const seen = loadLaunchSeen();
        const now = Date.now();
        const fresh: string[] = [];
        for (const u of initial) {
          if (typeof u !== "string" || !u) continue;
          if (!seen[u]) fresh.push(u);
          seen[u] = now;
        }
        saveLaunchSeen(seen);
        if (fresh.length > 0) handle(fresh);
      }
    } catch {}
    return () => {
      try {
        unlisten();
      } catch {}
      try {
        unlistenNative();
      } catch {}
      try {
        unlistenBrowserCap();
      } catch {}
      try {
        unlistenOpenFile();
      } catch {}
    };
  } catch (e) {
    console.warn("[harbor] deep-link bridge failed", e);
    return () => {};
  }
}
