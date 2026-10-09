import { Download, FlaskConical, Loader2, RotateCw } from "../icons";
import { useId, useState } from "react";
import { useSettings } from "@/lib/settings";
import { readChannelPreference, selectedUpdateChannel } from "@/lib/updater/channel";
import { readBetaReturnContext } from "@/lib/updater/beta-return";
import {
  checkForUpdate,
  setUpdateChannel,
  openUpdatePanel,
  updateAvailable,
  useUpdate,
} from "@/lib/updater/use-update";
import { IS_BETA_BUILD } from "@/lib/build-info";
import { useT } from "@/lib/i18n";
import { ToggleRow } from "../shared";
import { ROW_ACTION, ROW_ACTION_PRIMARY, SettingRow } from "../kit";

const QUAL =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

export function BetaChannelRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const u = useUpdate();
  const [error, setError] = useState<string | null>(null);
  const descriptionId = useId();
  const preference = readChannelPreference();
  const on = preference ? preference.normal === "beta" : settings.betaUpdates;
  const experimental = selectedUpdateChannel() === "experimental";
  const locked = experimental || u.status === "downloading" || u.status === "installing";
  return (
    <fieldset
      disabled={locked}
      className="min-w-0"
      aria-describedby={locked ? descriptionId : undefined}
    >
      <ToggleRow
        label={t("Get beta updates")}
        sub={t(
          "Receive early builds with the newest fixes before they reach the stable release. Betas can be rough around the edges; switch this off to return to stable at the next update.",
        )}
        leading={
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-md ${
              on ? "bg-accent-soft text-accent" : "bg-raised text-ink-subtle"
            }`}
          >
            <FlaskConical size={16} strokeWidth={2.2} />
          </span>
        }
        value={on}
        onChange={(betaUpdates) => {
          if (!setUpdateChannel(betaUpdates ? "beta" : "stable")) {
            setError(t("Couldn't save the update channel. Free some storage and try again."));
            return;
          }
          setError(null);
          update({ betaUpdates });
        }}
      />
      {locked && (
        <p id={descriptionId} className="px-4 py-2 text-[12px] text-ink-subtle">
          {experimental
            ? t("Leave experimental builds before changing your normal update channel.")
            : t("Finish the current download or installation before changing channels.")}
        </p>
      )}
      {error && (
        <p role="alert" className="px-4 py-2 text-[12px] text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function UpdatesRow() {
  const t = useT();
  const u = useUpdate();
  const installedExperimental = readBetaReturnContext(__APP_VERSION__);
  const ready = u.intent !== "return-beta" && updateAvailable(u);
  const busy = u.intent === "return-beta" || u.status === "checking" || u.status === "installing";
  const status =
    u.intent === "return-beta"
      ? t("Continue the return to beta in Experimental builds below.")
      : u.status === "checking"
        ? t("Checking harbor.site for a newer build.")
        : u.status === "downloading"
          ? t("Downloading {pct}%", { pct: Math.round(u.progress * 100) })
          : u.status === "downloaded"
            ? t("Downloaded. Ready to install and restart.")
            : u.status === "installing"
              ? t("Installing. Harbor will restart.")
              : u.status === "available"
                ? t("A new version is ready to download.")
                : u.status === "unavailable"
                  ? u.error
                  : u.status === "uptodate"
                    ? u.channel === "experimental"
                      ? t("No newer experimental build is available for this device.")
                      : t("You're on the latest version.")
                    : u.status === "error" && u.manualCheck
                      ? t("Couldn't reach the update server. Try again in a moment.")
                      : t("Harbor checks automatically every few hours.");
  return (
    <SettingRow
      icon={
        <RotateCw
          size={20}
          strokeWidth={2}
          className={`${ready ? "text-accent" : "text-ink-muted"} ${busy ? "animate-spin" : ""}`}
        />
      }
      label={
        <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0">
            {ready && u.channel === "experimental" && u.experimentalVersion
              ? `${t("Experimental")} ${u.experimentalVersion}`
              : ready && u.version
                ? t("Harbor {version} available", { version: u.version })
                : installedExperimental
                  ? `${t("Experimental")} ${installedExperimental.experimentalVersion}`
                  : `Harbor ${__APP_VERSION__}`}
          </span>
          {u.channel === "experimental" ? (
            <span className={`${QUAL} bg-accent-soft text-accent`}>{t("Experimental")}</span>
          ) : IS_BETA_BUILD ? (
            <span className={`${QUAL} bg-accent-soft text-accent`}>{t("Beta")}</span>
          ) : null}
        </span>
      }
      desc={status}
    >
      {ready ? (
        <button type="button" onClick={openUpdatePanel} className={ROW_ACTION_PRIMARY}>
          <Download size={16} strokeWidth={2.2} />
          {t("Update now")}
        </button>
      ) : (
        <button
          type="button"
          onClick={busy ? undefined : () => void checkForUpdate(true)}
          aria-disabled={busy}
          className={`${ROW_ACTION}${busy ? " pointer-events-none opacity-45" : ""}`}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RotateCw size={16} strokeWidth={2.2} />
          )}
          {busy ? t("Checking") : t("Check for updates")}
        </button>
      )}
    </SettingRow>
  );
}
