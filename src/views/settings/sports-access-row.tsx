import { useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { useSettings } from "@/lib/settings";
import { hasSportsSource } from "@/lib/sports/enabled";
import { usePlaylists } from "@/lib/iptv/playlists-store";
import {
  declineSportsConsent,
  resetSportsConsent,
  getSportsConsentSnapshot,
  getSportsConsentServerSnapshot,
  subscribeSportsConsent,
} from "@/lib/sports/consent";
import { Section, ToggleRow, ROW_DESC } from "./shared";
import { ROW_ACTION } from "./kit";

export function SportsAccessRow() {
  const t = useT();
  const { setView } = useView();
  const { settings, update } = useSettings();
  const provider = hasSportsSource(usePlaylists());
  const anyway = settings.sportsWithoutProvider === true;
  const available = provider || anyway;
  const consent = useSyncExternalStore(
    subscribeSportsConsent,
    getSportsConsentSnapshot,
    getSportsConsentServerSnapshot,
  );
  return (
    <Section title={t("Sports")}>
      <ToggleRow
        label={t("Show Sports")}
        value={consent.status !== "declined"}
        sub={t(
          "Show Sports in navigation. You must acknowledge the Sports notice before the page loads.",
        )}
        lockReason={
          !available
            ? t("Turn on Sports without a provider, or add a Live TV, M3U or Xtream source.")
            : undefined
        }
        onChange={(value) => {
          if (value) resetSportsConsent();
          else declineSportsConsent();
        }}
      />
      <ToggleRow
        label={t("Show Sports without a TV provider")}
        value={anyway}
        sub={t(
          "Scores, schedules and standings come from public sports data and need no provider. Harbor does not supply streams: watching a game still needs your own Live TV, M3U or Xtream source.",
        )}
        onChange={(value) => update({ sportsWithoutProvider: value })}
      />
      <div className="flex flex-wrap items-center justify-between gap-4 py-3">
        <p className={`max-w-[65ch] ${ROW_DESC}`}>
          {t(
            "Enabling Sports does not accept the notice. Your choice is kept on this device and is not synced to your account.",
          )}
        </p>
        <button
          type="button"
          className={ROW_ACTION}
          disabled={!available}
          onClick={() => {
            resetSportsConsent();
            setView("sports");
          }}
        >
          {t("Review Sports notice")}
        </button>
      </div>
      {!consent.persisted && consent.status !== "unknown" && (
        <p role="status" className={ROW_DESC}>
          {t(
            "Your choice is active for this session but could not be saved. You may be asked again when Harbor restarts.",
          )}
        </p>
      )}
    </Section>
  );
}
