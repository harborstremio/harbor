import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import type { SportsGame } from "@/lib/sports/espn-types";
import {
  loadCompetitionMetadata,
  readCompetitionMetadata,
  type CompetitionMetadata,
} from "@/lib/sports/competition-metadata";
import { hubLeague, sportsJson } from "@/lib/sports/hub-data";
import { racingVenue } from "@/lib/sports/racing-venues";
import { openUrl } from "@/lib/window";
import { useBpT } from "../bp-i18n";
import {
  BP_SPORTS_NOTE,
  BP_SPORTS_TIP,
  BP_SPORTS_VALUE,
  BpSportsPanelCell,
} from "./bp-sports-extra-kit";

const WIDE = "clamp(320px,34vw,660px)";

type VenueView = {
  name: string;
  location: string;
  image: string;
  url: string;
  facts: string[];
};

function useCompetitionVenue(game: SportsGame): CompetitionMetadata["venue"] | undefined {
  const def = hubLeague(game.league);
  const key = `${game.league}:${game.id}:${game.startMs}`;
  const [state, setState] = useState<{ key: string; venue: CompetitionMetadata["venue"] } | null>(
    () => {
      const seen = def ? readCompetitionMetadata(game, def) : undefined;
      return seen ? { key, venue: seen.venue } : null;
    },
  );

  useEffect(() => {
    if (!def) return;
    const controller = new AbortController();
    void loadCompetitionMetadata(game, def, controller.signal, sportsJson)
      .then((result) => {
        if (!controller.signal.aborted) setState({ key, venue: result.venue });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [key, def, game]);

  return state?.key === key ? state.venue : undefined;
}

export function useBpSportsVenue(game: SportsGame): VenueView | null {
  const t = useBpT();
  const competition = useCompetitionVenue(game);
  const track = useMemo(
    () =>
      racingVenue({
        league: game.league,
        name: game.context?.name || game.home.name,
        venue: game.context?.venue,
        context: game.context,
        startMs: game.startMs,
      }),
    [game],
  );

  return useMemo(() => {
    const name = track?.name || competition?.name || game.context?.venue || "";
    if (!name) return null;
    const facts: string[] = [];
    if (track?.length) facts.push(t("Length {value}", { value: track.length }));
    if (track?.turns) facts.push(t("{n} turns", { n: track.turns }));
    if (track?.layout) {
      facts.push(
        t(
          track.layout === "oval"
            ? "Oval circuit"
            : track.layout === "street"
              ? "Street circuit"
              : "Road circuit",
        ),
      );
    }
    return {
      name,
      location: track?.location || competition?.location || "",
      image: track?.map || track?.photo || competition?.image || "",
      url: track?.website || track?.sourceUrl || competition?.website || "",
      facts,
    };
  }, [track, competition, game.context?.venue, t]);
}

export function BpSportsVenueCell({ view }: { view: VenueView }) {
  const t = useBpT();
  const [broken, setBroken] = useState(false);
  const art = view.image && !broken ? view.image : "";

  return (
    <BpSportsPanelCell
      restoreKey="sports-venue"
      width={WIDE}
      padded={Boolean(!art)}
      onPress={() => {
        if (view.url) openUrl(view.url);
      }}
    >
      {art ? (
        <span className="relative block w-full overflow-hidden [aspect-ratio:16/9]">
          <img
            src={art}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
          />
          <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,var(--bp-void)_4%,transparent_62%)]" />
        </span>
      ) : null}
      <span
        className={`flex w-full flex-col gap-[clamp(5px,0.6vh,10px)] ${
          art ? "p-[clamp(16px,1.5vw,30px)]" : ""
        }`}
      >
        <span className={`${BP_SPORTS_TIP} flex items-center gap-[0.5em]`}>
          <MapPin className="h-[1.05em] w-[1.05em] shrink-0" />
          {t("Venue")}
        </span>
        <span className={`${BP_SPORTS_VALUE} line-clamp-2`}>{view.name}</span>
        {view.location ? (
          <span className={`${BP_SPORTS_NOTE} truncate`}>{view.location}</span>
        ) : null}
        {view.facts.length > 0 ? (
          <span className={`${BP_SPORTS_NOTE} truncate`}>{view.facts.join(" · ")}</span>
        ) : null}
        <span className={BP_SPORTS_NOTE}>
          {view.url ? t("Open venue page") : t("No venue page published")}
        </span>
      </span>
    </BpSportsPanelCell>
  );
}
