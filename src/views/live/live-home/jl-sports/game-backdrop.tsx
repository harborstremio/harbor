import { useState, type CSSProperties } from "react";
import { stableIndex, type TeamArt } from "@/lib/jl/sports/fanart";
import { teamLook, type TeamLook } from "@/lib/jl/sports/team-look";
import type { SportsGame, SportsSide } from "@/lib/sports/espn";
import { curatedTeamArt, useGameArt, useTeamArt } from "./use-sports-extras";

/**
 * Art behind Sports Hub games and teams. A real photo when TheSportsDB has one (the viewer's
 * key: fan art, then the stadium, then the banner); otherwise a designed backdrop from ESPN's own
 * assets: the teams' colours as a gradient, a light texture and the logos large and tilted, so no
 * slide or card is ever a plain box. Colours are mixed into the theme's canvas so text in the
 * theme's ink stays readable on every theme.
 */

export type BackdropVariant = "hero" | "poster" | "card";
type Variant = BackdropVariant;

/** A team colour pulled toward the theme's canvas. */
export function tint(hex: string, percent: number): string {
  return `color-mix(in oklch, #${hex} ${percent}%, var(--color-canvas))`;
}

const TEXTURE: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, color-mix(in oklch, var(--color-ink) 5%, transparent) 0 2px, transparent 2px 14px), radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--color-ink) 7%, transparent) 1px, transparent 1.5px)",
  backgroundSize: "auto, 6px 6px",
};

/** A team's logo, trying each source in turn, then a monogram on the team colour. */
export function TeamMark({
  look,
  className,
  textClass = "text-[18px]",
  style,
}: {
  look: TeamLook;
  className: string;
  textClass?: string;
  style?: CSSProperties;
}) {
  const listKey = look.logos.join("|");
  const [failed, setFailed] = useState({ key: listKey, n: 0 });
  const n = failed.key === listKey ? failed.n : 0;
  const src = look.logos[n];
  if (src) {
    return (
      <img
        key={src}
        src={src}
        alt=""
        draggable={false}
        loading="lazy"
        onError={() => setFailed({ key: listKey, n: n + 1 })}
        style={style}
        className={`${className} object-contain drop-shadow-[0_8px_22px_rgba(0,0,0,0.45)]`}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        ...style,
        background: `linear-gradient(145deg, #${look.primary}, #${look.secondary})`,
      }}
      className={`${className} jl-sports-display flex items-center justify-center rounded-full font-black text-white ring-2 ring-white/20 ${textClass}`}
    >
      {look.monogram}
    </span>
  );
}

function Photo({ src, variant }: { src: string; variant: Variant }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return null;
  return (
    <img
      key={src}
      src={src}
      alt=""
      draggable={false}
      loading={variant === "hero" ? "eager" : "lazy"}
      onError={() => setFailed(src)}
      className={`animate-fade-in absolute inset-0 h-full w-full object-cover ${
        variant === "hero" ? "jl-kenburns opacity-90" : "opacity-75"
      }`}
    />
  );
}

/** The designed layer: colour gradient, texture and big tilted logos. */
function Designed({
  looks,
  variant,
  marks,
}: {
  looks: TeamLook[];
  variant: Variant;
  marks: boolean;
}) {
  const [a, b] = looks;
  const main = b ?? a;
  // The hero's text sits at the start, so its colour glows behind the logos at the far side.
  const background = b
    ? variant === "hero"
      ? `radial-gradient(55% 85% at 66% 48%, ${tint(a.primary, 85)} 0%, transparent 70%), radial-gradient(55% 85% at 90% 52%, ${tint(b.primary, 90)} 0%, transparent 70%), linear-gradient(90deg, var(--color-canvas) 20%, ${tint(b.secondary, 25)} 100%)`
      : `linear-gradient(115deg, ${tint(a.primary, 78)} 0%, ${tint(a.secondary, 30)} 32%, var(--color-canvas) 50%, ${tint(b.secondary, 30)} 68%, ${tint(b.primary, 78)} 100%)`
    : `radial-gradient(120% 95% at 78% 42%, ${tint(a.primary, 92)} 0%, ${tint(a.primary, 55)} 38%, ${tint(a.secondary, 22)} 62%, var(--color-canvas) 88%)`;
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden" style={{ background }}>
      <div className="absolute inset-0 opacity-70" style={TEXTURE} />
      {/* A giant, blurred, tilted mark fills the space like a painted wall. */}
      <TeamMark
        look={main}
        className={`absolute top-1/2 -translate-y-1/2 opacity-30 blur-[3px] ${
          variant === "hero"
            ? "end-[-6%] h-[140%] w-[70%] -rotate-12"
            : variant === "poster"
              ? "start-[10%] h-[120%] w-[120%] -rotate-12"
              : "end-[-8%] h-[170%] w-[60%] -rotate-12"
        }`}
        textClass="text-[18vh]"
      />
      {variant === "card" && b && (
        <TeamMark
          look={a}
          className="absolute start-[-8%] top-1/2 h-[170%] w-[60%] -translate-y-1/2 rotate-12 opacity-25 blur-[3px]"
          textClass="text-[12vh]"
        />
      )}
      {variant === "hero" && marks && (
        <div className="absolute inset-y-0 end-[5%] flex items-center gap-[3vw]">
          {looks.map((look, i) => (
            <TeamMark
              key={i}
              look={look}
              className="h-[34vh] max-h-[360px] w-[34vh] max-w-[26vw]"
              textClass="text-[9vh]"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Veils({ variant }: { variant: Variant }) {
  if (variant === "hero") {
    return (
      <>
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/55 to-transparent rtl:bg-gradient-to-l" />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/10 to-canvas/45" />
      </>
    );
  }
  if (variant === "poster") {
    return (
      <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/55 to-canvas/25" />
    );
  }
  return <div className="absolute inset-0 bg-canvas/30" />;
}

function ArtLayers({
  photo,
  looks,
  variant,
  marks = true,
}: {
  photo: string | null;
  looks: TeamLook[];
  variant: Variant;
  marks?: boolean;
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Designed looks={looks} variant={variant} marks={marks} />
      {photo && <Photo src={photo} variant={variant} />}
      <Veils variant={variant} />
    </div>
  );
}

/** Away then home, with TheSportsDB's colours and badges filling ESPN's gaps. */
export function gameLooks(
  game: SportsGame,
  home: TeamArt | null,
  away: TeamArt | null,
): [TeamLook, TeamLook] {
  return [teamLook(game.away, away), teamLook(game.home, home)];
}

export function GameBackdrop({
  game,
  variant = "card",
  marks = true,
}: {
  game: SportsGame;
  variant?: Variant;
  /** The hero's big logos on the right; off where a headshot takes that place. */
  marks?: boolean;
}) {
  const art = useGameArt(game);
  return (
    <ArtLayers
      photo={art.photo}
      looks={gameLooks(game, art.home, art.away)}
      variant={variant}
      marks={marks}
    />
  );
}

/** One team's backdrop (followed-team hero slides). */
export function TeamBackdrop({
  league,
  side,
  variant = "hero",
}: {
  league: string;
  side: SportsSide;
  variant?: Variant;
}) {
  const art = useTeamArt(league, side);
  const photo =
    curatedTeamArt(league, side) ??
    (art?.fanart.length
      ? art.fanart[stableIndex(side.id ?? side.name, art.fanart.length)]
      : (art?.stadium ?? art?.banner ?? null));
  return <ArtLayers photo={photo} looks={[teamLook(side, art)]} variant={variant} />;
}
