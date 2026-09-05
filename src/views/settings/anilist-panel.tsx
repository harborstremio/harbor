import { ExternalLink, Link2, LogOut } from "lucide-react";
import { useState } from "react";
import { AnilistConnectModal } from "@/components/anilist/anilist-connect-modal";
import { useAnilist } from "@/lib/anilist/provider";
import { useSettings } from "@/lib/settings";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { ROW_DESC, Section, ToggleRow } from "./shared";
import anilistLogo from "@/assets/anilist.png";
import {
  ModalButton,
  ROW_ACTION,
  ROW_ACTION_DANGER,
  ROW_ACTION_PRIMARY,
  SettingGroup,
  SettingRow,
  SettingsModal,
} from "./kit";
import { TrackerIdentity } from "./tracker-identity";
import { SyncIndicatorSetting } from "./sync-indicator-setting";

export function AnilistPanel() {
  const t = useT();
  const { isConnected, userName, disconnect, session, avatar } = useAnilist();
  const { settings, update } = useSettings();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const commentsOn = settings.showAnilistComments === true;

  return (
    <>
      {!isConnected ? (
        <Section
          title={t("Connect your AniList account")}
          subtitle={t("Show your AniList lists as rails on the Anime page, keep your watch progress in sync as you finish episodes, and use your AniList avatar as your Harbor photo. Free at anilist.co.")}
        >
          <SettingRow
            label={t("Connect AniList")}
            desc={t("Sign in at anilist.co and authorize Harbor. Your anime lists show up on the Anime page as soon as you are back.")}
          >
            <button type="button" onClick={() => setModalOpen(true)} className={ROW_ACTION_PRIMARY}>
              <Link2 size={18} strokeWidth={2.2} />
              {t("Connect")}
            </button>
          </SettingRow>

          <SettingRow
            label={t("About AniList")}
            desc={t("Opens anilist.co in your browser, where you can read what AniList does and make a free account.")}
          >
            <button
              type="button"
              onClick={() => openUrl("https://anilist.co")}
              className={ROW_ACTION}
            >
              {t("Open anilist.co")}
              <ExternalLink size={18} strokeWidth={2.2} />
            </button>
          </SettingRow>
        </Section>
      ) : (
        <Section
          title={t("Your AniList account")}
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

          <SettingGroup label={t("Tracking what you watch")}>
            <ToggleRow
              label={t("Sync watch progress")}
              sub={t("Finishing an anime episode updates your AniList progress. Forward only: it never lowers a count you already have.")}
              value={settings.anilistAutoSync}
              onChange={(v) => update({ anilistAutoSync: v })}
            />
            <ToggleRow
              label={t("Use my AniList avatar as my Harbor avatar")}
              sub={t("Show your AniList profile picture as your Harbor avatar.")}
              value={settings.useAnilistAvatar}
              onChange={(v) => update({ useAnilistAvatar: v })}
            />
          </SettingGroup>

          <SettingGroup label={t("Comments")}>
            <ToggleRow
              label={t("Show AniList comments")}
              sub={t("Show forum threads and comments from AniList on anime detail pages.")}
              value={commentsOn}
              onChange={(v) => update({ showAnilistComments: v })}
            />
            <ToggleRow
              label={t("Blur comments by default")}
              sub={t("Comments on anime pages are blurred until you reveal them, even if they are not tagged as spoilers.")}
              value={!!settings.anilistBlurComments}
              onChange={(on) => update({ anilistBlurComments: on })}
              lockReason={commentsOn ? undefined : t("Turn on AniList comments first.")}
            />
          </SettingGroup>

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
                  className={ROW_ACTION_DANGER}
                >
                  <LogOut size={18} strokeWidth={2.2} />
                  {t("Disconnect")}
                </button>
              </>
            }
          >
            <p className={`max-w-[66ch] ${ROW_DESC}`}>
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
