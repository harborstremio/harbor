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
  const liquidGlassEnabled = true;

  const strongTextClass = liquidGlassEnabled
    ? "text-white/[0.96] [text-shadow:0_1px_2px_rgba(0,0,0,0.72)]"
    : "text-ink";

  const mutedTextClass = liquidGlassEnabled
    ? "text-white/[0.80] [text-shadow:0_1px_2px_rgba(0,0,0,0.66)]"
    : "text-ink-muted";

  const subtleTextClass = liquidGlassEnabled
    ? "text-white/[0.64] [text-shadow:0_1px_2px_rgba(0,0,0,0.60)]"
    : "text-ink-subtle";

  const panelClass = liquidGlassEnabled
    ? "border-white/[0.14] bg-black/[0.18] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    : "border-edge bg-canvas/60";

  const inputClass = liquidGlassEnabled
    ? "border-white/[0.16] bg-black/[0.24] text-white placeholder:text-white/35 hover:border-white/[0.24] focus:border-white/[0.36] focus:bg-black/[0.30] focus:ring-1 focus:ring-white/20"
    : "border-edge bg-canvas text-ink focus:border-accent";

  const primaryButtonClass = liquidGlassEnabled
    ? "border border-white/[0.44] bg-white/[0.90] text-black shadow-[0_8px_24px_-12px_rgba(255,255,255,0.60)] hover:bg-white hover:shadow-[0_10px_28px_-12px_rgba(255,255,255,0.72)]"
    : "bg-ink text-canvas";

  const secondaryButtonClass = liquidGlassEnabled
    ? "border border-white/[0.14] bg-white/[0.065] text-white/[0.86] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-white/[0.24] hover:bg-white/[0.14] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    : "border-edge text-ink-muted hover:bg-elevated hover:text-ink";

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

  const popoverContent = (
    <>
      <TvModalClose onClose={closeModal} label={t("Close")} />
      <header className="flex items-center justify-between gap-3">
        <h2 className={`text-[14px] font-semibold tracking-tight ${strongTextClass}`}>
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
              view === "link" ? primaryButtonClass : secondaryButtonClass
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
          <div className={`flex flex-col gap-3 rounded-xl border p-3.5 ${panelClass}`}>
            <div>
              <p className={`text-[13px] ${strongTextClass}`}>
                {t("Watch Together needs a relay.")}
              </p>
              <p className={`mt-1 text-[12px] leading-relaxed ${mutedTextClass}`}>
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
              className={`h-10 rounded-lg border px-3 text-[12px] transition-colors ${inputClass}`}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleJoin}
                disabled={!joinCode.trim()}
                className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-[13px] font-semibold transition-all hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100 ${primaryButtonClass}`}
              >
                {t("Join")}
              </button>
              <button
                onClick={goToSettings}
                className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-[13px] font-medium transition-colors ${secondaryButtonClass}`}
              >
                {t("Open Settings")}
              </button>
            </div>
          </div>
        )}

        {view === "default" && enabled && !inSession && (
          <>
            <label className="flex flex-col gap-1.5">
              <span
                className={`text-[11px] font-medium uppercase tracking-wider ${subtleTextClass}`}
              >
                {t("Your name")}
              </span>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                maxLength={32}
                className={`h-10 rounded-lg border px-3 text-[13.5px] transition-colors ${inputClass}`}
              />
            </label>

            <button
              onClick={handleStart}
              disabled={connecting}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold transition-all hover:scale-[1.01] disabled:opacity-40 disabled:hover:scale-100 ${primaryButtonClass}`}
            >
              <Plus size={15} strokeWidth={2.2} />
              {connecting ? t("Starting…") : t("Start a new room")}
            </button>

            <div
              className={`flex items-center gap-3 text-[10.5px] uppercase tracking-wider ${subtleTextClass}`}
            >
              <span
                className={`h-px flex-1 ${liquidGlassEnabled ? "bg-white/[0.14]" : "bg-edge-soft"}`}
              />
              <span>{t("or join")}</span>
              <span
                className={`h-px flex-1 ${liquidGlassEnabled ? "bg-white/[0.14]" : "bg-edge-soft"}`}
              />
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
                  className={`h-10 flex-1 rounded-lg border px-3 transition-colors ${inputClass} ${
                    joinCode.length > 6 || joinCode.includes("/")
                      ? "text-[12px]"
                      : "text-center text-[15px] font-mono tracking-[0.3em]"
                  }`}
                />
                <button
                  onClick={handleJoin}
                  disabled={joinCode.trim().length === 0 || connecting}
                  className={`h-10 rounded-lg px-4 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:hover:bg-transparent ${secondaryButtonClass}`}
                >
                  {t("Join")}
                </button>
              </div>
              <p className={`px-1 text-[10.5px] ${subtleTextClass}`}>
                {t("or paste an invite link")}
              </p>
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

            <div
              className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 ${panelClass}`}
            >
              <div className="flex flex-col">
                <span className={`text-[10.5px] uppercase tracking-wider ${subtleTextClass}`}>
                  {t("Room code")}
                </span>
                <span className={`font-mono text-[18px] tracking-[0.35em] ${strongTextClass}`}>
                  {snapshot.room}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${secondaryButtonClass}`}
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
              <span className={`text-[10.5px] uppercase tracking-wider ${subtleTextClass}`}>
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
                      className={`flex items-center gap-1.5 rounded-full py-0.5 ps-0.5 pe-2.5 ${
                        liquidGlassEnabled
                          ? "border border-white/[0.10] bg-white/[0.07]"
                          : "bg-elevated/70"
                      }`}
                    >
                      <Avatar name={p.name} src={avatarSrc} color={color} />
                      <span className={`text-[12px] ${strongTextClass}`}>{p.name}</span>
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
              className={`flex h-10 items-center justify-between gap-2 rounded-lg px-3 text-[12.5px] transition-colors ${secondaryButtonClass}`}
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
              className={`flex h-10 items-center justify-center gap-1.5 rounded-lg text-[12.5px] transition-colors ${secondaryButtonClass}`}
            >
              <LogOut size={13} strokeWidth={1.9} />
              {t("Leave room")}
            </button>
          </>
        )}
      </div>
    </>
  );

  return liquidGlassEnabled ? (
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
        background: "rgba(7,11,17,0.18)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(110,185,255,0.07), 0 28px 72px -24px rgba(0,0,0,0.78)",
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
        border border-white/[0.16]
        shadow-[0_28px_72px_-24px_rgba(0,0,0,0.78)]
        animate-popover-in
      "
      contentClassName="
        flex max-h-[80vh] w-full
        flex-col gap-4
        overflow-y-auto p-5
        text-white/[0.94]
        [text-shadow:0_1px_2px_rgba(0,0,0,0.66)]
        [&_.text-ink]:!text-white/[0.96]
        [&_.text-ink-muted]:!text-white/[0.80]
        [&_.text-ink-subtle]:!text-white/[0.64]
        [&_.border-edge]:!border-white/[0.16]
        [&_.border-edge-soft]:!border-white/[0.10]
        [&_input]:!border-white/[0.16]
        [&_input]:!bg-black/[0.24]
        [&_input]:!text-white
        [&_input::placeholder]:!text-white/35
        [&_textarea]:!border-white/[0.16]
        [&_textarea]:!bg-black/[0.24]
        [&_textarea]:!text-white
        [&_textarea::placeholder]:!text-white/35
        [&_button]:focus-visible:outline-none
        [&_button]:focus-visible:ring-1
        [&_button]:focus-visible:ring-white/30
        [scrollbar-width:none]
        [&::-webkit-scrollbar]:hidden
      "
    >
      {popoverContent}
    </ThreeLiquidGlassSurface>
  ) : (
    <div
      role="dialog"
      aria-modal="true"
      data-tv-focus-scope
      aria-label={t("Watch together")}
      className={`harbor-together-surface flex max-h-[80vh] w-[400px] max-w-[calc(100vw-24px)] flex-col gap-4 overflow-y-auto border border-edge bg-canvas/95 p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl animate-popover-in [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        connectStyle === "tab"
          ? placement === "above-left"
            ? "rounded-t-2xl rounded-b-none"
            : "rounded-b-2xl rounded-t-none"
          : placement === "above-left"
            ? "rounded-2xl rounded-es-none"
            : "rounded-2xl rounded-se-none"
      }`}
    >
      {popoverContent}
    </div>
  );
}
