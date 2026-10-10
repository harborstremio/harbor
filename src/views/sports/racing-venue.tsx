import { useState } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { racingVenue } from "@/lib/sports/racing-venues";
import type { SportsGame } from "@/lib/sports/espn-types";
import "./nascar-hub.css";

export function RacingVenue({
  game,
  trackName,
  trackId,
}: {
  game: SportsGame;
  trackName?: string;
  trackId?: string;
}) {
  const t = useT();
  const venue = racingVenue({
    ...game,
    name: game.context?.name || game.home.name,
    venue: trackName || game.context?.venue,
    trackId,
  });
  const [view, setView] = useState<"map" | "photo">("map");
  const [failed, setFailed] = useState<string[]>([]);
  if (!venue) return null;
  const map = venue.map && !failed.includes(venue.map) ? venue.map : undefined;
  const photo = venue.photo && !failed.includes(venue.photo) ? venue.photo : undefined;
  const image = view === "map" ? map || photo : photo || map;
  const isMap = image === map && !!map;
  return (
    <section className="sh-racing-venue" data-source={venue.sourceName}>
      {image && (
        <div className={`sh-racing-venue-media${isMap ? " is-map" : ""}`}>
          <button
            className="sh-racing-venue-image"
            aria-label={t("Open full-size image")}
            onClick={() => openUrl(image)}
          >
            <img
              key={image}
              src={image}
              alt={`${venue.name} · ${t(isMap ? "Circuit map" : "Venue photo")}`}
              decoding="async"
              loading="lazy"
              onError={() => setFailed((previous) => [...previous, image])}
            />
          </button>
          {map && photo && (
            <div className="sh-racing-venue-options">
              <button aria-pressed={isMap} onClick={() => setView("map")}>
                {t("Circuit map")}
              </button>
              <button aria-pressed={!isMap} onClick={() => setView("photo")}>
                {t("Venue photo")}
              </button>
            </div>
          )}
        </div>
      )}
      <div className="sh-racing-venue-caption">
        {venue.logo && !failed.includes(venue.logo) ? (
          <img
            src={venue.logo}
            alt=""
            className="h-12 w-16 object-contain"
            loading="lazy"
            onError={() => setFailed((previous) => [...previous, venue.logo!])}
          />
        ) : (
          <MapPin size={22} aria-hidden="true" />
        )}
        <div>
          <h3>{venue.name}</h3>
          <p>
            {[
              venue.location,
              venue.length,
              t(
                venue.layout === "oval"
                  ? "Oval"
                  : venue.layout === "street"
                    ? "Street circuit"
                    : "Road course",
              ),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {isMap && <p>{t("Circuit map · not live car positions")}</p>}
        </div>
        <div className="sh-racing-venue-actions">
          <button
            className="sh-text-button"
            onClick={() =>
              openUrl((isMap ? venue.mapSourceUrl : venue.photoSourceUrl) || venue.sourceUrl)
            }
          >
            {venue.sourceName}
            <ArrowUpRight size={13} />
          </button>
          {venue.website && (
            <button className="sh-text-button" onClick={() => openUrl(venue.website!)}>
              {t("Venue website")}
              <ArrowUpRight size={13} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
