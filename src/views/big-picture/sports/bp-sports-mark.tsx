import { useState } from "react";
import type { LeagueDef, SportsSide } from "@/lib/sports/espn-types";
import { LEAGUE_LOGO_BACKGROUNDS, LEAGUE_LOGO_FALLBACKS } from "@/lib/sports/league-branding";
import { LEAGUE_KEY_LOGO_BACKGROUNDS, leagueLogoSource } from "@/lib/sports/league-logo-source";
import { SportIcon } from "@/views/sports/sport-icon";

export type BpSportsMarkTone = "plate" | "bare";

const BOX = "relative inline-grid shrink-0 place-items-center overflow-hidden";

const IMG =
  "absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity duration-[var(--bp-dur)] ease-[var(--bp-ease)] data-[on=true]:opacity-100 motion-reduce:transition-none";

const TEXT_MARK =
  "px-[0.2em] text-center font-bold uppercase leading-[1.1] tracking-[0.04em] text-ink-subtle [overflow-wrap:anywhere]";

function chain(candidates: (string | undefined)[], failed: ReadonlySet<string>): string {
  for (const candidate of candidates) {
    if (candidate && !failed.has(candidate)) return candidate;
  }
  return "";
}

export function BpSportsMark({
  side,
  fallback,
  sport = "trophy",
  size,
  tone = "plate",
  eager,
}: {
  side: Pick<SportsSide, "logo" | "abbr" | "name">;
  fallback?: string;
  sport?: string;
  size: string;
  tone?: BpSportsMarkTone;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [ready, setReady] = useState("");
  const logo = chain(
    [side.logo, fallback, LEAGUE_LOGO_FALLBACKS[fallback || side.logo || ""]],
    failed,
  );
  const plate = tone === "plate";
  return (
    <span
      aria-hidden
      className={`${BOX} ${plate ? "rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)]" : ""}`}
      style={{ width: size, height: size }}
    >
      {logo ? (
        <img
          key={logo}
          src={logo}
          alt=""
          draggable={false}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          data-on={ready === logo ? "true" : undefined}
          onLoad={() => setReady(logo)}
          onError={() => setFailed((current) => new Set(current).add(logo))}
          className={`${IMG} ${plate ? "p-[11%]" : ""}`}
        />
      ) : (
        <SportIcon name={sport} size={24} className="h-[62%] w-[62%] text-ink-subtle" />
      )}
    </span>
  );
}

export function BpSportsLeagueMark({
  league,
  size,
}: {
  league:
    | (Pick<LeagueDef, "logo" | "group"> & Partial<Pick<LeagueDef, "key" | "tag" | "labelEn">>)
    | undefined;
  size: string;
}) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [ready, setReady] = useState("");
  const source = league ? leagueLogoSource(league) : "";
  const image = chain([source, LEAGUE_LOGO_FALLBACKS[source]], failed);
  const canvas = image
    ? LEAGUE_LOGO_BACKGROUNDS[image] || LEAGUE_KEY_LOGO_BACKGROUNDS[league?.key || ""]
    : undefined;
  const label = league?.tag || league?.key || "";
  return (
    <span
      aria-hidden
      className={`${BOX} rounded-[var(--bp-r-sm)] ${
        canvas === "light"
          ? "bg-[color-mix(in_oklab,var(--color-ink)_90%,transparent)]"
          : canvas === "dark"
            ? "bg-[var(--bp-panel-2)]"
            : ""
      }`}
      style={{ width: size, height: size }}
    >
      {image ? (
        <img
          key={image}
          src={image}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          data-on={ready === image ? "true" : undefined}
          onLoad={() => setReady(image)}
          onError={() => setFailed((current) => new Set(current).add(image))}
          className={`${IMG} ${canvas ? "p-[13%]" : ""}`}
        />
      ) : label ? (
        <span className={TEXT_MARK} style={{ fontSize: `calc(${size} * 0.3)` }}>
          {label}
        </span>
      ) : (
        <SportIcon
          name={league?.group || "trophy"}
          size={24}
          className="h-[74%] w-[74%] text-ink-subtle"
        />
      )}
    </span>
  );
}
