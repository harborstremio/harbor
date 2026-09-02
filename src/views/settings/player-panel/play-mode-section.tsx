import { Maximize2, Move, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { STALL_WAIT_OPTIONS, stallWaitSec } from "@/lib/player/stall-wait";
import { SettingGroup, SettingRow } from "../kit";
import { Segmented, ToggleRow } from "../shared";
import { Dropdown } from "@/components/dropdown";
import { mediaServerConnections } from "@/lib/media-server/connections";
import { Anchored, Nested } from "./choice";
import {
  RememberStreamArt,
  ResumeArt,
  ResumePromptArt,
  SeasonLockArt,
  StallSkipArt,
} from "./setting-art";

const MODE_ART: Record<"instant" | "manual", ReactNode> = {
  instant: (
    <span className="flex items-center gap-2">
      <span className="h-[3px] w-5 rounded-full bg-current opacity-40" />
      <span className="grid h-9 w-14 place-items-center rounded-[4px] bg-current/15">
        <span className="ms-0.5 h-0 w-0 border-y-[7px] border-s-[11px] border-y-transparent border-s-current" />
      </span>
    </span>
  ),
  manual: (
    <span className="flex items-center gap-2">
      <span className="flex flex-col gap-[3px]">
        <span className="h-[3px] w-5 rounded-full bg-current opacity-30" />
        <span className="h-[3px] w-8 rounded-full bg-current" />
        <span className="h-[3px] w-4 rounded-full bg-current opacity-30" />
      </span>
      <span className="grid h-9 w-14 place-items-center rounded-[4px] bg-current/15">
        <span className="ms-0.5 h-0 w-0 border-y-[7px] border-s-[11px] border-y-transparent border-s-current" />
      </span>
    </span>
  ),
};

export function PlayModeChoice() {
  const { settings, update } = useSettings();
  const t = useT();
  const modes: Array<{ id: "instant" | "manual"; label: string; line: string }> = [
    { id: "instant", label: t("Instant"), line: t("Plays the best stream straight away.") },
    { id: "manual", label: t("Pick a source"), line: t("Shows the stream list every time.") },
  ];
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {modes.map((m) => {
        const on = settings.instantPlay === (m.id === "instant");
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => update({ instantPlay: m.id === "instant" })}
            aria-pressed={on}
            className={`flex flex-col gap-3 rounded-md px-4 py-4 text-start transition-colors ${
              on ? "bg-ink text-canvas" : "bg-elevated text-ink hover:bg-raised"
            }`}
          >
            <span className={`flex h-10 items-center ${on ? "text-canvas" : "text-ink-subtle"}`}>
              {MODE_ART[m.id]}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[13.5px] font-semibold">{m.label}</span>
              <span
                className={`text-[12.5px] leading-snug ${on ? "text-canvas/70" : "text-ink-subtle"}`}
              >
                {m.line}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PlayModePanel() {
  const { settings, update } = useSettings();
  const t = useT();

  return (
    <div className="flex flex-col gap-5">
      <SettingGroup label={t("Playback")}>
        <SettingRow
          label={t("Play button behavior")}
          desc={t(
            "Choose whether Play asks, prefers this device, online sources, or one of your home servers.",
          )}
        >
          <Dropdown
            className="w-56"
            value={settings.playbackSourcePreference}
            onChange={(value) =>
              update({
                playbackSourcePreference: value as typeof settings.playbackSourcePreference,
              })
            }
            options={[
              { value: "ask", label: t("Ask every time") },
              { value: "online", label: t("Prefer online streams") },
              { value: "local", label: t("Prefer this device") },
              { value: "home-server", label: t("Prefer a home server") },
            ]}
          />
        </SettingRow>
        {settings.playbackSourcePreference === "home-server" && (
          <SettingRow
            label={t("Preferred home server")}
            desc={t(
              "Ask when more than one server has a copy, or always prefer a specific server.",
            )}
          >
            <Dropdown
              className="w-56"
              value={settings.preferredMediaServerId ?? ""}
              onChange={(value) => update({ preferredMediaServerId: value || null })}
              options={[
                { value: "", label: t("Ask which server") },
                ...mediaServerConnections()
                  .filter((connection) => connection.enabled)
                  .map((connection) => ({ value: connection.id, label: connection.name })),
              ]}
            />
          </SettingRow>
        )}
        <PlayModeChoice />
        <ToggleRow
          label={t("Stay on one source for a season")}
          preview={<SeasonLockArt />}
          sub={t(
            "For series and anime, keep playing the rest of the season from the release you first picked. Applies whether Play is instant or manual.",
          )}
          value={settings.seasonSourceLock}
          onChange={(v) => update({ seasonSourceLock: v })}
        />
        <Anchored id="set-instant-playback-preparation">
          <ToggleRow
            label={t("Instant playback preparation")}
            sub={t(
              "Prepares up to two provider-confirmed cached debrid sources while the picker is open, so Play can start sooner. This may create or update transfers on your debrid account before you click Play. It never touches P2P or uncached sources, is rate-limited, and keeps prepared links in memory for two minutes only. Off by default.",
            )}
            value={settings.instantPlaybackPreparation}
            onChange={(v) => update({ instantPlaybackPreparation: v })}
          />
        </Anchored>
        <Anchored id="set-remember-last-stream">
          <ToggleRow
            label={t("Remember last stream")}
            preview={<RememberStreamArt />}
            sub={t(
              "When you resume something you were watching, replay the exact stream you last used (same addon and source) instead of opening the picker again. Turn off to always choose fresh.",
            )}
            value={settings.rememberLastStream}
            onChange={(v) => update({ rememberLastStream: v })}
          />
        </Anchored>
      </SettingGroup>

      <SettingGroup label={t("Resume")}>
        <ToggleRow
          label={t("Resume where you left off")}
          preview={<ResumeArt />}
          sub={t(
            "Pick up partly-watched episodes and movies at your saved spot. Anything watched past 80% always restarts. Turn this off to always start from the beginning, handy if you rewatch shows.",
          )}
          value={settings.resumePlayback}
          onChange={(v) => update({ resumePlayback: v })}
        />
        <ToggleRow
          label={t("Ask to resume or start over")}
          preview={<ResumePromptArt />}
          sub={t(
            "When you hit Play on something you've partly watched, show a prompt to resume from where you left off or start over. Also covers items synced from Stremio or Trakt.",
          )}
          value={settings.resumePrompt}
          onChange={(v) => update({ resumePrompt: v })}
        />
      </SettingGroup>

      <SettingGroup label={t("Streams")}>
        <Anchored id="set-auto-skip-stalled-streams">
          <ToggleRow
            label={t("Auto-skip stalled streams")}
            preview={<StallSkipArt />}
            sub={t(
              "If a stream hasn't started playing in time (a dead source or an addon that's down), automatically try the next available stream. Off by default.",
            )}
            value={settings.autoNextStreamOnStall}
            onChange={(v) => update({ autoNextStreamOnStall: v })}
          />
        </Anchored>
        {settings.autoNextStreamOnStall && (
          <Nested>
            <SettingRow
              icon={<Timer size={16} />}
              label={t("How long to wait first")}
              desc={t(
                "Slow addons and P2P sources often need more than 10 seconds to start. Raise this if streams are being skipped before they get a fair chance.",
              )}
            >
              <Segmented
                value={String(stallWaitSec(settings.autoNextStreamOnStallSec))}
                options={STALL_WAIT_OPTIONS.map((sec) => ({
                  value: String(sec),
                  label: sec >= 60 ? t("1 min") : t("{n} sec", { n: sec }),
                }))}
                onChange={(v) => update({ autoNextStreamOnStallSec: Number(v) })}
              />
            </SettingRow>
          </Nested>
        )}
        <ToggleRow
          label={t("Keep same source on next episode")}
          sub={t(
            "When auto-playing the next episode, keep the same release/source you were just watching instead of Harbor's top-ranked stream. Falls back to the best stream if that source isn't available.",
          )}
          value={settings.keepSourceNextEpisode}
          onChange={(v) => update({ keepSourceNextEpisode: v })}
        />
        <ToggleRow
          label={t("Download the whole file while streaming")}
          sub={t(
            "Buffers the whole file in the background as you watch, even while paused, so big remuxes pre-load and you can scrub a cached file with no re-buffering. Works for debrid and torrent streams. Uses more disk and bandwidth; cleared when you switch or close.",
          )}
          value={settings.torrentFullDownload}
          onChange={(v) => update({ torrentFullDownload: v })}
        />
      </SettingGroup>

      <SettingGroup label={t("Fullscreen")}>
        <Anchored id="set-what-fullscreen-does">
          <Anchored id="set-fullscreen-mode">
            <SettingRow
              icon={<Maximize2 size={16} />}
              label={t("What fullscreen does")}
              desc={t(
                "True fullscreen covers the whole screen and hides the taskbar. Maximize fills the screen but keeps the taskbar and title bar, so you can still switch apps.",
              )}
            >
              <Segmented
                value={settings.fullscreenMode ?? "fullscreen"}
                options={[
                  { value: "fullscreen", label: t("True fullscreen") },
                  { value: "maximized", label: t("Maximize") },
                ]}
                onChange={(fullscreenMode) => update({ fullscreenMode })}
              />
            </SettingRow>
          </Anchored>
        </Anchored>
        <ToggleRow
          label={t("Stay in fullscreen after closing the player")}
          sub={t(
            "When you exit playback, keep the window fullscreen instead of dropping back to a window. Turn off to leave fullscreen automatically whenever the player closes.",
          )}
          value={settings.keepFullscreenOnExit}
          onChange={(v) => update({ keepFullscreenOnExit: v })}
        />
        <ToggleRow
          label={t("Restore window position after fullscreen")}
          sub={t(
            "When you exit fullscreen, return the window to exactly where it was. Turn off to center it on screen instead.",
          )}
          value={settings.fullscreenRestorePosition}
          onChange={(v) => update({ fullscreenRestorePosition: v })}
        />
      </SettingGroup>

      <SettingGroup label={t("Overlay")}>
        <ToggleRow
          label={t("Volume pop-up while watching")}
          sub={t(
            "Show a quick volume overlay when you change volume with the player controls hidden, so keyboard and scroll wheel changes are always visible.",
          )}
          value={settings.playerVolumeHud}
          onChange={(v) => update({ playerVolumeHud: v })}
        />
        {settings.playerVolumeHud && (
          <Nested>
            <SettingRow
              icon={<Move size={16} />}
              label={t("Pop-up position")}
              desc={t("Where the volume overlay appears on the video.")}
            >
              <Segmented
                value={settings.playerVolumeHudPosition}
                options={[
                  { value: "center", label: t("Center") },
                  { value: "top", label: t("Top") },
                  { value: "top-left", label: t("Top left") },
                  { value: "top-right", label: t("Top right") },
                ]}
                onChange={(playerVolumeHudPosition) => update({ playerVolumeHudPosition })}
              />
            </SettingRow>
          </Nested>
        )}
      </SettingGroup>
    </div>
  );
}
