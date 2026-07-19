import { memo, useMemo } from "react";
import { AvatarDock } from "@/components/player/avatar-dock";
import { ChatOverlay } from "@/components/player/chat-overlay";
import type { PanelCorner } from "@/lib/player-chrome";
import type { RoomSnapshot } from "@/lib/together/client";
import type { ChatMessage } from "@/lib/together/provider";
import type { ParticipantLocation, SourceDescriptor, SyncState } from "@/lib/together/protocol";
import { DurationMismatchChip } from "./duration-mismatch-chip";
import { ForeignNoticeBox } from "./foreign-notice-box";
import { WaitingForRoom } from "./waiting-for-room";

export const RoomLayer = memo(function RoomLayer({
  inRoom,
  pipMode,
  drawMode,
  participants,
  clientId,
  hostClientId,
  syncState,
  avatarsVisible,
  presenceMap,
  participantLocations,
  now,
  avatarsCorner,
  avatarsHidden,
  chat,
  sendChat,
  chromeVisible,
  chatCorner,
  chatHidden,
  showWaiting,
  isHost,
  staleIds,
  guestEscapeReady,
  onStart,
  onPlayWithoutSync,
  onLeave,
  guestHostSource,
  guestDurationSec,
  casting,
  currentUrl,
  switcherOpen,
  onFindCloser,
  foreignNotice,
  onDismissForeign,
}: {
  inRoom: boolean;
  pipMode: boolean;
  drawMode: boolean;
  participants: RoomSnapshot["participants"];
  clientId: string;
  hostClientId: string | null;
  syncState: SyncState | null;
  avatarsVisible: boolean;
  presenceMap: Map<string, number>;
  participantLocations: Map<string, ParticipantLocation>;
  now: number;
  avatarsCorner: PanelCorner;
  avatarsHidden: boolean;
  chat: ChatMessage[];
  sendChat: (text: string) => void;
  chromeVisible: boolean;
  chatCorner: PanelCorner;
  chatHidden: boolean;
  showWaiting: boolean;
  isHost: boolean;
  staleIds: Set<string>;
  guestEscapeReady: boolean;
  onStart: () => void;
  onPlayWithoutSync: () => void;
  onLeave: () => void;
  guestHostSource: SourceDescriptor | null;
  guestDurationSec: number;
  casting: boolean;
  currentUrl: string;
  switcherOpen: boolean;
  onFindCloser: () => void;
  foreignNotice: { title: string | null; from: string } | null;
  onDismissForeign: () => void;
}) {
  const everyoneReady = useMemo(
    () => participants.length > 0 && participants.every((p) => p.ready),
    [participants],
  );
  const notReady = useMemo(() => participants.filter((p) => !p.ready), [participants]);
  return (
    <>
      {inRoom && !pipMode && (
        <AvatarDock
          participants={participants}
          selfId={clientId}
          hostId={hostClientId}
          syncState={syncState}
          visible={avatarsVisible}
          presenceMap={presenceMap}
          participantLocations={participantLocations}
          now={now}
          corner={avatarsCorner}
          hidden={avatarsHidden}
        />
      )}

      {inRoom && !pipMode && (
        <ChatOverlay
          messages={chat}
          onSend={sendChat}
          selfId={clientId}
          participants={participants}
          forceVisible={chromeVisible}
          corner={chatCorner}
          hidden={chatHidden}
        />
      )}

      {showWaiting && (
        <WaitingForRoom
          isHost={isHost}
          notReady={notReady}
          participants={participants}
          clientId={clientId}
          everyoneReady={everyoneReady}
          staleIds={staleIds}
          guestEscapeReady={guestEscapeReady}
          onStart={onStart}
          onPlayWithoutSync={onPlayWithoutSync}
          onLeave={onLeave}
        />
      )}

      {!pipMode && !drawMode && (
        <DurationMismatchChip
          hostSource={guestHostSource}
          guestDurationSec={guestDurationSec}
          casting={casting}
          currentUrl={currentUrl}
          switcherOpen={switcherOpen}
          onFindCloser={onFindCloser}
        />
      )}

      {foreignNotice && (
        <ForeignNoticeBox title={foreignNotice.title} onDismiss={onDismissForeign} />
      )}
    </>
  );
});
