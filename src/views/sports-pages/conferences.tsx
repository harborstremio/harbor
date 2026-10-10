import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useJlSession } from "@/lib/jl/account/client";
import type { SportsPage } from "@/lib/jl/sports/pages";
import { monogram } from "@/lib/jl/sports/team-look";
import { vision, useVisionVersion } from "@/lib/jl/sports/vision";
import { useCfbdVisionLinks } from "@/lib/jl/sports/use-cfbd";
import type { VisionGroup, VisionTeam } from "@/lib/jl/sports/vision-branding";
import { useView } from "@/lib/view";
import { Note, PageShell, Pill, Section, Spinner } from "./espn-page-parts";
import { VisionTemplateCanvas } from "./vision-template";

/** Harbor's league tag for a provider league that has team pages. */
const PAGE_LEAGUE: Record<string, string> = { nfl: "NFL", "college-football": "NCAAF" };

const CHIP =
  "flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[12.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

/**
 * Conferences and teams from JL Vision: pick a conference (or NFL division), then a team, and see
 * it drawn in JL Vision's templates with its verified palette, approved logo and the artwork this
 * viewer may see. Teams linked to a scores provider open their full team page.
 */
export function ConferencesPage({ page }: { page: Extract<SportsPage, { kind: "conferences" }> }) {
  const t = useT();
  const session = useJlSession();
  useVisionVersion();
  useCfbdVisionLinks();
  const groups = vision.groups();
  const status = vision.status();
  const tops = groups.filter((g) => !g.parent);
  const [group, setGroup] = useState<string | null>(page.group ?? null);
  const [teamKey, setTeamKey] = useState<string | null>(page.team ?? null);
  const active = group ?? tops[0]?.slug ?? null;
  const subgroups = active ? children(groups, active) : [];
  const teams = active ? vision.teams(active) : [];
  const selected = (teamKey && vision.team(teamKey)) || null;

  return (
    <PageShell>
      <header className="flex flex-col gap-2">
        <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
          {t("JL Vision")}
        </div>
        <h1 className="text-3xl font-black leading-tight text-ink md:text-4xl">
          {t("Conferences & teams")}
        </h1>
      </header>
      {!session ? (
        <Note>{t("Sign in to your JL account to load team branding from JL Vision.")}</Note>
      ) : status === "loading" && !groups.length ? (
        <Spinner />
      ) : status === "error" && !groups.length ? (
        <Note>{t("JL Vision couldn't be reached. It will try again shortly.")}</Note>
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            <ChipRow
              groups={tops}
              active={active}
              onPick={(slug) => {
                setGroup(slug);
                setTeamKey(null);
              }}
            />
            {subgroups.length > 0 && (
              <ChipRow
                groups={subgroups}
                active={group}
                onPick={(slug) => {
                  setGroup(slug);
                  setTeamKey(null);
                }}
              />
            )}
          </div>
          {selected && <TeamBranding team={selected} />}
          <Section title={t("{n} teams", { n: teams.length })}>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {teams.map((team) => (
                <li key={team.key}>
                  <TeamTile
                    team={team}
                    selected={team.key === teamKey}
                    onPick={() => setTeamKey(team.key)}
                  />
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </PageShell>
  );
}

/** A group's whole subtree below it, nearest first (NFL → AFC, NFC → AFC East, ...). */
function children(groups: VisionGroup[], slug: string): VisionGroup[] {
  const out: VisionGroup[] = [];
  let level = groups.filter((g) => g.parent === slug);
  while (level.length) {
    out.push(...level);
    const ids = new Set(level.map((g) => g.slug));
    level = groups.filter((g) => g.parent && ids.has(g.parent));
  }
  return out;
}

function ChipRow({
  groups,
  active,
  onPick,
}: {
  groups: VisionGroup[];
  active: string | null;
  onPick: (slug: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {groups.map((g) => (
        <button
          key={g.slug}
          onClick={() => onPick(g.slug)}
          aria-pressed={g.slug === active}
          className={`${CHIP} ${
            g.slug === active
              ? "border-accent bg-accent/15 text-ink"
              : "border-edge-soft bg-canvas/40 text-ink-muted hover:border-edge hover:text-ink"
          }`}
        >
          {g.name}
        </button>
      ))}
    </div>
  );
}

function TeamTile({
  team,
  selected,
  onPick,
}: {
  team: VisionTeam;
  selected: boolean;
  onPick: () => void;
}) {
  const theme = vision.theme(team.key);
  const logo = vision.logoUrl(team.key);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <button
      onClick={onPick}
      aria-pressed={selected}
      className={`flex w-full flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        selected
          ? "border-accent bg-accent/10"
          : "border-edge-soft bg-elevated/50 hover:border-edge"
      }`}
      style={theme ? { boxShadow: `inset 0 -3px 0 #${theme.primary}` } : undefined}
    >
      {logo && failed !== logo ? (
        <img
          src={logo}
          alt=""
          draggable={false}
          onError={() => setFailed(logo)}
          className="h-14 w-14 object-contain"
        />
      ) : (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-canvas/60 text-[17px] font-black text-ink">
          {monogram(team.name)}
        </span>
      )}
      <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-ink">
        {team.name}
      </span>
      {team.mascot && <span className="text-[11.5px] text-ink-subtle">{team.mascot}</span>}
    </button>
  );
}

function TeamBranding({ team }: { team: VisionTeam }) {
  const t = useT();
  const { openSportsPage } = useView();
  const theme = vision.theme(team.key);
  const logo = vision.logoUrl(team.key);
  const conference = vision.groups().find((g) => g.slug === team.conference)?.name ?? "";
  const hero = vision.template("team-hero-banner") ?? vision.templates("hero")[0] ?? null;
  const extras = ["team-spotlight-poster", "team-glass-wallpaper"]
    .map((slug) => vision.template(slug))
    .filter((tpl) => tpl !== null);
  const bindings = {
    team_name: team.name,
    mascot: team.mascot,
    conference,
    tagline: [team.mascot, conference].filter(Boolean).join(" · "),
  };
  const linked = Object.keys(PAGE_LEAGUE)
    .map((league) => ({ league, id: vision.providerId(team.key, "espn", league) }))
    .find((p): p is { league: string; id: string } => !!p.id);
  return (
    <section className="flex flex-col gap-4">
      {hero && (
        <VisionTemplateCanvas
          template={hero}
          theme={theme}
          logo={logo}
          art={vision.artUrl(team.key, "hero")}
          bindings={bindings}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {linked && (
          <Pill
            onClick={() =>
              openSportsPage({
                kind: "team",
                league: PAGE_LEAGUE[linked.league],
                teamId: linked.id,
                name: team.name,
              })
            }
          >
            <ExternalLink size={13} />
            {t("Scores, schedule & roster")}
          </Pill>
        )}
        {!linked && <Note>{t("Not linked to live scores yet.")}</Note>}
        {!theme && (
          <Note>{t("Team colours aren't verified yet, so the JL glass look is used.")}</Note>
        )}
        {!logo && <Note>{t("No approved logo yet.")}</Note>}
      </div>
      {extras.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] items-start gap-3">
          {extras.map((tpl) => (
            <VisionTemplateCanvas
              key={tpl.slug}
              template={tpl}
              theme={theme}
              logo={logo}
              art={vision.artUrl(team.key, tpl.type === "background" ? "wallpaper" : "story")}
              bindings={bindings}
            />
          ))}
        </div>
      )}
    </section>
  );
}
