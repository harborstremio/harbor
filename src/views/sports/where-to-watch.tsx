import { ExternalLink, Tv } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { SportsGame } from "@/lib/sports/espn";
import { watchProviders, type WatchProvider } from "@/lib/sports/watch-providers";

function ProviderLogo({ provider }: { provider: WatchProvider }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="sh-provider-logo" aria-hidden="true">
      {failed ? (
        <Tv size={22} />
      ) : (
        <img
          src={provider.logo}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
export function WhereToWatch({ game }: { game: SportsGame }) {
  const t = useT();
  const providers = watchProviders(game);
  return (
    <section className="sh-where-watch">
      <h3>{t("Where to watch")}</h3>
      {!!providers.length && (
        <div className="sh-provider-links">
          {providers.map((provider) => (
            <button key={provider.id} onClick={() => openUrl(provider.url)}>
              <ProviderLogo provider={provider} />
              <span>
                <strong>{provider.name}</strong>
                <small>
                  {t(provider.listed ? "Listed broadcaster" : "Check event availability")}
                </small>
              </span>
              <ExternalLink size={16} />
            </button>
          ))}
        </div>
      )}
      {game.league === "UFC" && (
        <button className="sh-text-button" onClick={() => openUrl("https://www.ufc.com/watch")}>
          {t("Official UFC watch guide")} <ExternalLink size={13} />
        </button>
      )}
      {!providers.length && (
        <p>
          {t(
            "No broadcaster was listed for this event. Check the competition’s official schedule for coverage in your region.",
          )}
        </p>
      )}
      {game.league === "F1" && (
        <button
          className="sh-text-button"
          onClick={() =>
            openUrl(
              "https://www.formula1.com/en/information/f1-broadcast-information.45y3LNsT1D6VoK0ZmX8ciJ",
            )
          }
        >
          {t("Find your country's F1 broadcaster")} <ExternalLink size={13} />
        </button>
      )}
      <p>
        {t(
          "Subscriptions, pay-per-view and regional availability are set by each provider. Check that the event is included before purchasing.",
        )}
      </p>
      <p className="sh-authorized-note">
        {t(
          "Use streams, M3U playlists and Xtream accounts you are authorized to access. Harbor does not provide subscriptions or bypass paywalls, DRM or access restrictions.",
        )}
      </p>
    </section>
  );
}
