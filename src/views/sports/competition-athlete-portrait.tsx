import { useRef, useState } from "react";
import { UserRound } from "lucide-react";
import type { AthleteIdentityRequest } from "@/lib/sports/athlete-identity";
import { hubLeague } from "@/lib/sports/hub-data";
import { useInViewport } from "@/lib/visibility";
import { useAthletePortrait } from "./use-athlete-portrait";

export function CompetitionAthletePortrait({
  name,
  athlete,
  league,
  group,
  publishedImage,
}: {
  name: string;
  athlete?: AthleteIdentityRequest;
  league: string;
  group: string;
  /** Portrait already attributed to this person by an official provider parser. */
  publishedImage?: string;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const visible = useInViewport(root);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const primary = publishedImage && !broken.has(publishedImage) ? publishedImage : "";
  const portrait = useAthletePortrait(
    {
      path: hubLeague(league)?.path ?? "",
      group,
      // A result-row or SportsDB ID cannot be used as an ESPN athlete ID.
      id: athlete?.source === "espn" ? athlete.id : "",
      name,
      image: athlete?.image && !broken.has(athlete.image) ? athlete.image : "",
    },
    visible && !primary,
  );
  const image = primary || (portrait.image && !broken.has(portrait.image) ? portrait.image : "");

  return (
    <span ref={root} className="sh-competition-portrait" aria-hidden="true">
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken((prior) => new Set(prior).add(image))}
        />
      ) : (
        <UserRound size={22} strokeWidth={1.5} />
      )}
    </span>
  );
}
