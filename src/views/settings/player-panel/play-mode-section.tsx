import { Timer } from "../icons";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { STALL_WAIT_OPTIONS, stallWaitSec } from "@/lib/player/stall-wait";
import { SettingGroup, SettingRow } from "../kit";
import { RowDesc, RowTitle, Segmented, ToggleRow, useRegisterRowTitle } from "../shared";
import { Dropdown } from "@/components/dropdown";
import { mediaServerConnections } from "@/lib/media-server/connections";
import { Anchored, Nested } from "./choice";
import { PressPlayPreview } from "./press-play-preview";
import {
  RememberStreamArt,
  ResumeArt,
  ResumePromptArt,
  SeasonLockArt,
  StallSkipArt,
} from "./setting-art";

export function PlayModeChoice() {
  const { settings, update } = useSettings();
  const t = useT();
  useRegisterRowTitle(t("When you press Play"));
  return (
    <div className="hset-row hset-play-choice">
      <div className="flex min-w-0 flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <RowTitle>{t("When you press Play")}</RowTitle>
          <RowDesc>{t("Instant starts the best-ranked stream straight away. Pick a source opens the stream list every time, so you choose the release, quality and provider yourself.")}</RowDesc>
        </div>
        <Segmented<"instant" | "manual">
          value={settings.instantPlay ? "instant" : "manual"}
          options={[
            { value: "instant", label: t("Instant") },
            { value: "manual", label: t("Pick a source") },
          ]}
          onChange={(v) => update({ instantPlay: v === "instant" })}
        />
      </div>
      <PressPlayPreview instant={settings.instantPlay} />
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
          label={t("Where Play looks first")}
          desc={t(
            "Choose whether Play asks you, prefers this device, prefers online sources, or goes straight to one of your home servers.",
          )}
        >
          <Dropdown
            className="w-[280px] max-w-full"
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
            wide
            label={t("Preferred home server")}
            desc={t(
              "Ask when more than one server has a copy, or always prefer a specific server.",
            )}
          >
            <div className="w-full max-w-[420px]">
              <Dropdown
                value={settings.preferredMediaServerId ?? ""}
                onChange={(value) => update({ preferredMediaServerId: value || null })}
                options={[
                  { value: "", label: t("Ask which server") },
                  ...mediaServerConnections()
                    .filter((connection) => connection.enabled)
                    .map((connection) => ({ value: connection.id, label: connection.name })),
                ]}
              />
            </div>
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
              "Prepares cached debrid sources while you browse the picker so Play can start sooner. May create or update transfers on your debrid account before you press Play. P2P sources are excluded.",
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
              wide
              icon={<Timer size={18} />}
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


    </div>
  );
}
