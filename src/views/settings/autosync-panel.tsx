import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { ROW_DESC, Section, ToggleRow } from "./shared";
import { ModalButton, ROW_ACTION, SettingGroup, SettingRow, SettingsModal, Nested } from "./kit";

const SPEECH: ReadonlyArray<readonly [number, number]> = [
  [1, 12],
  [19, 8],
  [32, 16],
  [55, 10],
  [70, 7],
  [82, 14],
];
const DRIFT = 5;

function SyncTrack({ label, shift, lit }: { label: string; shift: number; lit?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[84px] shrink-0 text-[13px] font-bold uppercase leading-[18px] tracking-[0.72px] text-ink-subtle">
        {label}
      </span>
      <span className="relative h-3 min-w-0 flex-1">
        {SPEECH.map(([left, width], i) => (
          <span
            key={i}
            aria-hidden
            className={`absolute top-0 h-full rounded-full ${lit ? "bg-ink" : "bg-raised"}`}
            style={{ insetInlineStart: `${left + shift}%`, width: `${width}%` }}
          />
        ))}
      </span>
    </div>
  );
}

export function AutoSyncPanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const master = settings.subtitleAutoSync;
  const priv = settings.communitySyncOptOut;
  const storedUrl = (settings.communitySyncUrl ?? "").trim();

  const [urlDraft, setUrlDraft] = useState(settings.communitySyncUrl);
  const [urlSaved, setUrlSaved] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);
  const savedTimer = useRef<number | null>(null);
  const flashSaved = () => {
    setUrlSaved(true);
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setUrlSaved(false), 1800);
  };
  useEffect(
    () => () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    },
    [],
  );

  const openServer = () => {
    setUrlDraft(settings.communitySyncUrl);
    setServerOpen(true);
  };
  const closeServer = () => {
    const next = urlDraft.trim();
    if (next !== storedUrl) {
      update({ communitySyncUrl: next });
      flashSaved();
    }
    setServerOpen(false);
  };

  const serverDesc = urlSaved
    ? t("Saved.")
    : storedUrl ||
      t("Harbor uses its own community server. You can point it at a server you run yourself.");

  return (
    <>
      <Section
        title={t("Subtitle auto-sync")}
        subtitle={t(
          "Harbor times out-of-sync subtitles to the audio for you, on any external subtitle. It works on the mpv player and leaves embedded tracks alone, since those are already in sync.",
        )}
      >
        <ToggleRow
          label={t("Auto-sync subtitles")}
          sub={t(
            "When a subtitle runs early or late, Harbor measures the speech and corrects the timing on its own. Off by default.",
          )}
          value={master}
          onChange={(v) => update({ subtitleAutoSync: v })}
        />

        <SettingRow
          wide
          label={t("How it works")}
          desc={t(
            "Harbor reads the speech in the audio, then slides the subtitle track until the two line up.",
          )}
        >
          <div className="flex w-full flex-col gap-3 rounded-[10px] bg-elevated px-4 py-4">
            <SyncTrack label={t("Speech")} shift={0} />
            <SyncTrack label={t("Before")} shift={DRIFT} />
            <SyncTrack label={t("After")} shift={0} lit />
          </div>
        </SettingRow>

        {master && (
          <Nested>
            <SettingGroup label={t("While auto-sync is on")}>
              <ToggleRow
                label={t("Let structural tiers auto-apply")}
                sub={t(
                  "Identity matches from content hashing and the community database always apply on their own. Timing worked out from the audio only offers a fix until it has earned trust. Turn this on to let those audio-derived fixes apply automatically too.",
                )}
                value={settings.autoSyncApplyStructural}
                onChange={(v) => update({ autoSyncApplyStructural: v })}
              />
              <ToggleRow
                label={t("Drift monitor")}
                sub={t(
                  "Keeps watching through playback and gently re-nudges the timing if the subtitle slips out of sync partway through.",
                )}
                value={settings.autoSyncDrift}
                onChange={(v) => update({ autoSyncDrift: v })}
              />
              <ToggleRow
                label={t("Smart resync with speech recognition")}
                sub={t(
                  "For the hardest files and the Try again button, Harbor transcribes a little speech on your device and lines the subtitle up to the actual words. Needs a build with the asr-whisper feature and downloads a small model the first time you use it.",
                )}
                value={settings.subtitleAutoSyncAsr}
                onChange={(v) => update({ subtitleAutoSyncAsr: v })}
              />
              <ToggleRow
                label={t("Match subtitles across languages (experimental)")}
                sub={t(
                  "When the audio and subtitle use different languages, Harbor compares a release-matched subtitle in the audio language. It only offers a fix unless every safety check is measured.",
                )}
                value={settings.subtitleAutoSyncPivot}
                onChange={(v) => update({ subtitleAutoSyncPivot: v })}
              />
            </SettingGroup>
          </Nested>
        )}
      </Section>

      <Section
        title={t("Community sync")}
        subtitle={t(
          "A good correction only has to be found once. Harbor can share verified fixes so the next person with the same file and subtitle gets an instant result. Records are keyed by salted fingerprints, never your files or anything personal.",
        )}
      >
        <ToggleRow
          label={t("Use community corrections")}
          sub={t(
            "Check the shared database first. When this exact subtitle has already been synced by someone else, yours snaps into place with no analysis.",
          )}
          value={settings.subtitleAutoSyncCrowd}
          onChange={(v) => update({ subtitleAutoSyncCrowd: v })}
          lockReason={
            priv
              ? t("Private mode is on, so nothing is looked up or contributed from this device.")
              : undefined
          }
        />

        <SettingGroup label={t("Server and privacy")}>
          <SettingRow
            label={t("Community sync server")}
            desc={serverDesc}
            tip={t(
              "Leave blank to use Harbor's own community server. Enter a URL to point at your own server instead. Private mode below stops all contact either way.",
            )}
          >
            <button type="button" onClick={openServer} className={ROW_ACTION}>
              {storedUrl ? t("Change server") : t("Use my own server")}
            </button>
          </SettingRow>
          <ToggleRow
            label={t("Private mode")}
            sub={t(
              "Never contact the community server in either direction. Nothing is looked up and nothing is contributed from this device.",
            )}
            value={priv}
            onChange={(v) => update({ communitySyncOptOut: v })}
          />
        </SettingGroup>

        <SettingsModal
          open={serverOpen}
          onClose={closeServer}
          title={t("Community sync server")}
          sub={t(
            "Leave this blank to use Harbor's own community server, or enter the address of a server you run yourself.",
          )}
          actions={<ModalButton onClick={closeServer}>{t("Save")}</ModalButton>}
        >
          <div className="flex flex-col gap-2.5">
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  closeServer();
                }
              }}
              placeholder={t("https://sync.harbor.site")}
              spellCheck={false}
              autoComplete="off"
              className="h-11 w-full min-w-0 max-w-[520px] rounded-[10px] border border-edge-soft bg-elevated px-4 text-[16.5px] text-ink outline-none placeholder:text-ink-subtle/55 focus-visible:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <p className={`max-w-[70ch] ${ROW_DESC}`}>
              {t("Private mode stops all contact with this server in either direction.")}
            </p>
          </div>
        </SettingsModal>
      </Section>
    </>
  );
}
