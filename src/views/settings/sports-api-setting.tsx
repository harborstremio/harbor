import { useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n";
import { readSportsApiKey, saveSportsApiKey } from "@/lib/sports/api-credentials";
import {
  API_SPORTS_LEAGUES,
  getApiSportsStatus,
  invalidateApiSportsCredentials,
  subscribeApiSportsStatus,
} from "@/lib/sports/providers/api-sports";
import { getLeagueLabel } from "@/lib/sports/espn-leagues";
import { ExtLink, KeyField, Section } from "./shared";
import { ROW_ACTION } from "./kit";
import apiSportsLogo from "@/assets/service-logos/apisports.png";

const ACCOUNT_NOTICES: Record<string, string> = {
  "invalid-key": "API-Sports rejected this key. Check it in your API-Sports dashboard.",
  quota: "Your API-Sports request allowance is exhausted. Public feeds remain available.",
  "rate-limit": "API-Sports is limiting requests. Harbor will retry after the waiting period.",
  unavailable: "API-Sports is unavailable right now. Public feeds remain available.",
};
const readAccountNotices = () =>
  [...new Set([getApiSportsStatus("football").code, getApiSportsStatus("hockey").code])]
    .filter((code) => ACCOUNT_NOTICES[code])
    .join(",");

export function SportsApiSetting() {
  const t = useT();
  const [draft, setDraft] = useState(readSportsApiKey);
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const accountNotices = useSyncExternalStore(
    subscribeApiSportsStatus,
    readAccountNotices,
    () => "",
  );
  const save = (value: string) => {
    try {
      saveSportsApiKey(value.trim());
      invalidateApiSportsCredentials();
      setSaved(true);
    } catch {
      setSaveFailed(true);
      setSaved(false);
      setDraft(readSportsApiKey());
    }
  };

  return (
    <Section
      title={t("Sports metadata")}
      subtitle={t(
        "Optional schedules and scores for selected {football} and hockey competitions. Your API-Sports plan and request limits apply.",
        { football: t("Soccer") },
      )}
    >
      <p className="mb-3 text-[14px] leading-5 text-ink-muted">
        {API_SPORTS_LEAGUES.filter((league) => ["EGY", "QSL", "UAE", "KHL"].includes(league.key))
          .map(getLeagueLabel)
          .join(" · ")}
      </p>
      <KeyField
        label={t("API-Sports key")}
        iconSrc={apiSportsLogo}
        placeholder={t("Paste your API-Sports key")}
        value={draft}
        onChange={(value) => {
          setDraft(value);
          setSaved(false);
          setSaveFailed(false);
        }}
        onSave={() => save(draft)}
        saved={saved}
        headerExtra={
          draft.trim() ? (
            <button
              type="button"
              className={ROW_ACTION}
              onClick={() => {
                setDraft("");
                save("");
              }}
            >
              {t("Clear key")}
            </button>
          ) : undefined
        }
        help={
          <>
            {t(
              "Saving does not verify your key. Sports uses it when loading supported competitions.",
            )}{" "}
            <ExtLink href="https://dashboard.api-sports.io/">{t("API-Sports dashboard")}</ExtLink>
          </>
        }
      />
      {saveFailed && (
        <p role="alert" className="mt-2 text-[14px] leading-5 text-danger">
          {t("The key could not be saved. Your previous key is unchanged.")}
        </p>
      )}
      {accountNotices && (
        <div role="status" className="mt-2 space-y-1 text-[14px] leading-5 text-ink-muted">
          {accountNotices.split(",").map((code) => (
            <p key={code}>{t(ACCOUNT_NOTICES[code])}</p>
          ))}
        </div>
      )}
    </Section>
  );
}
