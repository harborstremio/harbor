import { Check, ExternalLink, Link2, LogOut, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { MalConnectModal } from "@/components/mal/mal-connect-modal";
import { fetchMalAvatar } from "@/lib/mal/profile";
import { useMal } from "@/lib/mal/provider";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";

export function MalPanel() {
  const t = useT();
  const { isConnected, userName, disconnect, session } = useMal();
  const { settings, update } = useSettings();
  const { activeProfile, updateProfile } = useProfiles();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [malAvatar, setMalAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      setMalAvatar(null);
      return;
    }
    let live = true;
    fetchMalAvatar().then((url) => {
      if (live) setMalAvatar(url);
    });
    return () => {
      live = false;
    };
  }, [isConnected]);

  const pushAvatar = (url: string | null) => {
    update({ harborAvatar: url });
    if (activeProfile) updateProfile(activeProfile.id, { avatar: url });
  };

  useEffect(() => {
    if (settings.useMalAvatar && malAvatar && settings.harborAvatar !== malAvatar) {
      pushAvatar(malAvatar);
    }
  }, [settings.useMalAvatar, malAvatar]);

  const toggleMalAvatar = (on: boolean) => {
    if (on) {
      if (malAvatar) pushAvatar(malAvatar);
      update({ useMalAvatar: true });
    } else {
      update({ useMalAvatar: false });
      if (settings.harborAvatar === malAvatar) pushAvatar(null);
    }
  };

  return (
    <>
      {!isConnected ? (
        <section className="flex flex-col gap-5 rounded-2xl border border-edge-soft bg-elevated/40 p-7">
          <div className="flex flex-col gap-2">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">
              {t("Connect your MyAnimeList account")}
            </h2>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {t("Sync your MyAnimeList watch progress and list as you finish episodes.")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalOpen(true)}
              className="flex h-11 items-center gap-2.5 rounded-xl bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
            >
              <Link2 size={15} strokeWidth={2.2} />
              {t("Connect MyAnimeList")}
            </button>
            <button
              onClick={() => openUrl("https://myanimelist.net")}
              className="flex h-11 items-center gap-2 rounded-xl border border-edge-soft px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
            >
              {t("About MyAnimeList")}
              <ExternalLink size={13} strokeWidth={2.2} />
            </button>
          </div>
        </section>
      ) : (
        <Section
          title={t("Connected")}
          subtitle={t("Harbor keeps your MyAnimeList watch progress in sync.")}
        >
          <ToggleRow
            label={t("Sync watch progress")}
            sub={t(
              "Finishing an anime episode updates your MyAnimeList progress. Forward only: it never lowers a count you already have.",
            )}
            value={settings.malAutoSync}
            onChange={(v) => update({ malAutoSync: v })}
          />
          {malAvatar && (
            <ToggleRow
              label={t("Use MyAnimeList avatar")}
              sub={t("Set your MyAnimeList profile picture as your Harbor avatar.")}
              value={settings.useMalAvatar}
              onChange={toggleMalAvatar}
              leading={
                <img
                  src={malAvatar}
                  alt=""
                  draggable={false}
                  className="h-9 w-9 rounded-full object-cover"
                />
              }
            />
          )}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/12 ring-1 ring-emerald-400/30 text-emerald-300">
                <Check size={16} strokeWidth={2.4} />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-medium text-ink">
                  {userName || t("Connected")}
                </span>
                <span className="text-[12px] text-ink-subtle">
                  {t("Authorized {when}", { when: sessionAge(t, session?.createdAt) })}
                </span>
              </div>
            </div>
            {userName && (
              <button
                onClick={() =>
                  openUrl(`https://myanimelist.net/profile/${encodeURIComponent(userName)}`)
                }
                className="flex h-9 items-center gap-1.5 rounded-lg border border-edge-soft px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                {t("Open profile")}
                <ExternalLink size={11} strokeWidth={2.2} />
              </button>
            )}
          </div>
          {!confirmDisconnect ? (
            <button
              onClick={() => setConfirmDisconnect(true)}
              className="flex items-center gap-2 self-start rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-red-300"
            >
              <Trash2 size={12} />
              {t("Disconnect from MyAnimeList")}
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-red-400/30 bg-red-400/5 p-3">
              <span className="text-[12.5px] text-red-200">
                {t("Disconnect MyAnimeList? Your progress will stop syncing until you reconnect.")}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmDisconnect(false)}
                  className="rounded-md px-2.5 py-1 text-[12px] text-ink-muted hover:text-ink"
                >
                  {t("Cancel")}
                </button>
                <button
                  onClick={() => {
                    if (settings.useMalAvatar && settings.harborAvatar === malAvatar) {
                      pushAvatar(null);
                    }
                    update({ useMalAvatar: false });
                    disconnect();
                    setConfirmDisconnect(false);
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-red-400/20 px-3 py-1 text-[12px] font-semibold text-red-200 hover:bg-red-400/30"
                >
                  <LogOut size={11} strokeWidth={2.4} />
                  {t("Disconnect")}
                </button>
              </div>
            </div>
          )}
        </Section>
      )}

      {modalOpen && <MalConnectModal onClose={() => setModalOpen(false)} />}
    </>
  );
}

function sessionAge(
  t: (key: string, vars?: Record<string, string | number>) => string,
  createdAt?: number,
): string {
  if (!createdAt) return "";
  const days = Math.floor((Date.now() - createdAt) / 86400000);
  if (days < 1) return t("today");
  if (days < 30) return days === 1 ? t("{n} day ago", { n: days }) : t("{n} days ago", { n: days });
  const months = Math.floor(days / 30);
  return months === 1 ? t("{n} month ago", { n: months }) : t("{n} months ago", { n: months });
}
