import { makeSafeTauriUnlisten } from "@/lib/tauri-unlisten";

const EVENT = "harbor:deeplink-install";
const OPEN_EVENT = "harbor:deeplink-open";

type DeepLinkDetail = { rawUrl: string };
type DeepLinkOpen = { type: string; id: string; videoId?: string };
type DeepLinkOpenDetail = { open: DeepLinkOpen };

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

function shouldForward(url: string): boolean {
  if (url.startsWith("harbor://")) return true;
  if (url.startsWith("stremio://")) {
    if (window.__harborInstallerOpen) return true;
    return !!window.__harborStremioDeeplink;
  }
  return url.includes("manifest.json");
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
        const open = parseStremioOpen(u);
        if (open) {
          emitDeepLinkOpen(open);
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
        const open = parseStremioOpen(u);
        if (open) {
          emitDeepLinkOpen(open);
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
      const open = parseStremioOpen(u);
      if (open) {
        emitDeepLinkOpen(open);
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
      if (initial && initial.length > 0) handle(initial);
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
