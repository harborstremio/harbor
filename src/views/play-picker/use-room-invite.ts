import { useEffect, useRef } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { RoomSnapshot } from "@/lib/together/client";
import type { PlayInvite, SourceDescriptor } from "@/lib/together/protocol";
import { buildPlayInvite } from "@/lib/together/build-invite";
import { hostSourceMatchesMedia, type HostSourceInfo } from "@/lib/together/room-derive";
import type { PlayEpisode } from "@/lib/view";

export function useRoomInvite(params: {
  meta: Meta;
  episode?: PlayEpisode;
  settleEpisode: () => Promise<PlayEpisode | undefined>;
  inSession: boolean;
  roomSnapshot: RoomSnapshot;
  clientId: string;
  hostSource: HostSourceInfo | null;
  lastInviteProto: number;
  wasInvitedTo: (key: string) => boolean;
  claimHost: (fresh: boolean) => void;
  sendInvite: (invite: PlayInvite) => void;
}): {
  inviteKey: string;
  canInvite: boolean;
  inviteSentRef: React.MutableRefObject<string | null>;
  hostSourceForMedia: SourceDescriptor | null;
  expectHostSource: boolean;
} {
  const {
    meta,
    episode,
    settleEpisode,
    inSession,
    roomSnapshot,
    clientId,
    hostSource,
    lastInviteProto,
    wasInvitedTo,
    claimHost,
    sendInvite,
  } = params;

  const inviteKey = `${meta.id}|${episode?.season ?? ""}|${episode?.episode ?? ""}`;
  const foreignHost = !!roomSnapshot.hostClientId && roomSnapshot.hostClientId !== clientId;
  const canInvite = inSession && !wasInvitedTo(inviteKey) && !foreignHost;
  const inviteSentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!canInvite) return;
    if (inviteSentRef.current === inviteKey) return;
    let cancelled = false;
    void settleEpisode().then((settledEpisode) => {
      if (cancelled || inviteSentRef.current === inviteKey) return;
      inviteSentRef.current = inviteKey;
      claimHost(true);
      sendInvite(buildPlayInvite(meta, settledEpisode));
    });
    return () => {
      cancelled = true;
    };
  }, [canInvite, inviteKey, sendInvite, claimHost, meta, episode, settleEpisode]);

  const isRoomGuest = inSession && foreignHost;
  const hostSourceForMedia =
    isRoomGuest && hostSourceMatchesMedia(hostSource, meta.id, episode ?? null)
      ? hostSource!.descriptor
      : null;
  const expectHostSource =
    isRoomGuest && (hostSourceForMedia != null || (wasInvitedTo(inviteKey) && lastInviteProto >= 2));

  return { inviteKey, canInvite, inviteSentRef, hostSourceForMedia, expectHostSource };
}
