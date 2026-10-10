import type { LeagueDef } from "@/lib/sports/espn";
import { useState } from "react";
import { leagueLogoSource, LEAGUE_KEY_LOGO_BACKGROUNDS } from "@/lib/sports/league-logo-source";
import { LEAGUE_LOGO_BACKGROUNDS, LEAGUE_LOGO_FALLBACKS } from "@/lib/sports/league-branding";
import "./league-logo.css";

/** Decorative league artwork; the adjacent league name remains the accessible label. */
export function LeagueLogo({
  league,
  size = 28,
  className = "",
}: {
  league: Pick<LeagueDef, "logo" | "group"> & Partial<Pick<LeagueDef, "key" | "tag" | "labelEn">>;
  size?: number;
  className?: string;
}) {
  const source = leagueLogoSource(league);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const image =
    [source, LEAGUE_LOGO_FALLBACKS[source]].find(
      (candidate) => candidate && !failed.has(candidate),
    ) || "";
  const label = league.tag || league.labelEn || league.key || "";
  return (
    <span
      className={`sh-league-emblem ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
      data-logo-canvas={
        image
          ? LEAGUE_LOGO_BACKGROUNDS[image] || LEAGUE_KEY_LOGO_BACKGROUNDS[league.key || ""]
          : undefined
      }
      data-logo-fallback={!image}
    >
      {image ? (
        <img
          src={image}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={() => setFailed((previous) => new Set(previous).add(image))}
        />
      ) : (
        <span
          className="sh-league-name-mark"
          style={{ fontSize: Math.max(8, Math.min(13, size / 4)) }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
