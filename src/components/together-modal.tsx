import { Check, Copy, LogOut, MousePointer2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TvModalClose } from "@/components/tv-modal-close";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { useTogether } from "@/lib/together/provider";
import { useSelfIdentity } from "@/lib/together/use-self-identity";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { Tooltip } from "@/views/detail/tooltip";
import { Avatar } from "./together-modal/avatar";
import { ChatPanel } from "./together-modal/chat-panel";
import { GuestPickToggle } from "./together-modal/guest-pick-toggle";
import { InvitePanel } from "./together-modal/invite-panel";
import { LinkGlyph } from "./together-modal/link-glyph";
import { ReturnToVideo } from "./together-modal/return-to-video";
import { TogetherRelayBanner } from "./together-relay-banner";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";

export function TogetherPopover({
  placement = "below-right",
  connectStyle = "popover",
}: {
  placement?: "below-right" | "above-left";
  connectStyle?: "tab" | "popover";
} = {}) {
  const {
    enabled,
    snapshot,
    chat,
    displayName,
    setDisplayName,
    startSession,
    joinSession,
    leaveSession,
    retrySession,
    sendChat,
    closeModal,
    clientId,
  } = useTogether();
  const { openSettings, openPicker, topKind } = useView();
  const { settings, update } = useSettings();
  const { avatar: selfAvatar, color: selfColor } = useSelfIdentity();
  const t = useT();
  const [joinCode, setJoinCode] = useState("");
  const [draftName, setDraftName] = useState(displayName);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"default" | "link">("default");

  useEffect(() => {
    setDraftName(displayName);
  }, [displayName]);

  const inSession = snapshot.state === "joined" && !!snapshot.room;
  const connecting = snapshot.state === "connecting";
  const errored = snapshot.state === "error";

  const handleStart = () => {
    const code = startSession();
    setJoinCode(code);
  };

  const handleJoin = () => {
    const value = joinCode.trim();
    if (!value) return;
    if (/^https?:\/\//i.test(value) || value.includes("harbor-relay=")) {
      try {
        const url = new URL(
          value.startsWith("http")
            ? value
            : `https://x${value.startsWith("?") ? value : `?${value}`}`,
        );
        const relay = url.searchParams.get("harbor-relay");
        const room = url.searchParams.get("harbor-room");
        if (relay && room) {
          if (settings.togetherRelayUrl !== relay) {
            update({ togetherRelayUrl: relay });
          }
          setJoinCode(room.toUpperCase());
          setTimeout(() => joinSession(room), 200);
          return;
        }
      } catch {}
    }
    joinSession(value);
  };

  const handleCopy = async () => {
    if (!snapshot.room) return;
    try {
      await navigator.clipboard.writeText(snapshot.room);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };

  const commitName = () => {
    if (draftName.trim() && draftName.trim() !== displayName) setDisplayName(draftName);
  };

  const goToSettings = () => {
    closeModal();
    openSettings("relay");
  };

  const participants = useMemo(
    () => snapshot.participants.slice().sort((a, b) => a.joinedAt - b.joinedAt),
    [snapshot.participants],
  );

  const roomMedia = snapshot.syncState;
  const canReturn = inSession && !!roomMedia?.mediaId && topKind !== "player";

  const returnToVideo = () => {
    if (!roomMedia?.mediaId) return;
    const meta: Meta = {
      id: roomMedia.mediaId,
      type: roomMedia.episode ? "series" : "movie",
      name: roomMedia.mediaTitle ?? "Now playing",
      poster: roomMedia.posterUrl ?? undefined,
    };
    openPicker(meta, roomMedia.episode ?? undefined, { autoPlay: true });
    closeModal();
  };

  return (
    <ThreeLiquidGlassSurface
      role="dialog"
      aria-modal="true"
      data-tv-focus-scope
      aria-label={t("Watch together")}
      radius="16px"
      shaderRadius={0.3}
      intensity={0.74}
      interactive={false}
      alwaysActive
      style={{
        background: "transparent",
        boxShadow: "none",
        ...(connectStyle === "tab"
          ? placement === "above-left"
            ? {
                borderStartStartRadius: "16px",
                borderStartEndRadius: "16px",
                borderEndStartRadius: 0,
                borderEndEndRadius: 0,
              }
            : {
                borderStartStartRadius: 0,
                borderStartEndRadius: 0,
                borderEndStartRadius: "16px",
                borderEndEndRadius: "16px",
              }
          : placement === "above-left"
            ? {
                borderStartStartRadius: "16px",
                borderStartEndRadius: "16px",
                borderEndStartRadius: 0,
                borderEndEndRadius: "16px",
              }
            : {
                borderStartStartRadius: "16px",
                borderStartEndRadius: 0,
                borderEndStartRadius: "16px",
                borderEndEndRadius: "16px",
              }),
      }}
      className="
        harbor-together-surface
        w-[400px] max-w-[calc(100vw-24px)]
        border border-edge
      "
      contentClassName="
        flex max-h-[80vh] w-full
        flex-col gap-4
        overflow-y-auto p-5
        [scrollbar-width:none]
        [&::-webkit-scrollbar]:hidden
        animate-popover-in
      "
    >
      <TvModalClose onClose={closeModal} label={t("Close")} />
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold tracking-tight text-ink">
          {view === "link" ? t("Invite via link") : t("Watch together")}
        </h2>
        <Tooltip label={view === "link" ? t("Back") : t("Invite via link")} side="bottom">
          <button
            type="button"
            onClick={() => setView((v) => (v === "link" ? "default" : "link"))}
            aria-label={
              view === "link" ? t("Close invite link panel") : t("Open invite link panel")
            }
            aria-pressed={view === "link"}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[10.5px] font-bold uppercase tracking-[0.16em] transition-colors ${
              view === "link"
                ? "bg-ink text-canvas"
                : "bg-elevated text-ink-muted hover:bg-raised hover:text-ink"
            }`}
          >
            <LinkGlyph />
            {t("Invite")}
          </button>
        </Tooltip>
      </header>

      <TogetherRelayBanner />

      <div key={view} className="flex flex-col gap-4 animate-in fade-in duration-200 ease-out">
        {view === "link" && (
          <InvitePanel
            relayUrl={settings.togetherRelayUrl}
            room={snapshot.room}
            onClose={() => setView("default")}
          />
        )}
        {view === "default" && !enabled && (
          <div className="flex flex-col gap-3 rounded-xl border border-edge bg-canvas/60 p-3.5">
            <div>
              <p className="text-[13px] text-ink">{t("Watch Together needs a relay.")}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                {t(
                  "A relay is a tiny Cloudflare Worker that passes play/pause/seek messages between you and your friends. No video data ever touches it. Deploy your own in one click (free tier is plenty), or paste a friend's invite link to use theirs.",
                )}
              </p>
            </div>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder={t("Paste invite link")}
              className="h-10 rounded-lg border border-edge bg-canvas px-3 text-[12px] text-ink transition-colors focus:border-accent"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleJoin}
                disabled={!joinCode.trim()}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-ink px-3 text-[13px] font-medium text-canvas transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
              >
                {t("Join")}
              </button>
              <button
                onClick={goToSettings}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-edge px-3 text-[13px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
              >
                {t("Open Settings")}
              </button>
            </div>
          </div>
        )}

        {view === "default" && enabled && !inSession && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                {t("Your name")}
              </span>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                maxLength={32}
                className="h-10 rounded-lg border border-edge bg-canvas px-3 text-[13.5px] text-ink transition-colors focus:border-accent"
              />
            </label>

            <button
              onClick={handleStart}
              disabled={connecting}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-ink text-[13.5px] font-medium text-canvas transition-transform hover:scale-[1.01] disabled:opacity-40 disabled:hover:scale-100"
            >
              <Plus size={15} strokeWidth={2.2} />
              {connecting ? t("Starting…") : t("Start a new room")}
            </button>

            <div className="flex items-center gap-3 text-[10.5px] uppercase tracking-wider text-ink-subtle">
              <span className="h-px flex-1 bg-edge-soft" />
              <span>{t("or join")}</span>
              <span className="h-px flex-1 bg-edge-soft" />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => {
                    const v = e.target.value;
                    setJoinCode(v.includes("/") || v.length > 6 ? v : v.toUpperCase());
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="ABCD23"
                  className={`h-10 flex-1 rounded-lg border border-edge bg-canvas px-3 text-ink transition-colors focus:border-accent ${
                    joinCode.length > 6 || joinCode.includes("/")
                      ? "text-[12px]"
                      : "text-center text-[15px] font-mono tracking-[0.3em]"
                  }`}
                />
                <button
                  onClick={handleJoin}
                  disabled={joinCode.trim().length === 0 || connecting}
                  className="h-10 rounded-lg border border-edge px-4 text-[13px] font-medium text-ink transition-colors hover:bg-elevated disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  {t("Join")}
                </button>
              </div>
              <p className="px-1 text-[10.5px] text-ink-subtle">{t("or paste an invite link")}</p>
            </div>

            {errored && snapshot.lastError && (
              <div className="flex flex-col gap-2 rounded-lg bg-danger/15 px-3 py-2.5">
                <p className="text-[12px] leading-snug text-danger">{snapshot.lastError}</p>
                <button
                  onClick={retrySession}
                  className="self-start rounded-md border border-danger/40 px-2.5 py-1 text-[11.5px] font-medium text-danger transition-colors hover:bg-danger/20"
                >
                  {t("Try again")}
                </button>
              </div>
            )}
          </>
        )}

        {view === "default" && enabled && inSession && (
          <>
            {canReturn && roomMedia && <ReturnToVideo media={roomMedia} onReturn={returnToVideo} />}

            <div className="flex items-center justify-between rounded-xl border border-edge bg-canvas/60 px-3.5 py-2.5">
              <div className="flex flex-col">
                <span className="text-[10.5px] uppercase tracking-wider text-ink-subtle">
                  {t("Room code")}
                </span>
                <span className="font-mono text-[18px] tracking-[0.35em] text-ink">
                  {snapshot.room}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                aria-label={t("Copy room code")}
              >
                {copied ? (
                  <Check size={15} strokeWidth={2.4} />
                ) : (
                  <Copy size={14} strokeWidth={1.9} />
                )}
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10.5px] uppercase tracking-wider text-ink-subtle">
                {t("{n} watching", { n: participants.length })}
              </span>
              <ul className="flex flex-wrap gap-1.5">
                {participants.map((p) => {
                  const self = p.id === clientId;
                  const avatarSrc = self ? selfAvatar : (p.avatar ?? null);
                  const color = self ? selfColor : (p.color ?? null);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-1.5 rounded-full bg-elevated/70 py-0.5 ps-0.5 pe-2.5"
                    >
                      <Avatar name={p.name} src={avatarSrc} color={color} />
                      <span className="text-[12px] text-ink">{p.name}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <ChatPanel
              chat={chat}
              participants={snapshot.participants}
              clientId={clientId}
              selfAvatar={selfAvatar}
              selfColor={selfColor}
              onSend={sendChat}
            />

            {snapshot.hostClientId === clientId && <GuestPickToggle />}

            <button
              onClick={() => update({ togetherShareCursors: !settings.togetherShareCursors })}
              className="flex h-10 items-center justify-between gap-2 rounded-lg border border-edge px-3 text-[12.5px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
              aria-pressed={settings.togetherShareCursors}
            >
              <span className="flex items-center gap-2">
                <MousePointer2 size={13} strokeWidth={1.9} />
                {t("Show cursors")}
              </span>
              <span
                aria-hidden
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                  settings.togetherShareCursors ? "bg-accent" : "bg-edge"
                }`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    settings.togetherShareCursors
                      ? "translate-x-4 rtl:-translate-x-4"
                      : "translate-x-0"
                  }`}
                />
              </span>
            </button>

            <button
              onClick={leaveSession}
              className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-edge text-[12.5px] text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              <LogOut size={13} strokeWidth={1.9} />
              {t("Leave room")}
            </button>
          </>
        )}
      </div>
    </ThreeLiquidGlassSurface>
  );
}
