import { Check, ExternalLink, Link2, LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { AnilistConnectModal } from "@/components/anilist/anilist-connect-modal";
import { useAnilist } from "@/lib/anilist/provider";
import { useSettings } from "@/lib/settings";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";

export function AnilistPanel() {
  const t = useT();
  const { isConnected, userName, disconnect, session, avatar } = useAnilist();
  const { settings, update } = useSettings();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  return (
    <>
      {!isConnected ? (
        <section className="flex flex-col gap-5 rounded-2xl border border-edge-soft bg-elevated/40 p-7">
          <div className="flex flex-col gap-2">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">
              {t("Connect your AniList account")}
            </h2>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {t(
                "Show your AniList lists as rails on the Anime page, keep your watch progress in sync as you finish episodes, and use your AniList avatar as your Harbor photo. Free at anilist.co.",
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalOpen(true)}
              className="flex h-11 items-center gap-2.5 rounded-xl bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
            >
              <Link2 size={15} strokeWidth={2.2} />
              {t("Connect AniList")}
            </button>
            <button
              onClick={() => openUrl("https://anilist.co")}
              className="flex h-11 items-center gap-2 rounded-xl border border-edge-soft px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
            >
              {t("About AniList")}
              <ExternalLink size={13} strokeWidth={2.2} />
            </button>
          </div>
        </section>
      ) : (
        <Section
          title={t("Connected")}
          subtitle={t(
            "Harbor shows your AniList lists on the Anime page and keeps your progress in sync.",
          )}
        >
          <div className="flex items-center justify-between gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
            <div className="flex items-center gap-3">
              {avatar ? (
                <img
                  src={avatar}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-edge-soft"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/12 ring-1 ring-emerald-400/30 text-emerald-300">
                  <Check size={16} strokeWidth={2.4} />
                </span>
              )}
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
                onClick={() => openUrl(`https://anilist.co/user/${encodeURIComponent(userName)}`)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-edge-soft px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                {t("Open profile")}
                <ExternalLink size={11} strokeWidth={2.2} />
              </button>
            )}
          </div>
          <ToggleRow
            label={t("Sync watch progress")}
            sub={t(
              "Finishing an anime episode updates your AniList progress. Forward only: it never lowers a count you already have.",
            )}
            value={settings.anilistAutoSync}
            onChange={(v) => update({ anilistAutoSync: v })}
          />
          <ToggleRow
            label={t("Use my AniList avatar as my Harbor avatar")}
            sub={t("Show your AniList profile picture as your Harbor avatar.")}
            value={settings.useAnilistAvatar}
            onChange={(v) => update({ useAnilistAvatar: v })}
          />
          <ToggleRow
            label={t("Show AniList comments")}
            sub={t("Show forum threads and comments from AniList on anime detail pages.")}
            value={settings.showAnilistComments === true}
            onChange={(v) => update({ showAnilistComments: v })}
          />
          <ToggleRow
            label={t("Blur comments by default")}
            sub={t(
              "Comments on anime pages are blurred until you reveal them, even if they are not tagged as spoilers.",
            )}
            value={!!settings.anilistBlurComments}
            onChange={(on) => update({ anilistBlurComments: on })}
          />
          {!confirmDisconnect ? (
            <button
              onClick={() => setConfirmDisconnect(true)}
              className="flex items-center gap-2 self-start rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-red-300"
            >
              <Trash2 size={12} />
              {t("Disconnect from AniList")}
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-red-400/30 bg-red-400/5 p-3">
              <span className="text-[12.5px] text-red-200">
                {t(
                  "Disconnect AniList? Your lists will stop showing on the Anime page until you reconnect.",
                )}
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

      {modalOpen && <AnilistConnectModal onClose={() => setModalOpen(false)} />}
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
