import { Download, FlaskConical, Loader2, RotateCw } from "lucide-react";
import { useSettings } from "@/lib/settings";
import {
  checkForUpdate,
  clearStagedUpdate,
  openUpdatePanel,
  updateAvailable,
  useUpdate,
} from "@/lib/updater/use-update";
import { BetaTag } from "@/components/beta-tag";
import { useT } from "@/lib/i18n";
import { ToggleRow } from "../shared";
import { SettingRow } from "../kit";

export function BetaChannelRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const on = settings.betaUpdates;
  return (
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
        if (!betaUpdates) clearStagedUpdate();
        update({ betaUpdates });
      }}
    />
  );
}

export function UpdatesRow() {
  const t = useT();
  const u = useUpdate();
  const ready = updateAvailable(u);
  const busy = u.status === "checking";
  const status =
    u.status === "checking"
      ? t("Checking harbor.site for a newer build.")
      : u.status === "downloading"
        ? t("Downloading {pct}%", { pct: Math.round(u.progress * 100) })
        : u.status === "downloaded"
          ? t("Downloaded. Ready to install and restart.")
          : u.status === "installing"
            ? t("Installing. Harbor will restart.")
            : u.status === "available"
              ? t("A new version is ready to download.")
              : u.status === "uptodate"
                ? t("You're on the latest version.")
                : u.status === "error" && u.manualCheck
                  ? t("Couldn't reach the update server. Try again in a moment.")
                  : t("Harbor checks automatically every few hours.");
  return (
    <SettingRow
      icon={
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-md ${
            ready ? "bg-accent-soft text-accent" : "bg-raised text-ink-muted"
          }`}
        >
          <RotateCw size={16} strokeWidth={2} className={busy ? "animate-spin" : ""} />
        </span>
      }
      label={
        <>
          {ready && u.version
            ? t("Harbor {version} available", { version: u.version })
            : `Harbor ${__APP_VERSION__}`}
          <BetaTag />
        </>
      }
      desc={status}
    >
      {ready ? (
        <button
          onClick={openUpdatePanel}
          className="harbor-press-pop flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-accent px-4 text-[12.5px] font-semibold text-canvas transition-[filter] hover:brightness-105"
        >
          <Download size={14} strokeWidth={2.2} /> {t("Update now")}
        </button>
      ) : (
        <button
          onClick={() => void checkForUpdate(true)}
          disabled={busy}
          className="harbor-press-pop flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-raised px-3.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RotateCw size={14} strokeWidth={2.2} />
          )}
          {busy ? t("Checking") : t("Check for updates")}
        </button>
      )}
    </SettingRow>
  );
}
