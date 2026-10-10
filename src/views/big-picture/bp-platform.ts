import { invoke } from "@tauri-apps/api/core";

export type BpPlatform = {
  lanAddress: () => Promise<string | null>;
  fetchImageBytes: (url: string) => Promise<Blob | null>;
};

type HarborFetchResponse = { ok: boolean; body: string; contentType?: string | null };

const hasTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const U8 = Uint8Array as unknown as { fromBase64?: (input: string) => Uint8Array };

// The char loop is 60ms of blocked main thread for a 275KB poster on a Fire TV
// stick, against 1 to 10ms for the native decoder. Keep the loop: fromBase64
// throws on anything the host encoded loosely, and it is absent off Chromium.
function bytesFromBase64(b64: string): Uint8Array {
  const trimmed = b64.trim();
  if (typeof U8.fromBase64 === "function") {
    try {
      return U8.fromBase64(trimmed);
    } catch {
      /* fall through to the loop */
    }
  }
  const bin = atob(trimmed);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

const desktop: BpPlatform = {
  lanAddress: async () => {
    if (!hasTauri) return null;
    return invoke<string | null>("lan_ip").catch(() => null);
  },
  fetchImageBytes: async (url) => {
    if (!hasTauri) return null;
    try {
      const resp = await invoke<HarborFetchResponse>("harbor_fetch", {
        args: { url, method: "GET", responseType: "base64", timeoutMs: 15000 },
      });
      if (!resp?.ok || !resp.body) return null;
      return new Blob([bytesFromBase64(resp.body)], { type: resp.contentType || "image/jpeg" });
    } catch {
      return null;
    }
  },
};

let current: BpPlatform = desktop;

export function bpPlatform(): BpPlatform {
  return current;
}

export function setBpPlatform(next: BpPlatform): void {
  current = next;
}
