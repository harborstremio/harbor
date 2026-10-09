import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { useView } from "@/lib/view";
import {
  acceptSportsConsent,
  declineSportsConsent,
  getSportsConsentSnapshot,
  getSportsConsentServerSnapshot,
  subscribeSportsConsent,
} from "@/lib/sports/consent";
import {
  SPORTS_POLICY_LINKS,
  SPORTS_USAGE_DETAILS,
  SPORTS_USAGE_SECTIONS,
  SPORTS_USAGE_SUMMARY,
} from "@/lib/sports/usage-notice";
import espnLogo from "@/assets/service-logos/espn.png";
import sportsDbLogo from "@/assets/service-logos/thesportsdb.png";
import elfHostedLogo from "@/assets/elfhosted.svg";
import youtubeLogo from "@/assets/service-logos/youtube.ico";
import "./access-gate.css";

const POLICY_LOGOS = {
  espn: espnLogo,
  sportsdb: sportsDbLogo,
  youtube: youtubeLogo,
  elfhosted: elfHostedLogo,
};

export function useSportsConsent() {
  return useSyncExternalStore(
    subscribeSportsConsent,
    getSportsConsentSnapshot,
    getSportsConsentServerSnapshot,
  );
}

export function SportsUsageDetails() {
  const t = useT();
  return (
    <details className="sports-usage-details">
      <summary>{t("Services, privacy and source policies")}</summary>
      {SPORTS_USAGE_DETAILS.map((text) => (
        <p key={text}>{t(text)}</p>
      ))}
      <div className="sports-policy-links">
        {SPORTS_POLICY_LINKS.map((link) => (
          <button type="button" key={link.url} onClick={() => void openUrl(link.url)}>
            <span className="sports-policy-logo">
              <img src={POLICY_LOGOS[link.service]} alt="" draggable={false} />
            </span>
            {t(link.label)} <ExternalLink size={13} aria-hidden="true" />
          </button>
        ))}
      </div>
    </details>
  );
}

/** Children never mount until the user acknowledges the current notice. */
export function SportsAccessGate({
  active = true,
  children,
}: {
  active?: boolean;
  children: ReactNode;
}) {
  const consent = useSportsConsent();
  if (consent.status === "accepted") return <>{children}</>;
  if (!active || consent.status === "declined") return null;
  return <SportsConsentPrompt />;
}

function SportsConsentPrompt() {
  const t = useT();
  const { setView } = useView();
  const [checked, setChecked] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  return (
    <main className="sports-access-page" aria-labelledby="sports-access-title">
      <form
        className="sports-access-notice"
        onSubmit={(event) => {
          event.preventDefault();
          if (checked) acceptSportsConsent();
        }}
      >
        <h1 id="sports-access-title" ref={heading} tabIndex={-1}>
          {t("Before you open Sports")}
        </h1>
        <p className="sports-access-intro">{t(SPORTS_USAGE_SUMMARY)}</p>
        <div className="sports-access-sections">
          {SPORTS_USAGE_SECTIONS.map((section) => (
            <section key={section.title}>
              <h2>{t(section.title)}</h2>
              <p>{t(section.text)}</p>
            </section>
          ))}
        </div>
        <SportsUsageDetails />
        <label className="sports-access-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <span>
            {t(
              "I understand this notice and agree to use Sports only with sources and content I have permission to access.",
            )}
          </span>
        </label>
        <div className="sports-access-actions">
          <button
            type="button"
            onClick={() => {
              declineSportsConsent();
              setView("live");
            }}
          >
            {t("Decline and hide Sports")}
          </button>
          <button type="submit" className="sports-access-accept" disabled={!checked}>
            {t("Agree and open Sports")}
          </button>
        </div>
        <p className="sports-access-footnote">
          {t(
            "This choice applies to this device. You can hide Sports or show this notice again in Settings.",
          )}
        </p>
      </form>
    </main>
  );
}
