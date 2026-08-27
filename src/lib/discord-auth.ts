import { openUrl } from "@/lib/window";

const TIMEOUT_MS = 300000;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function canDiscordAuth(): boolean {
  return isTauri();
}

type DiscordAuthEvent = {
  state?: unknown;
  code?: unknown;
  error?: unknown;
};

// Unlike startStremioWebAuth, this cannot build its own URL: client_id and
// scope are server config, and `state` has to be the same value the backend
// embedded in `authorizeUrl` and will later verify atomically. So the caller
// (lib/account/discord-link.ts) gets state+authorizeUrl from
// POST /identity/api/discord/loopback/start first, then calls this with both.
//
// Both the native listener and this client validate the state challenge. A
// mismatch is ignored here as defense in depth and cannot resolve or reject
// the active authentication attempt.
export async function startDiscordAuth(
  authorizeUrl: string,
  expectedState: string,
): Promise<string> {
  if (!isTauri()) throw new Error("Linking Discord needs the desktop app.");
  const { invoke } = await import("@tauri-apps/api/core");
  const { listen } = await import("@tauri-apps/api/event");
  try {
    await invoke<number>("discord_auth_start", { expectedState });
  } catch {
    throw new Error("Couldn't start the Discord sign-in listener. Try again in a moment.");
  }

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
      reject(new Error("Timed out waiting for Discord. Try again."));
    }, TIMEOUT_MS);
    void listen<DiscordAuthEvent>("discord-auth", (e) => {
      if (settled) return;
      const payload = e.payload || {};
      if (payload.state !== expectedState) return;
      finish();
      if (typeof payload.error === "string" && payload.error) {
        reject(
          new Error(
            payload.error === "access_denied"
              ? "Discord sign-in was cancelled."
              : "Discord sign-in failed. Try again.",
          ),
        );
        return;
      }
      const code = typeof payload.code === "string" ? payload.code : "";
      if (!code) {
        reject(new Error("No Discord code came through. Try again."));
        return;
      }
      resolve(code);
    })
      .then((fn) => {
        if (settled) {
          fn();
          return;
        }
        unlisten = fn;
        openUrl(authorizeUrl);
      })
      .catch(() => {
        if (settled) return;
        finish();
        reject(new Error("Couldn't listen for Discord sign-in. Try again in a moment."));
      });
  });
}
