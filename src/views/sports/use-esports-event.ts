import { useEffect, useState } from "react";
import { requestEsportsJson } from "@/lib/sports/esports-feeds";
import {
  LIQUIPEDIA_INLINE_BRACKETS,
  LIQUIPEDIA_TTL,
  LIQUIPEDIA_WIKI,
  liquipediaBrackets,
  liquipediaCredit,
  liquipediaLeague,
  liquipediaWikitext,
  parseLeagueInfobox,
  parsePrizePool,
  type LiquipediaBracket,
  type LiquipediaBracketGap,
  type LiquipediaCredit,
  type LiquipediaLeague,
  type LiquipediaPrizeSlot,
} from "@/lib/sports/esports-liquipedia";
import {
  eventMapArt,
  resolveEventHero,
  type EventHero,
  type EventMapArt,
} from "@/lib/sports/esports-event-media";
import { loadSportsYoutubeVideos, type SportsYoutubeVideo } from "@/lib/sports/youtube-videos";
import type { SeriesDef } from "@/lib/sports/esports-series";
import type { EsportsEventSummary } from "./esports-event-model";

export interface EsportsEventDetail {
  loading: boolean;
  league?: LiquipediaLeague;
  /** Present only when Liquipedia actually answered: the credit it carries is contractual. */
  credit?: LiquipediaCredit;
  prizes: LiquipediaPrizeSlot[];
  /** Ready brackets only. An empty list with a gap code must never draw a tree. */
  brackets: LiquipediaBracket[];
  bracketGap?: LiquipediaBracketGap;
  hero?: EventHero;
  videos: SportsYoutubeVideo[];
  maps: EventMapArt[];
}

const EMPTY: EsportsEventDetail = {
  loading: true,
  prizes: [],
  brackets: [],
  videos: [],
  maps: [],
};
const MEDIA_TTL = 6 * 60 * 60 * 1000;

/**
 * A page name cannot be discovered keylessly, so it is guessed from the series template and the
 * event's own name. A miss is not cached by the wikitext reader, so misses are remembered here:
 * the published limit is one request per two seconds and the ban for ignoring it is automatic.
 */
const missing = new Set<string>();

function pageCandidates(event: EsportsEventSummary, series?: SeriesDef): string[] {
  const year = /\b(20\d{2})\b/.exec(event.name)?.[1];
  const pages = series?.liquipediaPage
    ? [series.liquipediaPage.replace("{edition}", year ?? "")]
    : [];
  pages.push(event.name);
  return [...new Set(pages.map((page) => page.trim()))]
    .filter((page) => page.length > 2 && !page.endsWith("/"))
    .slice(0, 2);
}

function liquipediaTtl(status: EsportsEventSummary["status"]): number {
  if (status === "live") return LIQUIPEDIA_TTL.live;
  return status === "completed" ? LIQUIPEDIA_TTL.settled : LIQUIPEDIA_TTL.running;
}

/**
 * One event's metadata, media and stage structure. Each stage publishes as it lands, so the page
 * fills in rather than waiting on its slowest source, and every source failing still leaves a page.
 */
export function useEsportsEventDetail(
  event: EsportsEventSummary,
  series?: SeriesDef,
): EsportsEventDetail {
  const [detail, setDetail] = useState<EsportsEventDetail>(EMPTY);
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const wiki = LIQUIPEDIA_WIKI[event.game];
    const options = { signal, ttlMs: liquipediaTtl(event.status) };
    // Three of the five wikis moved their match rows into LPDB, so the absence is known about the
    // title before anything is fetched and the page can say so from the first paint.
    const base: EsportsEventDetail = LIQUIPEDIA_INLINE_BRACKETS.has(wiki)
      ? EMPTY
      : { ...EMPTY, bracketGap: "unsupported-wiki" };
    let state = base;
    const publish = (patch: Partial<EsportsEventDetail>) => {
      if (signal.aborted) return;
      state = { ...state, ...patch };
      setDetail(state);
    };
    setDetail(base);

    const readLiquipedia = async () => {
      for (const page of pageCandidates(event, series)) {
        const key = `${wiki}/${page}`;
        if (missing.has(key)) continue;
        const doc = await liquipediaWikitext(wiki, page, options).catch(() => null);
        const infobox = doc ? parseLeagueInfobox(doc.text, wiki, page) : null;
        if (!doc || !infobox) {
          missing.add(key);
          continue;
        }
        // A cache hit on the text just read, plus the extra read a prize transclusion needs.
        const league = (await liquipediaLeague(wiki, page, options).catch(() => null)) ?? infobox;
        publish({
          league,
          credit: liquipediaCredit(wiki, page),
          prizes: parsePrizePool(doc.text),
          maps: eventMapArt(event.game, league.mapPool),
        });
        const tree = await liquipediaBrackets(wiki, page, options).catch(() => ({
          brackets: [] as LiquipediaBracket[],
          gap: undefined,
        }));
        publish({ brackets: tree.brackets, bracketGap: tree.gap });
        return league;
      }
      return undefined;
    };

    void (async () => {
      const league = await readLiquipedia().catch(() => undefined);
      const read = (url: string) => requestEsportsJson(url, MEDIA_TTL, { signal });
      const hero = await resolveEventHero(
        {
          game: event.game,
          name: event.name,
          venue: league?.venue?.label ?? event.location?.venue,
          city: league?.city ?? event.location?.city,
        },
        read,
      ).catch(() => undefined);
      publish({ hero });
      const videos = await loadSportsYoutubeVideos(
        {
          names: event.teams.slice(0, 4).map((team) => team.name),
          league: event.game,
          eventTitle: event.name,
          eventStartMs: event.startMs,
        },
        signal,
      ).catch(() => []);
      publish({ videos, loading: false });
    })();
    return () => controller.abort();
  }, [event, series]);
  return detail;
}
