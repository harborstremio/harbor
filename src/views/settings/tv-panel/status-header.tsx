import { useEffect, useState } from "react";
import { CloudOff } from "../icons";
import { useT } from "@/lib/i18n";
import { useProfiles } from "@/lib/profiles";
import { useSyncStatus } from "@/lib/profile-sync/use-sync-status";
import { settingsAnchor, useSettingsActiveContext } from "../shared";
import { SettingRow } from "../kit";
import { SButton } from "../ui";
import { pushTvNow, tvSyncReady, tvWiresBlocked, type TvWireName } from "./store";

function BlockedBanner({ blocked }: { blocked: TvWireName[] }) {
  const t = useT();
  return (
    <div className="flex items-start gap-3 rounded-[10px] bg-danger/15 px-4 py-3.5">
      <CloudOff size={18} strokeWidth={2.2} className="mt-[3px] shrink-0 text-danger" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[16.5px] font-medium leading-[24px] tracking-[-0.1px] text-danger">
          {t("This page cannot reach your TV")}
        </span>
        <span className="max-w-[70ch] text-[15.5px] font-normal leading-[22px] text-ink-muted">
          {t(
                "Some TV settings cannot sync in this build. Your changes remain saved on this computer.",
          )}{" "}
          {t("Affected settings:")}{" "}
          <span className="font-medium text-ink">{blocked.map((wire) => t(wire === "settings" ? "TV options" : wire === "theme" ? "Theme" : "Player layout")).join(", ")}</span>.
        </span>
      </div>
    </div>
  );
}

function ago(at: number, now: number): string {
  if (!at) return "";
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

function Dot({ tone }: { tone: "on" | "off" | "warn" }) {
  const cls =
    tone === "on" ? "bg-accent" : tone === "warn" ? "bg-danger" : "bg-ink-subtle";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

type Read = { tone: "on" | "off" | "warn"; line: string; fix?: string };

export function TvStatusHeader() {
  const t = useT();
  const status = useSyncStatus();
  const { activeProfile, activeId } = useProfiles();
  const { setActive } = useSettingsActiveContext();
  const [now, setNow] = useState(() => Date.now());
  const blocked = tvWiresBlocked();
  const ready = tvSyncReady();

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const scoped = !!activeId && activeId !== "default";

  const read: Read = !ready
    ? {
        tone: "warn",
        line: "Cloud sync for TV settings is unavailable in this build. Changes stay saved on this computer.",
      }
    : status.phase === "off"
      ? {
          tone: "off",
          line: "Cloud sync is off. TV settings stay saved on this computer.",
          fix: "account",
        }
    : status.phase === "signed-out"
      ? {
          tone: "warn",
          line: "Sign in to Harbor to sync these settings through your account.",
          fix: "account",
        }
      : status.phase === "no-refresh"
        ? {
            tone: "warn",
            line: "Sign in again to resume cloud sync. Your changes are saved on this computer.",
            fix: "account",
          }
        : !scoped
          ? {
              tone: "warn",
              line: "Choose a profile to sync its TV settings.",
            }
          : status.lastError
            ? { tone: "warn", line: "Cloud sync couldn't finish. Your changes are saved here; try syncing again." }
          : status.queued > 0
            ? { tone: "on", line: `${status.queued} change${status.queued === 1 ? "" : "s"} waiting to sync.` }
            : status.lastPushAt > 0
              ? { tone: "on", line: `Sent to your account ${ago(status.lastPushAt, now)}.` }
              : { tone: "off", line: "Changes sync automatically through your Harbor account." };

  return (
    <div id={settingsAnchor("The link to your TV")} className="flex flex-col gap-3 border-b border-edge-soft pb-5">
      {blocked.length > 0 && <BlockedBanner blocked={blocked} />}
      <SettingRow
        icon={<Dot tone={read.tone} />}
        label={
          scoped && activeProfile
            ? t("TV settings for {name}", { name: activeProfile.name })
            : t("TV settings sync")
        }
        desc={t(read.line)}
      >
        <SButton onClick={pushTvNow} disabled={!ready || !scoped || !status.armed || !!read.fix || status.phase === "pushing"}>
          {status.phase === "pushing" ? t("Syncing…") : t("Sync now")}
        </SButton>
        {read.fix && (
          <SButton variant="primary" onClick={() => setActive("account", settingsAnchor("Harbor account"))}>{t("Open Harbor account")}</SButton>
        )}
      </SettingRow>
    </div>
  );
}
