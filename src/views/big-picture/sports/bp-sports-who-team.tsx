import { useState } from "react";
import { SFX } from "@/lib/sfx";
import type { TeamProfileData, TeamProfilePlayer } from "@/lib/sports/team-profile";
import { useBpT } from "../bp-i18n";
import { useBpSportsWhoTeam } from "./bp-sports-who-data";
import {
  BP_WHO_CELL_NAME,
  BP_WHO_CELL_SUB,
  BP_WHO_FLUSH,
  BP_WHO_HEADING,
  BpSportsWhoFace,
  type BpSportsWhoView,
} from "./bp-sports-who-parts";
import type { BpSportsWhoTeamSubject } from "./bp-sports-who-subject";

const PAGE = 14;

const QUIET = 4;

const FIGURE_MAX = 14;

const CELL = "clamp(118px, 9.6vw, 184px)";

const TRACK =
  "flex gap-[clamp(9px,0.9vw,18px)] overflow-x-auto pt-[clamp(10px,1.2vh,18px)] pb-[60px] -mb-[40px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const SHELL =
  "flex shrink-0 flex-col items-center gap-[clamp(7px,0.85vh,12px)] overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel)] p-[clamp(10px,1vh,16px)] text-center";

const STANDING = /\bstanding\b/i;

const RECORD = /\b(record|overall)\b/i;

const LOUD = /^(founded|capacity)$/i;

const LEAD_FACT = /^(league|country|location)$/i;

function RosterCell({ player, onPress }: { player: TeamProfilePlayer; onPress?: () => void }) {
  const badge = player.jersey ? `#${player.jersey}` : "";
  const sub = [badge, player.position ?? ""].filter((value) => value !== "").join(" · ");
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`bp-sports-who-player:${player.source}:${player.id}`}
      aria-label={player.name}
      onClick={() => {
        if (!onPress) return;
        SFX.open();
        onPress();
      }}
      style={{ width: CELL }}
      className={SHELL}
    >
      <BpSportsWhoFace src={player.image ?? ""} name={player.name} />
      <span className={`${BP_WHO_CELL_NAME} line-clamp-2`}>{player.name}</span>
      {sub !== "" && <span className={BP_WHO_CELL_SUB}>{sub}</span>}
    </button>
  );
}

function RosterRow({
  roster,
  onPlayer,
}: {
  roster: TeamProfilePlayer[];
  onPlayer?: (player: TeamProfilePlayer) => void;
}) {
  const t = useBpT();
  const [shown, setShown] = useState(PAGE);
  const cells = roster.slice(0, shown);
  const rest = roster.length - cells.length;
  return (
    <section
      data-bp-row
      data-bp-row-key="bp-sports-who-roster"
      style={{ ...BP_WHO_FLUSH, containIntrinsicSize: "auto 230px" }}
      className="relative"
    >
      <h2 className={BP_WHO_HEADING}>{t("Roster")}</h2>
      <div data-bp-scroll-x className={TRACK}>
        {cells.map((player) => (
          <RosterCell
            key={`${player.source}:${player.id}`}
            player={player}
            onPress={onPlayer ? () => onPlayer(player) : undefined}
          />
        ))}
        {rest > 0 && (
          <button
            type="button"
            data-bp-focusable
            data-bp-tile
            data-bp-restore-key="bp-sports-who-roster-more"
            onClick={() => setShown(roster.length)}
            style={{ width: CELL }}
            className={`${SHELL} justify-center`}
          >
            <span className={`${BP_WHO_CELL_NAME} line-clamp-3`}>
              {t("Show all {n}", { n: roster.length })}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}

function loudFacts(data: TeamProfileData | null): TeamProfileData["facts"] {
  if (data === null) return [];
  const pick = (test: RegExp) =>
    data.facts.filter((fact) => test.test(fact.label) && fact.value.length <= FIGURE_MAX);
  return [...pick(RECORD), ...pick(LOUD)].slice(0, 4);
}

export function useBpSportsWhoTeamView(
  subject: BpSportsWhoTeamSubject | null,
  onPlayer?: (player: TeamProfilePlayer) => void,
): BpSportsWhoView {
  const t = useBpT();
  const { data, loading, failed } = useBpSportsWhoTeam(subject?.identity ?? null);
  const facts = data?.facts ?? [];
  const loud = loudFacts(data);
  const bare =
    data === null ||
    (data.facts.length === 0 && data.roster.length === 0 && data.description === undefined);
  const link =
    data?.links.find((item) => item.label === "Official website") ?? data?.links[0] ?? null;

  return {
    eyebrow: t("Team profile"),
    lead: facts
      .filter((fact) => STANDING.test(fact.label) || LEAD_FACT.test(fact.label))
      .map((fact) => fact.value)
      .join(" · "),
    figures: loud.map((fact) => ({ name: t(fact.label), value: fact.value })),
    facts: facts
      .filter(
        (fact) => !STANDING.test(fact.label) && !LEAD_FACT.test(fact.label) && !loud.includes(fact),
      )
      .slice(0, QUIET)
      .map((fact) => ({ label: t(fact.label), value: fact.value })),
    body: data?.description ?? "",
    note:
      failed || bare
        ? t("Profile details could not be loaded.")
        : data !== null && data.partial
          ? t("Detailed statistics could not be loaded.")
          : "",
    link: link === null ? null : { label: t(link.label), url: link.url },
    loading,
    art: data?.logo || subject?.art || "",
    fit: "object-contain p-[clamp(22px,2.6vw,58px)] pb-[26%]",
    extra:
      data !== null && data.roster.length > 0 ? (
        <RosterRow
          key={`${data.identity.id}:${data.name}`}
          roster={data.roster}
          onPlayer={onPlayer}
        />
      ) : null,
  };
}
