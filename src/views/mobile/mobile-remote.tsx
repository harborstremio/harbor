import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, WifiOff } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import type { RemoteCommand, RemoteSnapshot } from "@/lib/remote/protocol";
import { useRemoteClient } from "@/lib/remote/use-remote-client";
import { useSettings } from "@/lib/settings";

type PlayOpts = { season?: number; episode?: number; resume?: boolean };

type MobileRemoteValue = {
  connected: boolean;
  snapshot: RemoteSnapshot;
  playOnHost: (meta: Meta, opts?: PlayOpts) => void;
  openOnHost: (meta: Meta) => void;
  sendCommand: (command: RemoteCommand) => boolean;
};

const Ctx = createContext<MobileRemoteValue | null>(null);

export function MobileRemoteProvider({ children }: { children: ReactNode }) {
  const { status, snapshot, sendCommand } = useRemoteClient();
  const { settings, update } = useSettings();
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const timer = useRef<number>(0);

  useEffect(() => {
    const nextTmdb = snapshot.tmdbKey ?? "";
    const nextRpdb = snapshot.rpdbKey ?? "";
    const nextTvdb = snapshot.tvdbKey ?? "";
    const patch: { tmdbKey?: string; rpdbKey?: string; tvdbKey?: string } = {};
    if (nextTmdb && nextTmdb !== settings.tmdbKey) patch.tmdbKey = nextTmdb;
    if (nextRpdb && nextRpdb !== settings.rpdbKey) patch.rpdbKey = nextRpdb;
    if (nextTvdb && nextTvdb !== settings.tvdbKey) patch.tvdbKey = nextTvdb;
    if (patch.tmdbKey !== undefined || patch.rpdbKey !== undefined || patch.tvdbKey !== undefined)
      update(patch);
  }, [
    snapshot.tmdbKey,
    snapshot.rpdbKey,
    snapshot.tvdbKey,
    settings.tmdbKey,
    settings.rpdbKey,
    settings.tvdbKey,
    update,
  ]);

  const showFlash = useCallback((ok: boolean, text: string) => {
    setFlash({ ok, text });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlash(null), 2200);
  }, []);

  const connected = status === "connected";

  const playOnHost = useCallback(
    (meta: Meta, opts?: PlayOpts) => {
      const sent = sendCommand({
        action: "playMeta",
        metaId: meta.id,
        metaType: meta.type,
        name: meta.name,
        poster: meta.poster,
        season: opts?.season,
        episode: opts?.episode,
        resume: opts?.resume ?? true,
      });
      showFlash(sent, sent ? `Playing on your computer` : "Not connected to a computer");
    },
    [sendCommand, showFlash],
  );

  const openOnHost = useCallback(
    (meta: Meta) => {
      const sent = sendCommand({
        action: "openMeta",
        metaId: meta.id,
        metaType: meta.type,
        name: meta.name,
        poster: meta.poster,
      });
      showFlash(sent, sent ? `Opened on your computer` : "Not connected to a computer");
    },
    [sendCommand, showFlash],
  );

  const value = useMemo<MobileRemoteValue>(
    () => ({ connected, snapshot, playOnHost, openOnHost, sendCommand }),
    [connected, snapshot, playOnHost, openOnHost, sendCommand],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {flash && (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-semibold shadow-[0_8px_28px_-8px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-fade-in ${
              flash.ok ? "bg-ink text-canvas" : "bg-danger/90 text-white"
            }`}
          >
            {flash.ok ? (
              <Check size={16} strokeWidth={2.6} />
            ) : (
              <WifiOff size={16} strokeWidth={2.4} />
            )}
            {flash.text}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useMobileRemote(): MobileRemoteValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMobileRemote must be used within MobileRemoteProvider");
  return v;
}
