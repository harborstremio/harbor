import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { discoverCastDevices } from "@/lib/cast";
import { getPlaybackPosition, subscribePlaybackClock } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";
import {
  buildRemoteSnapshot,
  dispatchRemoteCommand,
  setRemoteCastDiscovering,
  setRemoteCastDevices,
  subscribeRemoteSession,
} from "./session";
import { installTextEntryListeners } from "./text-entry";
import { REMOTE_PROTO, parseClientMessage, type RemoteServerMessage } from "./protocol";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function broadcast(msg: RemoteServerMessage) {
  if (!isTauri) return;
  void invoke("remote_ws_broadcast", { payload: JSON.stringify(msg) }).catch(() => {});
}

function pushSnapshot() {
  broadcast({ t: "snapshot", snapshot: buildRemoteSnapshot(getPlaybackPosition()) });
}

const SKIP_SNAPSHOT = new Set(["nav", "setText", "ping"]);

/**
 * Host-side remote control plane. Mount only in the Tauri desktop shell.
 * Relays WS commands to the active player/cast binding and pushes snapshots.
 */
export function RemoteHostMount() {
  const { settings } = useSettings();
  const enabled = settings.serveWebUi || settings.remoteControlEnabled;
  const timerRef = useRef<number>(0);

  useEffect(() => {
    if (!isTauri || !enabled) return;

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void listen<{ clientId: number; raw: string }>("remote://cmd", (e) => {
      const raw = e.payload?.raw;
      if (!raw) return;
      const msg = parseClientMessage(raw);
      if (!msg) {
        broadcast({ t: "error", message: "invalid message" });
        return;
      }
      if (msg.t === "hello") {
        broadcast({ t: "hello", proto: REMOTE_PROTO, server: "harbor-remote" });
        pushSnapshot();
        return;
      }
      if (msg.t === "cmd") {
        void (async () => {
          try {
            if (msg.command.action === "castDiscover") {
              setRemoteCastDiscovering(true);
              setRemoteCastDevices([]);
              try {
                const devices = await discoverCastDevices();
                setRemoteCastDevices(devices);
              } finally {
                setRemoteCastDiscovering(false);
              }
              pushSnapshot();
              return;
            }
            if (msg.command.action === "ping") {
              broadcast({ t: "pong", at: Date.now() });
              return;
            }
            await dispatchRemoteCommand(msg.command);
            // nav/setText: focusin/out + 400ms tick cover textEntry; skip churn.
            if (!SKIP_SNAPSHOT.has(msg.command.action)) pushSnapshot();
          } catch (err) {
            const message = err instanceof Error ? err.message : "remote command failed";
            broadcast({ t: "error", message });
            pushSnapshot();
          }
        })();
      }
    }).then((u) => {
      if (cancelled) u();
      else unsubs.push(u);
    });

    void listen<{ action: string }>("remote://client", (e) => {
      if (e.payload?.action === "join") {
        broadcast({ t: "hello", proto: REMOTE_PROTO, server: "harbor-remote" });
        pushSnapshot();
      }
    }).then((u) => {
      if (cancelled) u();
      else unsubs.push(u);
    });

    unsubs.push(subscribeRemoteSession(() => pushSnapshot()));
    unsubs.push(
      subscribePlaybackClock(() => {
        // throttle via shared interval below
      }),
    );

    const onFocusChange = () => pushSnapshot();
    document.addEventListener("focusin", onFocusChange);
    document.addEventListener("focusout", onFocusChange);
    unsubs.push(() => {
      document.removeEventListener("focusin", onFocusChange);
      document.removeEventListener("focusout", onFocusChange);
    });
    unsubs.push(installTextEntryListeners());

    setRemoteCastDiscovering(true);
    void discoverCastDevices()
      .then((devices) => {
        if (!cancelled) {
          setRemoteCastDevices(devices);
        }
      })
      .finally(() => {
        if (!cancelled) setRemoteCastDiscovering(false);
      });

    timerRef.current = window.setInterval(() => {
      pushSnapshot();
    }, 400);

    pushSnapshot();

    return () => {
      cancelled = true;
      window.clearInterval(timerRef.current);
      for (const u of unsubs) u();
    };
  }, [enabled]);

  return null;
}
