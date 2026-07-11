import { invoke } from "@tauri-apps/api/core";

export type ProxyResult = {
  sessionId: string;
  url: string;
};

export async function registerStreamProxy(url: string, headers?: Record<string, string>): Promise<ProxyResult> {
  const r = await invoke<{ session_id: string; url: string }>("proxy_register", {
    args: { url, headers: headers ?? {} },
  });
  return { sessionId: r.session_id, url: r.url };
}

export async function unregisterStreamProxy(sessionId: string): Promise<void> {
  await invoke("proxy_unregister", { sessionId });
}
