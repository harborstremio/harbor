import { ExternalLink, Link2, LogOut } from "lucide-react";
import { useState } from "react";
import { AnilistConnectModal } from "@/components/anilist/anilist-connect-modal";
import { useAnilist } from "@/lib/anilist/provider";
import { useSettings } from "@/lib/settings";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";
import anilistLogo from "@/assets/anilist.png";
import { ModalButton, SettingsModal } from "./kit";
import { TrackerIdentity } from "./tracker-identity";
import { Disclosure } from "./disclosure";
import { CommentArt, ScrobbleArt } from "./group-art";
import { SyncIndicatorSetting } from "./sync-indicator-setting";

export function AnilistPanel() {
  const t = useT();
  const { isConnected, userName, disconnect, session, avatar } = useAnilist();
  const { settings, update } = useSettings();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  return (
    <>
      {!isConnected ? (
        <section className="flex flex-col gap-5 rounded-md bg-elevated p-7">
          <div className="flex flex-col gap-2">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">
              {t("Connect your AniList account")}
            </h2>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {t("Show your AniList lists as rails on the Anime page, keep your watch progress in sync as you finish episodes, and use your AniList avatar as your Harbor photo. Free at anilist.co.")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalOpen(true)}
              className="flex h-11 items-center gap-2.5 rounded-md bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
            >
              <Link2 size={16} strokeWidth={2.2} />
              {t("Connect AniList")}
            </button>
            <button
              onClick={() => openUrl("https://anilist.co")}
              className="flex h-11 items-center gap-2 rounded-md bg-raised px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {t("About AniList")}
              <ExternalLink size={14} strokeWidth={2.2} />
            </button>
          </div>
        </section>
      ) : (
        <Section
          title={t("Connected")}
          subtitle={t("Harbor shows your AniList lists on the Anime page and keeps your progress in sync.")}
        >
          <TrackerIdentity
            logo={anilistLogo}
            service="AniList"
            handle={userName || undefined}
            avatar={avatar}
            meta={t("Authorized {when}", { when: sessionAge(t, session?.createdAt) })}
            profileUrl={
              userName ? `https://anilist.co/user/${encodeURIComponent(userName)}` : undefined
            }
            onDisconnect={() => setConfirmDisconnect(true)}
          />
          <ToggleRow
            label={t("Use my AniList avatar as my Harbor avatar")}
            sub={t("Show your AniList profile picture as your Harbor avatar.")}
            value={settings.useAnilistAvatar}
            onChange={(v) => update({ useAnilistAvatar: v })}
          />

          <Disclosure
            art={<ScrobbleArt />}
            title={t("Tracking what you watch")}
            summary={t("Whether finishing an episode updates your AniList progress.")}
            defaultOpen
          >
            <ToggleRow
              label={t("Sync watch progress")}
              sub={t("Finishing an anime episode updates your AniList progress. Forward only: it never lowers a count you already have.")}
              value={settings.anilistAutoSync}
              onChange={(v) => update({ anilistAutoSync: v })}
            />
          </Disclosure>

          <Disclosure
            art={<CommentArt />}
            title={t("Comments")}
            summary={t("AniList forum threads on anime detail pages.")}
          >
            <ToggleRow
              label={t("Show AniList comments")}
              sub={t("Show forum threads and comments from AniList on anime detail pages.")}
              value={settings.showAnilistComments === true}
              onChange={(v) => update({ showAnilistComments: v })}
            />
            <ToggleRow
              label={t("Blur comments by default")}
              sub={t("Comments on anime pages are blurred until you reveal them, even if they are not tagged as spoilers.")}
              value={!!settings.anilistBlurComments}
              onChange={(on) => update({ anilistBlurComments: on })}
            />
          </Disclosure>
          <SettingsModal
            open={confirmDisconnect}
            onClose={() => setConfirmDisconnect(false)}
            title={t("Disconnect from AniList")}
            actions={
              <>
                <ModalButton ghost onClick={() => setConfirmDisconnect(false)}>
                  {t("Cancel")}
                </ModalButton>
                <button
                  type="button"
                  onClick={() => {
                    disconnect();
                    setConfirmDisconnect(false);
                  }}
                  className="harbor-press-pop flex h-9 items-center gap-1.5 rounded-md bg-danger/15 px-4 text-[12.5px] font-semibold text-danger transition-colors hover:bg-danger/25"
                >
                  <LogOut size={12} strokeWidth={2.4} />
                  {t("Disconnect")}
                </button>
              </>
            }
          >
            <p className="rounded-md bg-elevated px-4 py-3.5 text-[13px] leading-relaxed text-ink-muted">
              {t("Disconnect AniList? Your lists will stop showing on the Anime page until you reconnect.")}
            </p>
          </SettingsModal>
        </Section>
      )}

      {isConnected && <SyncIndicatorSetting />}

      {modalOpen && <AnilistConnectModal onClose={() => setModalOpen(false)} />}
    </>
  );
}

function sessionAge(t: (key: string, vars?: Record<string, string | number>) => string, createdAt?: number): string {
  if (!createdAt) return "";
  const days = Math.floor((Date.now() - createdAt) / 86400000);
  if (days < 1) return t("today");
  if (days < 30) return days === 1 ? t("{n} day ago", { n: days }) : t("{n} days ago", { n: days });
  const months = Math.floor(days / 30);
  return months === 1 ? t("{n} month ago", { n: months }) : t("{n} months ago", { n: months });
}
