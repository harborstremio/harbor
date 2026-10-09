import { invoke } from "@tauri-apps/api/core";

export type ProxyResult = {
  sessionId: string;
  url: string;
};

const pendingRelease = new Map<string, number>();

export async function registerStreamProxy(
  url: string,
  headers?: Record<string, string>,
  opts?: { transcode?: boolean; prebufferBytes?: number },
): Promise<ProxyResult> {
  const args: Record<string, unknown> = { url, headers: headers ?? {} };
  if (opts?.transcode) {
    args.transcode = true;
    args.profile = { force_h264: false, force_aac: false };
  }
  if (opts?.prebufferBytes && opts.prebufferBytes > 0) {
    args.prebufferBytes = opts.prebufferBytes;
  }
  const r = await invoke<{ session_id: string; url: string }>("proxy_register", { args });
  return { sessionId: r.session_id, url: r.url };
}

export async function unregisterStreamProxy(sessionId: string): Promise<void> {
  await invoke("proxy_unregister", { sessionId });
}

export function retainStreamProxy(sessionId: string): void {
  const timer = pendingRelease.get(sessionId);
  if (timer == null) return;
  window.clearTimeout(timer);
  pendingRelease.delete(sessionId);
}

export function releaseStreamProxy(sessionId: string): void {
  retainStreamProxy(sessionId);
  const timer = window.setTimeout(() => {
    pendingRelease.delete(sessionId);
    void unregisterStreamProxy(sessionId).catch(() => {});
  }, 1500);
  pendingRelease.set(sessionId, timer);
}
