import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import { useProfiles } from "@/lib/profiles";
import { useView, type PlayerSrc } from "@/lib/view";
import {
  capturePlaybackActor,
  isPlaybackActorCurrent,
  readLastActualPlayback,
  subscribePlayback,
  type ActualPlayback,
} from "@/lib/playback-history";
import { currentPlayerActions } from "@/lib/player-actions";
import { continueActualPlayback } from "@/lib/player/continue-playback";

let version = 0;
subscribePlayback(() => {
  version += 1;
});
const snapshotVersion = () => version;

async function prepareServer(src: PlayerSrc, positionMs: number): Promise<PlayerSrc> {
  const context = src.homeServer;
  if (!context) throw new Error("This is not home-server playback.");
  const [{ mediaServerConnections }, { mediaServerItems }, { createMediaServerPlayerSrc }] =
    await Promise.all([
      import("@/lib/media-server/connections"),
      import("@/lib/media-server/index-store"),
      import("@/lib/media-server/playback"),
    ]);
  const connection = mediaServerConnections().find((item) => item.id === context.connectionId);
  const item = (await mediaServerItems(context.connectionId)).find(
    (entry) => entry.id === context.itemId,
  );
  if (!connection || !item || !item.versions.some((version) => version.id === context.versionId)) {
    throw new Error("This home-server copy is no longer available.");
  }
  return createMediaServerPlayerSrc({
    meta: src.meta,
    imdbId: src.imdbId,
    episode: src.episode,
    connection,
    item,
    versionId: context.versionId,
    quality: context.quality,
    startPositionMs: positionMs,
  });
}

export function useLastPlaybackContinuation() {
  const view = useView();
  const { activeProfile } = useProfiles();
  const { user } = useAuth();
  const revision = useSyncExternalStore(subscribePlayback, snapshotVersion, snapshotVersion);
  const target = useMemo(() => readLastActualPlayback(), [revision, activeProfile?.id, user?._id]);
  const currentActor = capturePlaybackActor();
  const actorKey = JSON.stringify(currentActor);
  const operation = useRef<{ actorKey: string; token: object | null; mounted: boolean }>({
    actorKey,
    token: null,
    mounted: true,
  });
  // Invalidate synchronously: a previous actor's promise may settle before effects run.
  if (operation.current.actorKey !== actorKey) {
    operation.current.actorKey = actorKey;
    operation.current.token = null;
  }
  const [pendingToken, setPendingToken] = useState<object | null>(null);
  useEffect(() => {
    operation.current.mounted = true;
    return () => {
      operation.current.mounted = false;
      operation.current.token = null;
    };
  }, []);
  const continuePlayback = async (
    selected: ActualPlayback,
    options: { restart?: boolean } = {},
  ) => {
    if (!operation.current.mounted) throw new Error("Open the menu again to continue playback.");
    if (operation.current.token) throw new Error("Playback continuation is already opening.");
    const token = {};
    operation.current.token = token;
    setPendingToken(token);
    const actor = capturePlaybackActor();
    try {
      return await continueActualPlayback(
        selected,
        { ...options, actor },
        {
          isCurrent: (candidate) =>
            operation.current.mounted &&
            operation.current.token === token &&
            isPlaybackActorCurrent(candidate),
          latest: readLastActualPlayback,
          active: () => {
            const actions = currentPlayerActions();
            return actions?.src && actions.returnToPlayer
              ? { src: actions.src, resume: actions.returnToPlayer }
              : null;
          },
          localFileExists: async (path) => {
            if (!("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
              throw new Error("Local playback requires the Harbor desktop application.");
            }
            const { stat } = await import("@tauri-apps/plugin-fs");
            let local = path;
            if (/^file:\/\//i.test(local)) {
              const url = new URL(local);
              local = decodeURIComponent(url.pathname);
              if (/^\/[a-z]:\//i.test(local)) local = local.slice(1);
              if (url.hostname) local = `//${url.hostname}${local}`;
            }
            try {
              return (await stat(local)).isFile;
            } catch (error) {
              const detail = String(error);
              if (/not found|cannot find|no such file|os error 2|os error 3/i.test(detail))
                return false;
              throw new Error("The last video file could not be accessed.");
            }
          },
          openPlayer: view.openPlayer,
          openPicker: view.openPicker,
          prepareServer,
        },
      );
    } finally {
      if (operation.current.token === token) {
        operation.current.token = null;
        if (operation.current.mounted) setPendingToken(null);
      }
    }
  };
  return {
    status: target ? ("ready" as const) : ("empty" as const),
    target,
    pending: pendingToken != null && operation.current.token === pendingToken,
    continuePlayback,
  };
}
