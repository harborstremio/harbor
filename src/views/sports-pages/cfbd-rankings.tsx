import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useCfbdRankings } from "@/lib/jl/sports/use-cfbd";
import { Img, Note, Section, Spinner } from "./espn-page-parts";

/**
 * College football polls from CollegeFootballData (the viewer's own key): AP Top 25, Coaches
 * Poll and, late in the season, the Playoff rankings. A ranked team opens its team page.
 */
export function CfbdRankings({
  logos,
  onTeam,
}: {
  /** ESPN logos by team id, from the league's team list. */
  logos: ReadonlyMap<string, string>;
  onTeam: (teamId: string, name: string) => void;
}) {
  const t = useT();
  const { rankings, ready, hasKey } = useCfbdRankings();
  const [picked, setPicked] = useState<string | null>(null);

  if (!hasKey) {
    return (
      <Section title={t("Rankings")}>
        <Note>
          {t(
            "Add a free CollegeFootballData key in Settings → Sports plugins & keys to see the AP Top 25, Coaches Poll and Playoff rankings here.",
          )}
        </Note>
      </Section>
    );
  }
  if (!ready) return <Spinner />;
  if (!rankings?.polls.length) {
    return (
      <Section title={t("Rankings")}>
        <Note>{t("CollegeFootballData has no rankings to show right now.")}</Note>
      </Section>
    );
  }
  const poll = rankings.polls.find((p) => p.name === picked) ?? rankings.polls[0];
  const week =
    rankings.seasonType === "postseason" ? t("Final") : t("Week {n}", { n: rankings.week });

  return (
    <Section
      title={t("Rankings")}
      aside={
        <span className="ms-auto text-[12.5px] text-ink-subtle">
          {rankings.season} · {week}
        </span>
      }
    >
      {rankings.polls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {rankings.polls.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setPicked(p.name)}
              aria-pressed={p.name === poll.name}
              className={`flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[12.5px] font-medium transition-colors ${
                p.name === poll.name
                  ? "border-accent bg-accent/15 text-ink"
                  : "border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      <ol className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
        {poll.ranks.map((r) => (
          <li key={`${poll.name}:${r.teamId}`}>
            <button
              type="button"
              onClick={() => onTeam(r.teamId, r.school)}
              className="flex w-full items-center gap-3 rounded-xl border border-edge-soft/60 bg-elevated/40 px-3 py-2 text-start transition-colors hover:border-edge focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="w-7 shrink-0 text-end text-[15px] font-black tabular-nums text-accent">
                {r.rank}
              </span>
              <Img src={logos.get(r.teamId)} className="h-7 w-7 shrink-0 object-contain" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-semibold text-ink">
                  {r.school}
                  {r.firstPlaceVotes ? (
                    <span className="ms-1.5 text-[12px] font-medium text-ink-subtle">
                      ({r.firstPlaceVotes})
                    </span>
                  ) : null}
                </span>
                {r.conference && (
                  <span className="truncate text-[12px] text-ink-subtle">{r.conference}</span>
                )}
              </span>
              {r.points !== null && (
                <span className="shrink-0 text-[12px] tabular-nums text-ink-subtle">
                  {t("{n} pts", { n: r.points })}
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </Section>
  );
}
