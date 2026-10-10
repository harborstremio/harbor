import { useEffect, useState, type ReactNode } from "react";
import { useUiLanguage } from "@/lib/i18n";
import { useActiveKid } from "@/lib/profiles";
import { safeFetch } from "@/lib/safe-fetch";
import { useSettings } from "@/lib/settings";
import { parseMarketOdds, type MarketOdds } from "@/lib/sports/market-odds";
import type { SportsGame } from "@/lib/sports/espn-types";
import { openUrl } from "@/lib/window";
import { useBpT } from "../bp-i18n";
import {
  BP_SPORTS_LABEL,
  BP_SPORTS_TIP,
  BP_SPORTS_VALUE,
  BpSportsPanelCell,
} from "./bp-sports-extra-kit";

const CACHE = new Map<string, { at: number; markets: MarketOdds[] }>();

const FRESH_MS = 60000;

const SEARCH = "https://gamma-api.polymarket.com/public-search";

type Odds = { markets: MarketOdds[]; at: number };

export type BpSportsOddsRow = {
  cells: (caption: string) => ReactNode;
  note: string;
  count: number;
};

function keyFor(game: SportsGame): string {
  return `${game.league}:${game.id}:${game.startMs}`;
}

function useOdds(game: SportsGame | null, on: boolean): Odds | null {
  const key = game ? keyFor(game) : "";
  const [state, setState] = useState<{ key: string; value: Odds } | null>(null);

  useEffect(() => {
    if (!on || !game) return;
    const controller = new AbortController();
    let busy = false;
    const run = async () => {
      if (busy) return;
      busy = true;
      try {
        let entry = CACHE.get(key);
        if (!entry || Date.now() - entry.at > FRESH_MS) {
          const query = new URLSearchParams({
            q: `${game.home.name} ${game.away.name}`,
            limit_per_type: "5",
            events_status: "active",
            search_tags: "false",
            search_profiles: "false",
          });
          const response = await safeFetch(`${SEARCH}?${query}`, {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(7000)]),
          });
          if (!response.ok) throw new Error("Market feed unavailable");
          entry = { at: Date.now(), markets: parseMarketOdds(await response.json(), game) };
          CACHE.set(key, entry);
          while (CACHE.size > 40) CACHE.delete(CACHE.keys().next().value!);
        }
        if (!controller.signal.aborted) setState({ key, value: { ...entry } });
      } catch {
        if (!controller.signal.aborted) setState({ key, value: { markets: [], at: 0 } });
      } finally {
        busy = false;
      }
    };
    void run();
    const timer = setInterval(() => void run(), FRESH_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [key, on, game]);

  return key && state?.key === key ? state.value : null;
}

function BpOddsCell({
  market,
  locale,
  caption,
}: {
  market: MarketOdds;
  locale: string;
  caption: string;
}) {
  const t = useBpT();
  const prices = market.outcomes.map((outcome) => Math.round(outcome.probability * 1000));
  const top = Math.max(...prices);
  const lead = prices.filter((price) => price === top).length === 1 ? top : -1;

  return (
    <BpSportsPanelCell
      restoreKey={`sports-odds-${market.url}`}
      width="clamp(320px,30vw,600px)"
      grow="clamp(420px,40vw,900px)"
      onPress={() => openUrl(market.url)}
      foot={t("Open on Polymarket")}
    >
      {caption !== "" && <span className={`${BP_SPORTS_TIP} truncate`}>{caption}</span>}
      <span className={`${BP_SPORTS_VALUE} line-clamp-2`}>{market.question}</span>
      {market.outcomes.map((outcome, index) => (
        <span key={outcome.name} className="flex w-full flex-col gap-[5px]">
          <span className="flex w-full items-baseline justify-between gap-[clamp(10px,1vw,20px)]">
            <span
              className={`${BP_SPORTS_LABEL} min-w-0 truncate ${
                prices[index] === lead ? "text-ink" : ""
              }`}
            >
              {outcome.name}
            </span>
            <span className={`${BP_SPORTS_VALUE} tabular-nums`}>
              {`${(outcome.probability * 100).toLocaleString(locale, {
                maximumFractionDigits: 1,
              })}%`}
            </span>
          </span>
          <span className="flex h-[clamp(5px,0.7vh,10px)] w-full overflow-hidden rounded-full bg-[var(--bp-void)]/60">
            <span
              className="h-full bg-[var(--bp-on)]"
              style={{ width: `${Math.round(outcome.probability * 100)}%` }}
            />
            <span className="h-full flex-1 bg-[var(--bp-edge-2)]" />
          </span>
        </span>
      ))}
    </BpSportsPanelCell>
  );
}

export function useBpSportsOddsRow(game: SportsGame | null): BpSportsOddsRow {
  const t = useBpT();
  const kid = useActiveKid();
  const { settings } = useSettings();
  const locale = useUiLanguage();
  const on = Boolean(settings.sportsShowOdds) && !kid && game !== null && game.state !== "post";
  const odds = useOdds(game, on);
  const markets = on && odds ? odds.markets : [];
  return {
    count: markets.length,
    note:
      markets.length > 0
        ? t("Market-implied probabilities. Prices can change; this is not a prediction.")
        : "",
    cells: (caption: string) =>
      markets.map((market) => (
        <BpOddsCell key={market.url} market={market} locale={locale} caption={caption} />
      )),
  };
}
