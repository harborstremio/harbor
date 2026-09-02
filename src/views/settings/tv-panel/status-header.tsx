import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useProfiles } from "@/lib/profiles";
import { useSyncStatus } from "@/lib/profile-sync/use-sync-status";
import { Section, useSettingsActiveContext } from "../shared";
import { SettingRow } from "../kit";
import { pushTvNow, tvSyncReady, tvWiresBlocked, type TvWireName } from "./store";

function BlockedBanner({ blocked }: { blocked: TvWireName[] }) {
  const t = useT();
  return (
    <div className="flex items-start gap-3 rounded-md bg-danger/15 px-4 py-3.5">
      <CloudOff size={16} strokeWidth={2.2} className="mt-[2px] shrink-0 text-danger" />
      <div className="flex flex-col gap-1">
        <span className="text-[13.5px] font-semibold text-danger">
          {t("This page cannot reach your TV")}
        </span>
        <span className="text-[12.5px] leading-relaxed text-ink-muted">
          {t(
            "Changes you make below will be saved on this computer, but they will not reach your TV. This is a fault in Harbor, not something you did.",
          )}{" "}
          {t("Affected settings:")}{" "}
          <span className="font-medium text-ink">{blocked.join(", ")}</span>.
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
        line: "This build cannot carry TV settings to the account yet. Everything on this page saves on this computer and will go up the moment the sync section names are enabled.",
      }
    : status.phase === "signed-out"
      ? {
          tone: "warn",
          line: "You are not signed in to a Harbor account, so nothing here can reach the TV.",
          fix: "account",
        }
      : status.phase === "no-refresh"
        ? {
            tone: "warn",
            line: "This session cannot refresh its token. Sign out and back in, or the TV will never see these changes.",
            fix: "account",
          }
        : !scoped
          ? {
              tone: "warn",
              line: "These settings belong to a profile, and this computer is not in one. Pick a profile and the TV will follow it.",
            }
          : status.queued > 0
            ? { tone: "on", line: `${status.queued} change${status.queued === 1 ? "" : "s"} waiting to go up.` }
            : status.lastPushAt > 0
              ? { tone: "on", line: `Sent to your account ${ago(status.lastPushAt, now)}.` }
              : { tone: "off", line: "Nothing sent yet. Change something and it goes up on its own." };

  return (
    <Section
      title={t("The link to your TV")}
      subtitle={t("Everything on this page is written to your Harbor account. Your TV reads it on its next check-in, so you can set the whole thing up from here and never touch the remote.")}
    >
      {blocked.length > 0 && <BlockedBanner blocked={blocked} />}
      <SettingRow
        icon={<Dot tone={read.tone} />}
        label={
          scoped && activeProfile
            ? t("Editing the TV for {name}", { name: activeProfile.name })
            : t("Editing the TV")
        }
        desc={t(read.line)}
      >
        <button
          type="button"
          onClick={pushTvNow}
          disabled={!ready || !scoped}
          className="shrink-0 rounded-md bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("Send to TV now")}
        </button>
        {read.fix && (
          <button
            type="button"
            onClick={() => setActive("account")}
            className="shrink-0 rounded-md bg-raised px-3.5 py-2 text-[12.5px] font-semibold text-ink transition-opacity hover:opacity-90"
          >
            {t("Open Account")}
          </button>
        )}
      </SettingRow>
    </Section>
  );
}
