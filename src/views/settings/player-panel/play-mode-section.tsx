import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { STALL_WAIT_OPTIONS, stallWaitSec } from "@/lib/player/stall-wait";

export function PlayModePanel() {
  const { settings, update } = useSettings();
  const t = useT();

  const mode = settings.seasonSourceLock ? "season" : settings.instantPlay ? "instant" : "manual";
  const selectMode = (id: "instant" | "manual" | "season") => {
    if (id === "season") update({ seasonSourceLock: true });
    else update({ instantPlay: id === "instant", seasonSourceLock: false });
  };

  const choices: Array<{
    id: "instant" | "manual" | "season";
    label: string;
    sub: string;
    recommended?: boolean;
  }> = [
    {
      id: "instant",
      label: t("Instant"),
      sub: t("Hitting Play jumps straight into playback with the best stream Harbor finds."),
      recommended: true,
    },
    {
      id: "manual",
      label: t("Manual picker"),
      sub: t("Hitting Play opens the source list so you can choose quality, debrid, and audio yourself."),
    },
    {
      id: "season",
      label: t("Lock to season server"),
      sub: t("Pick a source once and Harbor keeps playing the rest of that season from the same release, no re-picking. Works best with a debrid season pack. For anime it locks the whole series to that release."),
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {choices.map((c) => {
        const selected = mode === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => selectMode(c.id)}
            className={`flex items-start gap-3.5 rounded-2xl border px-5 py-4 text-start transition-colors ${
              selected
                ? "border-ink bg-elevated"
                : "border-edge-soft bg-canvas/40 hover:border-edge hover:bg-canvas/60"
            }`}
          >
            <span
              className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                selected ? "border-ink" : "border-edge"
              }`}
            >
              {selected && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-ink">{c.label}</span>
                {c.recommended && (
                  <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-accent">
                    {t("Recommended")}
                  </span>
                )}
              </div>
              <span className="text-[12.5px] leading-snug text-ink-muted">{c.sub}</span>
            </div>
          </button>
        );
      })}
      <button
        type="button"
        id="set-remember-last-stream"
        onClick={() => update({ rememberLastStream: !settings.rememberLastStream })}
        className="mt-1 scroll-mt-28 flex items-start gap-3.5 rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4 text-start transition-colors hover:border-edge hover:bg-canvas/60"
      >
        <span
          className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            settings.rememberLastStream ? "justify-end bg-accent" : "justify-start bg-edge"
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15px] font-semibold text-ink">{t("Remember last stream")}</span>
          <span className="text-[12.5px] leading-snug text-ink-muted">
            {t("When you resume something you were watching, replay the exact stream you last used (same addon and source) instead of opening the picker again. Turn off to always choose fresh.")}
          </span>
        </div>
      </button>
      <button
        type="button"
        id="set-auto-skip-stalled-streams"
        onClick={() => update({ autoNextStreamOnStall: !settings.autoNextStreamOnStall })}
        className="scroll-mt-28 flex items-start gap-3.5 rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4 text-start transition-colors hover:border-edge hover:bg-canvas/60"
      >
        <span
          className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            settings.autoNextStreamOnStall ? "justify-end bg-accent" : "justify-start bg-edge"
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15px] font-semibold text-ink">{t("Auto-skip stalled streams")}</span>
          <span className="text-[12.5px] leading-snug text-ink-muted">
            {t("If a stream hasn't started playing in time (a dead source or an addon that's down), automatically try the next available stream. Off by default.")}
          </span>
        </div>
      </button>
      {settings.autoNextStreamOnStall && (
        <div className="ms-1 flex flex-col gap-2.5 rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4">
          <span className="text-[13px] font-semibold text-ink">{t("How long to wait first")}</span>
          <span className="text-[12.5px] leading-snug text-ink-muted">
            {t("Slow addons and P2P sources often need more than 10 seconds to start. Raise this if streams are being skipped before they get a fair chance.")}
          </span>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {STALL_WAIT_OPTIONS.map((sec) => {
              const on = stallWaitSec(settings.autoNextStreamOnStallSec) === sec;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => update({ autoNextStreamOnStallSec: sec })}
                  className={`flex h-9 items-center rounded-full px-4 text-[12.5px] font-semibold transition-colors ${
                    on
                      ? "bg-ink text-canvas"
                      : "bg-elevated text-ink-muted ring-1 ring-edge-soft hover:text-ink"
                  }`}
                >
                  {sec >= 60 ? t("1 min") : t("{n} sec", { n: sec })}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => update({ resumePrompt: !settings.resumePrompt })}
        className="flex items-start gap-3.5 rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4 text-start transition-colors hover:border-edge hover:bg-canvas/60"
      >
        <span
          className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            settings.resumePrompt ? "justify-end bg-accent" : "justify-start bg-edge"
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15px] font-semibold text-ink">{t("Ask to resume or start over")}</span>
          <span className="text-[12.5px] leading-snug text-ink-muted">
            {t("When you hit Play on something you've partly watched, show a prompt to resume from where you left off or start over. Also covers items synced from Stremio or Trakt.")}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={() => update({ resumePlayback: !settings.resumePlayback })}
        className="flex items-start gap-3.5 rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4 text-start transition-colors hover:border-edge hover:bg-canvas/60"
      >
        <span
          className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            settings.resumePlayback ? "justify-end bg-accent" : "justify-start bg-edge"
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15px] font-semibold text-ink">{t("Resume where you left off")}</span>
          <span className="text-[12.5px] leading-snug text-ink-muted">
            {t("Pick up partly-watched episodes and movies at your saved spot. Anything watched past 80% always restarts. Turn this off to always start from the beginning, handy if you rewatch shows.")}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={() => update({ keepSourceNextEpisode: !settings.keepSourceNextEpisode })}
        className="mt-1 flex items-start gap-3.5 rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4 text-start transition-colors hover:border-edge hover:bg-canvas/60"
      >
        <span
          className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            settings.keepSourceNextEpisode ? "justify-end bg-accent" : "justify-start bg-edge"
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15px] font-semibold text-ink">{t("Keep same source on next episode")}</span>
          <span className="text-[12.5px] leading-snug text-ink-muted">
            {t("When auto-playing the next episode, keep the same release/source you were just watching instead of Harbor's top-ranked stream. Falls back to the best stream if that source isn't available.")}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={() => update({ torrentFullDownload: !settings.torrentFullDownload })}
        className="mt-1 flex items-start gap-3.5 rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4 text-start transition-colors hover:border-edge hover:bg-canvas/60"
      >
        <span
          className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            settings.torrentFullDownload ? "justify-end bg-accent" : "justify-start bg-edge"
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15px] font-semibold text-ink">
            {t("Download the whole file while streaming")}
          </span>
          <span className="text-[12.5px] leading-snug text-ink-muted">
            {t("Buffers the whole file in the background as you watch, even while paused, so big remuxes pre-load and you can scrub a cached file with no re-buffering. Works for debrid and torrent streams. Uses more disk and bandwidth; cleared when you switch or close.")}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={() => update({ keepFullscreenOnExit: !settings.keepFullscreenOnExit })}
        className="mt-1 flex items-start gap-3.5 rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4 text-start transition-colors hover:border-edge hover:bg-canvas/60"
      >
        <span
          className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            settings.keepFullscreenOnExit ? "justify-end bg-accent" : "justify-start bg-edge"
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15px] font-semibold text-ink">{t("Stay in fullscreen after closing the player")}</span>
          <span className="text-[12.5px] leading-snug text-ink-muted">
            {t("When you exit playback, keep the window fullscreen instead of dropping back to a window. Turn off to leave fullscreen automatically whenever the player closes.")}
          </span>
        </div>
      </button>
      <div
        id="set-fullscreen-mode"
        className="mt-1 flex scroll-mt-28 flex-col gap-2.5 rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4"
      >
        <span className="text-[15px] font-semibold text-ink">{t("What fullscreen does")}</span>
        <span className="text-[12.5px] leading-snug text-ink-muted">
          {t("True fullscreen covers the whole screen and hides the taskbar. Maximize fills the screen but keeps the taskbar and title bar, so you can still switch apps.")}
        </span>
        <div className="flex flex-wrap gap-2 pt-0.5">
          {([
            { id: "fullscreen", label: t("True fullscreen") },
            { id: "maximized", label: t("Maximize") },
          ] as const).map((m) => {
            const on = (settings.fullscreenMode ?? "fullscreen") === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => update({ fullscreenMode: m.id })}
                className={`flex h-10 items-center rounded-full px-5 text-[13px] font-semibold transition-colors ${
                  on ? "bg-ink text-canvas" : "bg-elevated text-ink-muted ring-1 ring-edge-soft hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => update({ fullscreenRestorePosition: !settings.fullscreenRestorePosition })}
        className="mt-1 flex items-start gap-3.5 rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4 text-start transition-colors hover:border-edge hover:bg-canvas/60"
      >
        <span
          className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            settings.fullscreenRestorePosition ? "justify-end bg-accent" : "justify-start bg-edge"
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15px] font-semibold text-ink">{t("Restore window position after fullscreen")}</span>
          <span className="text-[12.5px] leading-snug text-ink-muted">
            {t("When you exit fullscreen, return the window to exactly where it was. Turn off to center it on screen instead.")}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={() => update({ playerVolumeHud: !settings.playerVolumeHud })}
        className="mt-1 flex items-start gap-3.5 rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4 text-start transition-colors hover:border-edge hover:bg-canvas/60"
      >
        <span
          className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            settings.playerVolumeHud ? "justify-end bg-accent" : "justify-start bg-edge"
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15px] font-semibold text-ink">{t("Volume pop-up while watching")}</span>
          <span className="text-[12.5px] leading-snug text-ink-muted">
            {t("Show a quick volume overlay when you change volume with the player controls hidden, so keyboard and scroll wheel changes are always visible.")}
          </span>
        </div>
      </button>
      {settings.playerVolumeHud && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-edge-soft bg-canvas/40 px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[15px] font-semibold text-ink">{t("Pop-up position")}</span>
            <span className="text-[12.5px] leading-snug text-ink-muted">
              {t("Where the volume overlay appears on the video.")}
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {(
              [
                { id: "center", label: t("Center") },
                { id: "top", label: t("Top") },
                { id: "top-left", label: t("Top left") },
                { id: "top-right", label: t("Top right") },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => update({ playerVolumeHudPosition: p.id })}
                aria-pressed={settings.playerVolumeHudPosition === p.id}
                className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  settings.playerVolumeHudPosition === p.id
                    ? "bg-ink text-canvas"
                    : "bg-elevated/50 text-ink-muted ring-1 ring-edge-soft/60 hover:bg-elevated hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}