import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useActiveKid } from "@/lib/profiles";
import { useT, useUiLanguage } from "@/lib/i18n";
import { safeFetch } from "@/lib/safe-fetch";
import { openUrl } from "@/lib/window";
import { useInViewport, usePageVisible } from "@/lib/visibility";
import type { SportsGame } from "@/lib/sports/espn";
import { parseMarketOdds, type MarketOdds } from "@/lib/sports/market-odds";
import { PolymarketLogo } from "./polymarket-logo";
const cache = new Map<string, { at: number; markets: MarketOdds[] }>();
export function EventOdds({ game }: { game: SportsGame }) {
  const { settings } = useSettings();
  const kid = useActiveKid();
  return settings.sportsShowOdds && !kid ? <VisibleOdds game={game} /> : null;
}
function VisibleOdds({ game }: { game: SportsGame }) {
  const t = useT();
  const locale = useUiLanguage();
  const { update } = useSettings();
  const root = useRef<HTMLElement>(null);
  const visible = useInViewport(root, false);
  const pageVisible = usePageVisible();
  const key = `${game.league}:${game.id}:${game.startMs}`;
  const [result, setResult] = useState<{
    key: string;
    at: number;
    markets: MarketOdds[];
    failed: boolean;
  } | null>(null);
  useEffect(() => {
    if (!visible || !pageVisible) return;
    const controller = new AbortController();
    let busy = false;
    const run = async () => {
      if (busy) return;
      busy = true;
      try {
        let entry = cache.get(key);
        if (!entry || Date.now() - entry.at > 60000) {
          const query = new URLSearchParams({
            q: `${game.home.name} ${game.away.name}`,
            limit_per_type: "5",
            events_status: "active",
            search_tags: "false",
            search_profiles: "false",
          });
          const response = await safeFetch(
            `https://gamma-api.polymarket.com/public-search?${query}`,
            {
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(7000)]),
            },
          );
          if (!response.ok) throw new Error("Market feed unavailable");
          entry = {
            at: Date.now(),
            markets: parseMarketOdds(await response.json(), game),
          };
          cache.set(key, entry);
          while (cache.size > 40) cache.delete(cache.keys().next().value!);
        }
        if (!controller.signal.aborted) setResult({ key, ...entry, failed: false });
      } catch {
        if (!controller.signal.aborted) setResult({ key, at: 0, markets: [], failed: true });
      } finally {
        busy = false;
      }
    };
    void run();
    const timer = setInterval(() => void run(), 60000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [key, visible, pageVisible]);
  const current = result?.key === key ? result : null;
  return (
    <section ref={root} className="sh-market-odds">
      <header>
        <strong>
          {t("Market odds")}
          <PolymarketLogo />
        </strong>
        <button
          className="sh-icon"
          aria-label={t("Hide odds")}
          onClick={() => update({ sportsShowOdds: false })}
        >
          <X size={16} />
        </button>
      </header>
      {!current || current.failed || !current.markets.length ? (
        <p role="status">
          {t(
            !current
              ? "Loading market odds…"
              : current.failed
                ? "Market data is unavailable right now."
                : "No matching market is available.",
          )}
        </p>
      ) : (
        <>
          {current.markets.map((market) => {
            // Compare the displayed precision so visually equal prices stay neutral.
            const prices = market.outcomes.map((outcome) => Math.round(outcome.probability * 1000));
            const highest = Math.max(...prices);
            const lowest = Math.min(...prices);
            const higher =
              prices.filter((price) => price === highest).length === 1 ? highest : null;
            const lower = prices.filter((price) => price === lowest).length === 1 ? lowest : null;
            return (
              <div className="sh-market-row" key={market.url}>
                <span>{market.question}</span>
                <div>
                  {market.outcomes.map((outcome, index) => (
                    <span
                      className="sh-market-price"
                      data-probability={
                        prices[index] === higher
                          ? "higher"
                          : prices[index] === lower
                            ? "lower"
                            : "neutral"
                      }
                      key={outcome.name}
                    >
                      <small>{outcome.name}</small>
                      <b>
                        {(outcome.probability * 100).toLocaleString(locale, {
                          maximumFractionDigits: 1,
                        })}
                        %
                      </b>
                    </span>
                  ))}
                </div>
                <button className="sh-text-button" onClick={() => openUrl(market.url)}>
                  {t("View market")}
                  <ExternalLink size={14} />
                </button>
              </div>
            );
          })}
          <small>
            {t("Fetched {time}", {
              time: new Date(current.at).toLocaleTimeString(locale, {
                hour: "numeric",
                minute: "2-digit",
              }),
            })}
          </small>
        </>
      )}
      <p>{t("Market-implied probabilities. Prices can change; this is not a prediction.")}</p>
    </section>
  );
}
