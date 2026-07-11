import type { Meta } from "@/lib/cinemeta";
import { buildPlayInvite } from "@/lib/together/build-invite";
import type { RoomSnapshot } from "@/lib/together/client";
import type { PlayInvite, SourceDescriptor } from "@/lib/together/protocol";
import { hostSourceMatchesMedia, type HostSourceInfo } from "@/lib/together/room-derive";
import type { PlayEpisode } from "@/lib/view";
import { useEffect, useRef } from "react";

export function useRoomInvite(params: {
  meta: Meta;
  episode?: PlayEpisode;
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
    inviteSentRef.current = inviteKey;
    claimHost(true);
    sendInvite(buildPlayInvite(meta, episode));
  }, [canInvite, inviteKey, sendInvite, claimHost, meta, episode]);

  const isRoomGuest = inSession && foreignHost;
  const hostSourceForMedia =
    isRoomGuest && hostSourceMatchesMedia(hostSource, meta.id, episode ?? null) ? hostSource!.descriptor : null;
  const expectHostSource =
    isRoomGuest && (hostSourceForMedia != null || (wasInvitedTo(inviteKey) && lastInviteProto >= 2));

  return { inviteKey, canInvite, inviteSentRef, hostSourceForMedia, expectHostSource };
}
