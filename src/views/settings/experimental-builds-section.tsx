import { useId, useRef, useState } from "react";
import { FlaskConical } from "./icons";
import { useT } from "@/lib/i18n";
import { isWindowsDesktop } from "@/lib/platform";
import { normalUpdateChannel, selectedUpdateChannel } from "@/lib/updater/channel";
import { useExperimentalAccess } from "@/lib/updater/experimental-access";
import { readBetaReturnContext } from "@/lib/updater/beta-return";
import {
  checkForUpdate,
  openUpdatePanel,
  setExperimentalUpdates,
  updateAvailable,
  updateChannelLocked,
  useUpdate,
} from "@/lib/updater/use-update";
import { ROW_ACTION, ROW_ACTION_PRIMARY, SettingRow } from "./kit";
import { Section } from "./shared";
import { BetaReturnSection } from "./beta-return-section";

const FOCUS =
  " focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function ExperimentalBuildsSection() {
  const t = useT();
  const u = useUpdate();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirmationId = useId();
  const access = useExperimentalAccess();
  const installedContext = readBetaReturnContext(__APP_VERSION__);
  const experimentalInstalled = installedContext !== null;
  const enabled = selectedUpdateChannel() === "experimental";
  const supported = isWindowsDesktop();
  const locked = updateChannelLocked();
  const checking = u.status === "checking";
  const ready = enabled && u.channel === "experimental" && updateAvailable(u);
  const normal = normalUpdateChannel() === "beta" ? t("Beta") : t("Stable");

  if (!access) {
    if (!experimentalInstalled) return null;
    return (
      <Section title={t("Experimental builds")}>
        <SettingRow
          wide
          icon={<FlaskConical size={18} aria-hidden="true" />}
          label={t("Return to a regular build")}
          desc={t(
            "Experimental access requires a Harbor account with a Tester, Moderator, Admin, or Dev badge.",
          )}
        >
          <BetaReturnSection />
        </SettingRow>
      </Section>
    );
  }

  function changeChannel(enable: boolean) {
    if (!setExperimentalUpdates(enable)) {
      setError(t("Couldn't save the update channel. Free some storage and try again."));
      return;
    }
    setError(null);
    setConfirming(false);
    trigger.current?.focus();
    if (enable) void checkForUpdate(true);
  }

  const status =
    error ??
    (locked
      ? t("Finish the current download or installation before changing channels.")
      : enabled
        ? (u.error ??
          (checking
            ? t("Checking experimental builds…")
            : u.status === "uptodate"
              ? t("No newer experimental build is available for this device.")
              : ready && u.experimentalVersion
                ? t("Experimental {version} · Build {buildId}", {
                    version: u.experimentalVersion,
                    buildId: u.buildId ?? "—",
                  })
                : t("Experimental updates are enabled on this device.")))
        : t("Experimental updates are off."));

  return (
    <Section title={t("Experimental builds")}>
      <SettingRow
        wide
        icon={<FlaskConical size={18} aria-hidden="true" />}
        label={t("Test upcoming changes")}
        desc={t("Available to Harbor accounts with a Tester, Moderator, Admin, or Dev badge.")}
      >
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            {t(
              "These builds may crash or change your settings. Back up Harbor before installing. Downloads and installation still require your approval.",
            )}
          </p>
          <p className="text-[12px] text-ink-muted">
            {experimentalInstalled
              ? `${t("Installed")}: ${t("Experimental")} ${installedContext.experimentalVersion}`
              : t("Installed: Harbor {version}", { version: __APP_VERSION__ })}
            {" · "}
            {t("Update channel: {channel}", { channel: enabled ? t("Experimental") : normal })}
          </p>
          {!supported && (
            <p className="text-[12.5px] text-ink-subtle">
              {t(
                "Experimental installation currently requires a managed Windows installation with a tested return to beta.",
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              ref={trigger}
              type="button"
              disabled={locked || (!supported && !enabled)}
              aria-expanded={!enabled ? confirming : undefined}
              aria-controls={!enabled && confirming ? confirmationId : undefined}
              onClick={() => (enabled ? changeChannel(false) : setConfirming(!confirming))}
              className={ROW_ACTION + FOCUS}
            >
              {enabled ? t("Leave experimental builds") : t("Enable experimental builds")}
            </button>
            {enabled && supported && (
              <button
                type="button"
                disabled={checking || u.status === "installing"}
                onClick={() => (ready ? openUpdatePanel() : void checkForUpdate(true))}
                className={ROW_ACTION_PRIMARY + FOCUS}
              >
                {ready ? t("View experimental update") : t("Check experimental builds")}
              </button>
            )}
          </div>
          {confirming && !enabled && (
            <div
              id={confirmationId}
              className="flex flex-col gap-3 rounded-md border border-edge p-3"
            >
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                {t(
                  "Enable experimental updates on this device? This replaces your normal update feed until you leave. It does not install a build now.",
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => changeChannel(true)}
                  className={ROW_ACTION_PRIMARY + FOCUS}
                >
                  {t("Enable and check")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    trigger.current?.focus();
                  }}
                  className={ROW_ACTION + FOCUS}
                >
                  {t("Cancel")}
                </button>
              </div>
            </div>
          )}
          <p
            role="status"
            aria-atomic="true"
            className="text-[12.5px] leading-relaxed text-ink-muted"
          >
            {status}
          </p>
          {enabled && (
            <p className="text-[12px] leading-relaxed text-ink-subtle">
              {t(
                "Leaving only turns off experimental checks. Use Return to beta below to replace the experimental app.",
              )}
            </p>
          )}
          <BetaReturnSection />
        </div>
      </SettingRow>
    </Section>
  );
}
