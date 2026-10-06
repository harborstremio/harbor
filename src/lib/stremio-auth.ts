import { openUrl } from "@/lib/window";

const LOGIN_URL = "https://www.stremio.com/login";
const TIMEOUT_MS = 300000;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function canStremioWebAuth(): boolean {
  return isTauri();
}

export async function startStremioWebAuth(): Promise<string> {
  if (!isTauri()) throw new Error("Signing in through Stremio needs the desktop app.");
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  const port = await invoke<number>("stremio_auth_start");
  const callback = `http://127.0.0.1:${port}/cb`;
  const url = `${LOGIN_URL}?appName=${encodeURIComponent("JL Media Vision")}&appCallback=${encodeURIComponent(callback)}`;

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let unlisten: (() => void) | null = null;
    let timer = 0;
    const finish = () => {
      settled = true;
      if (timer) window.clearTimeout(timer);
      if (unlisten) unlisten();
    };
    timer = window.setTimeout(() => {
      if (settled) return;
      finish();
      reject(new Error("Timed out waiting for the browser. Try again."));
    }, TIMEOUT_MS);
    void listen<string>("stremio-auth", (e) => {
      if (settled) return;
      const key = typeof e.payload === "string" ? e.payload : "";
      if (!key) return;
      finish();
      resolve(key);
    }).then((fn) => {
      if (settled) fn();
      else unlisten = fn;
    });
    openUrl(url);
  });
}
