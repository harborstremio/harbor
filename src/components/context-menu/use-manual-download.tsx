import { useEffect, useRef, useState } from "react";
import { readActiveStremioAuthKey, useAuth } from "@/lib/auth";
import type { Meta } from "@/lib/cinemeta";
import { downloadRequestVisibility } from "@/lib/download/contextual-preparation";
import { captureMembershipProfile, isMembershipProfileCurrent } from "@/lib/membership-operations";
import { useView, type PlayEpisode } from "@/lib/view";
import { ManualDownloadPicker } from "./manual-download-picker";

type Request = {
  meta: Meta;
  episode?: PlayEpisode;
  actorKey: string;
  path: string;
  token: string;
  origin: HTMLElement | null;
  profile: ReturnType<typeof captureMembershipProfile>;
  authKey: string | null;
};

/** Retains preparation across its own source picker; neither opening surface starts a transfer. */
export function useManualDownload({ actorKey }: { actorKey: string }) {
  const { openPicker, topPath, picker } = useView();
  const { authKey } = useAuth();
  const [request, setRequest] = useState<Request | null>(null);
  const sequence = useRef(0);
  const current = useRef({ request, actorKey, topPath, pickerToken: picker?.contextRequestId });
  current.current = { request, actorKey, topPath, pickerToken: picker?.contextRequestId };
  const visibility =
    request && request.authKey === authKey
      ? downloadRequestVisibility(request, {
          actorKey,
          path: topPath,
          pickerToken: picker?.contextRequestId,
        })
      : "invalid";

  useEffect(() => {
    if (request && visibility === "invalid") setRequest(null);
  }, [request, visibility]);

  const beginManualDownload = (
    meta: Meta,
    episode?: PlayEpisode,
    origin: HTMLElement | null = null,
  ) => {
    if (meta.type !== "movie" && meta.type !== "series") return;
    const next: Request = {
      meta: { ...meta, id: episode?.sourceMetaId || meta.id },
      episode: episode ? { ...episode } : undefined,
      actorKey,
      path: topPath,
      token: `context-download:${++sequence.current}`,
      origin,
      profile: captureMembershipProfile(),
      authKey: readActiveStremioAuthKey(),
    };
    current.current.request = next;
    setRequest(next);
  };
  const active = request && visibility !== "invalid" ? request : null;
  const isCurrent = () =>
    !!active &&
    current.current.request === active &&
    current.current.actorKey === active.actorKey &&
    isMembershipProfileCurrent(active.profile) &&
    downloadRequestVisibility(active, {
      actorKey: current.current.actorKey,
      path: current.current.topPath,
      pickerToken: current.current.pickerToken,
    }) !== "invalid" &&
    readActiveStremioAuthKey() === active.authKey;
  const dismiss = () => {
    if (!active || current.current.request !== active) return;
    current.current.request = null;
    setRequest(null);
    if (current.current.topPath === active.path && active.origin?.isConnected)
      active.origin.focus({ preventScroll: true });
  };
  const pick = (meta: Meta, episode?: PlayEpisode, seasonEpisodes?: PlayEpisode[]) => {
    if (!active || !isCurrent()) return;
    openPicker(meta, episode, {
      intent: "download",
      returnTo: "previous",
      contextRequestId: active.token,
      ...(seasonEpisodes ? { seasonEpisodes } : {}),
    });
  };

  return {
    beginManualDownload,
    manualDownloadDialog: active ? (
      <ManualDownloadPicker
        key={active.token}
        meta={active.meta}
        episode={active.episode}
        visible={visibility === "panel"}
        isCurrent={isCurrent}
        onPick={pick}
        onClose={dismiss}
      />
    ) : null,
  };
}
