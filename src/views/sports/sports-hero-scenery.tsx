import { racingDefaultPhoto } from "@/lib/sports/racing-default-photo";
import { useState } from "react";
import { ESPORTS_GAMES } from "@/lib/sports/esports-catalog";
import { esportsRailGames } from "@/lib/sports/esports-match-rail";
import "./sports-hero-scenery.css";

const PHOTO_SPORTS = new Set([
  "soccer",
  "football",
  "basketball",
  "baseball",
  "hockey",
  "combat",
  "boxing",
  "motorsport",
  "motorcycle",
  "pickleball",
  "tennis",
  "golf",
  "rugby",
  "cricket",
  "aussie",
  "lacrosse",
  "esports",
  "volleyball",
  "handball",
  "badminton",
  "tabletennis",
  "snooker",
  "darts",
  "netball",
  "fieldhockey",
  "cycling",
  "winter",
  "athletics",
  "softball",
]);

/** Bundled photographs keep the hero visible while provider artwork loads or fails. */
export function SportsHeroScenery({
  sport = "soccer",
  league,
  priority = true,
}: {
  sport?: string;
  league?: string;
  priority?: boolean;
}) {
  const photo =
    sport === "motorsport"
      ? racingDefaultPhoto(league)
      : PHOTO_SPORTS.has(sport)
        ? sport
        : "soccer";
  const gameId = sport === "esports" && league ? esportsRailGames([league])?.[0] : undefined;
  const gameArt = gameId ? ESPORTS_GAMES.find((game) => game.id === gameId)?.art : undefined;
  const [failedArt, setFailedArt] = useState("");
  const fallback = `/sports/hero-photos/${photo}.webp?v=${photo === "combat" ? "arena-1" : photo === "basketball" ? "court-1" : photo === "soccer" ? "pitch-1" : ["baseball", "motorsport", "esports"].includes(photo) ? "venue-2" : "surface-1"}`;
  const src = gameArt && failedArt !== gameArt ? gameArt : fallback;
  return (
    <img
      className="sh-hero-scenery"
      data-sport={photo}
      style={{
        objectPosition:
          !gameArt &&
          ![
            "baseball",
            "motorsport",
            "esports",
            "combat",
            "basketball",
            "lacrosse",
            "soccer",
          ].includes(photo)
            ? "right center"
            : undefined,
      }}
      src={src}
      onError={() => {
        if (gameArt) setFailedArt(gameArt);
      }}
      alt=""
      aria-hidden="true"
      width={1280}
      height={720}
      draggable={false}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
